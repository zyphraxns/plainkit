# random-picker — 轻量技术方案

> s9 产物（按 specs/README.md §6.1 最小篇幅，≤1 页）。AC 见 [random-picker.md](./random-picker.md)。
> 定稿时间：2026-09-24

## 纯函数清单

### `src/lib/tools/random-picker/index.ts`

| 函数 | 签名 | 说明 |
|---|---|---|
| `splitNames` | `(input: string) => { names: string[]; duplicates: string[] }` | 按换行 / 逗号 / 分号切分，trim、去空行；`duplicates` 是重复出现的名字（保留首次，只报告不删，AC-008 / 009） |
| `dedupeNames` | `(names: string[]) => string[]` | 一键去重，保留首次出现（AC-009） |
| `parseCount` | `(input: string, max: number, label: string) => Result<number>` | 1–max 整数，错误消息带字段名与上限（AC-011 / 012） |
| `shuffle` | `<T>(items: T[], random: () => number) => T[]` | Fisher-Yates，**不修改原数组**；`random` 注入便于测试，页面层传 `crypto.getRandomValues` 包装 |
| `assignGroups` | `(names: string[], groupCount: number, random) => string[][]` | 先 shuffle 再连续切片：前 `n mod k` 组多 1 人（BR-005，AC-001 / 002） |
| `pickNames` | `(names: string[], count: number, random) => string[]` | shuffle 后取前 count（不放回，AC-003） |
| `formatGroupsText` | `(groups: string[][], modeLabel: string) => string` | 复制用纯文本：组名行 + 成员行（AC-006） |

排序模式 = `shuffle` 后直接输出，不单独建函数。

### `src/lib/shared/canvas-card/`（扩展）

| 函数 | 签名 | 说明 |
|---|---|---|
| `drawGroupCard` | `(ctx, content: GroupCardContent) => void` | 复用 `CARD_THEMES.light` 与 `fitTextSize`。**宽 1080 固定、高按内容增长**（3 栏排版，大名单不截断，AC-013）；右下角 `PlainKit` 标识 |

## 边界情况处理表

| 输入 | 行为 | 对应 AC |
|---|---|---|
| 空行 / 首尾空白 / 逗号分号混合 | 切分后忽略空项 | AC-008 |
| 重复名字 | splitNames 报告，页面显示提示 + 去重按钮，不自动删 | AC-009 |
| 名单 < 2 人 | 页面生成按钮置灰 + 引导文案 | AC-010 |
| 组数 > 人数 | parseCount 上限 = 人数，提示 | AC-011 |
| 抽人数 > 人数 | 同上 | AC-012 |
| 名单 > 300 人 | 页面层截断到 300 并提示（BR-007，AC-014） | AC-014 |
| 重新生成 | 结果区整体替换（AC-007 / 014） | — |

## 页面与结构落点

- 页面：`src/pages/tools/random-picker/index.astro`，照工具台模板；`<script>` 只做 DOM ↔ 纯函数搬运
- 首页登记：`src/lib/shared/tools.ts` 的 `TOOLS` 加入条目
- 名单持久化：页面层 localStorage，键 `plainkit.random-picker.names`，输入时写入、加载时恢复、「清除名单」确认后移除（AC-016）
- 图片导出：复用工具 2 的画布创建 + 2 倍分辨率 + 下载路径
- 随机源：`window.crypto.getRandomValues`，Node 测试环境用注入的确定性 rng

## 两个记录在案的判断

1. **卡片不做主题选择**——工具 2 的 3 主题是它的核心自定义项；本工具的价值在名单结果本身，单 `light` 主题把复杂度留给排版（3 栏 + 自适应高度）。
2. **组内顺序 = shuffle 后顺序**，不做「组内再排序」开关——竞品无此惯例，加开关违背克制原则。

## 明确不做

URL 状态编解码、主题切换、文件导入、任何异步/网络请求。
