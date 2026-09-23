# grade-calculator — 轻量技术方案

> s9 产物（按 specs/README.md §6.1 最小篇幅，≤1 页）。AC 见 [grade-calculator.md](./grade-calculator.md)。
> 定稿时间：2026-09-23

## 纯函数清单

### `src/lib/shared/format/index.ts`（新建，首个使用者）

| 函数 | 签名 | 说明 |
|---|---|---|
| `roundTo` | `(value: number, digits: number) => number` | 展示前舍入（AC-013）。内部计算不得调用它 |
| `formatScore` | `(value: number, digits?: number) => string` | 恒定小数位的展示串（`100` → `"100.0"`）。实现时补充：roundTo 单独无法保证「恒定 1 位小数」，页面禁止裸 `toFixed`（DESIGN.md §4.4） |

### `src/lib/tools/grade-calculator/index.ts`

| 函数 | 签名 | 输入输出含义 |
|---|---|---|
| `parseCurrentGrade` | `(input: string) => Result<number>` | 0–100，错误消息带字段名「Current grade」 |
| `parseFinalWeight` | `(input: string) => Result<number>` | **1–100**（0 无意义，AC-008），字段名「Final exam weight」 |
| `parseTargetGrade` | `(input: string) => Result<number>` | 0–100，字段名「Target grade」 |
| `computeRequiredFinal` | `(current: number, finalWeight: number, target: number) => FinalRequirement` | **前置条件：三个值已通过 parse 校验**。返回判别式联合 |
| `encodeState` | `(state: GradeState) => string` | `{currentGrade, finalWeight, targetGrade}` → 查询串（不含 `?`），camelCase 参数名 |
| `decodeState` | `(search: string) => GradeStateInput` | 查询串 → 原始字符串记录。**不做校验**，页面把结果交给同一组 parse 函数（BR-004） |

```ts
type FinalRequirement =
  | { status: 'reachable'; required: number }   // 0 ≤ required ≤ 100
  | { status: 'unreachable'; bestPossible: number } // required > 100；bestPossible = current×(100−w)/100 + w
  | { status: 'secured' };                       // required ≤ 0
```

计算式：`required = (target − current × (100 − w) / 100) / (w / 100)`。

## 边界情况处理表

| 输入 | 行为 | 对应 AC |
|---|---|---|
| 权重 = 0 | parse 拒绝：「must be between 1 and 100」 | AC-008 |
| 权重 = 100 | `required = target`（期末即全部成绩），合法 | — |
| required = 100（恰好） | reachable，显示 `100.0` | — |
| required ≤ 0 | secured 分支 | AC-010 |
| required > 100 | unreachable 分支，给出 bestPossible | AC-009 |
| 非数字 / 空串 | parse 拒绝，消息带字段名 | AC-006 |
| < 0 或 > 100 | parse 拒绝，消息带范围 | AC-007 |
| URL 参数非法 | decode 后走同一 parse 路径，回退错误/空状态，不崩溃 | AC-011 |

## 页面与结构落点

- 页面：`src/pages/tools/grade-calculator/index.astro`，照 DESIGN.md §6-bis.5 工具台模板；`<script>` 一段，只做 DOM ↔ 纯函数搬运
- 首页登记：`src/lib/shared/tools.ts` 的 `TOOLS` 加入 grade-calculator 条目
- 错误：每字段一个提示元素，`aria-describedby` + `aria-invalid`（AC-006/007/008）
- Copy link：页面层用 `navigator.clipboard.writeText`，URL 由 `encodeState` 生成（AC-004）

## 两个记录在案的判断

1. **URL 状态编解码暂放工具内**（`encodeState`/`decodeState`），不下沉 `shared/url-state/`——目前只有一个使用者，等第二个工具出现再抽（DESIGN.md §10.2 的 P1 项随之顺延）。
2. **`shared/format/` 只放 `roundTo` + `formatScore`**，不预写格式化全家桶（formatScore 为实现 AC-013 时补充，见上表）。

## 明确不做

字母等级换算、组成项清单、localStorage、任何异步/请求。
