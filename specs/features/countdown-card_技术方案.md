# countdown-card — 轻量技术方案（s9，最小篇幅）

> 依据：`specs/features/countdown-card.md`（AC）、`DESIGN.md`、`技术栈.md` §3.4–3.5。
> 只写纯函数清单 + 输入输出 + 边界表。

## 1. 纯函数清单

### 逻辑层 `src/lib/tools/countdown-card/index.ts`

| 函数 | 签名 | 输入输出 |
|---|---|---|
| `parseDate` | `(input: string) => Result<string>` | 校验 `YYYY-MM-DD` 且为真实日历日期，返回规范化的目标日期 |
| `parseTitle` | `(input: string) => Result<string>` | trim 后 ≤ 60 字符，可为空串（空 = 不渲染标题行，AC-009） |
| `parseNote` | `(input: string) => Result<string>` | trim 后 ≤ 80 字符（AC-008），可为空串 |
| `parseTheme` | `(input: string) => Result<CardTheme>` | 必须是 `THEMES` 之一 |
| `computeCountdown` | `(target: string, now: Date) => CountdownResult` | 返回 `{ mode, days, headline, dateLabel }`；`mode` 为 `countdown / anniversary / today`（AC-001/002/003） |
| `formatTargetDate` | `(iso: string) => string` | → `June 15, 2027`（en-US） |
| `decodeState` | `(params: URLSearchParams) => CardStateInput \| null` | 无 `date` 参数返回 `null`；参数存在则全部走与手输相同的 parse 路径（DESIGN §16 URL 注入规则） |

**日期数学（AC-014 的落点）**：手动拆 `YYYY-MM-DD` 构造**本地时区零点**的 `Date`（禁止 `new Date("YYYY-MM-DD")`——那是 UTC 解析，会产生时区偏差）。天数 = `Math.round((目标零点 − 今天零点) / 86400000)`，`round` 吸收 DST 的 ±1h。

### Canvas 内核 `src/lib/shared/canvas-card/index.ts`（工具 5 将复用）

| 函数 | 签名 | 输入输出 |
|---|---|---|
| `fitTextSize` | `(text: string, maxWidth: number, startPx: number, minPx: number) => number` | 纯函数：给定字号起点与上限宽度，返回不溢出的字号。可 node 单测 |
| `drawCountdownCard` | `(ctx: CanvasRenderingContext2D, state: RenderState) => void` | 1080×1080，基于 `measureText` 自适应排版，右下角 `PlainKit`。DOM 相关，靠 agent-browser 验收 |

### 主题

`THEMES = ['light', 'midnight', 'warm']`。三套均为纯色/双色调 CSS 绘制（预览）+ 对应 hex 常量表（Canvas），不引任何图片资源。

## 2. 边界表

| 边界 | 处理 | AC |
|---|---|---|
| 目标日期 = 今天 | `mode: 'today'`，显示 "Today is the day!" | AC-003 |
| 过去日期 | `mode: 'anniversary'` | AC-002 |
| > 999 天 | 数字正常渲染，Canvas 字号自适应 | AC-011 |
| 标题为空 | 不渲染标题行 | AC-009 |
| 附言 > 80 字符 | 输入端 `maxlength` + parse 双重拦截 | AC-008 |
| 链接参数篡改 | `decodeState` 返回非法即 `null` → 回退默认空状态，不崩溃 | AC-015 |
| 无效日期（如 02-30） | `parseDate` 返回 `Result` 错误 | AC-010 |
| DST / 时区 | 本地零点对齐 + `round` | AC-014 |

## 3. 页面与 URL 状态

- 页面 `src/pages/tools/countdown-card/index.astro`，照 DESIGN §6-bis.5 模板：表单 + 卡片预览（即结果读数位）+ 两个操作按钮（`Copy link` 主、`Download image` 次）。
- URL 参数（camelCase）：`?title=&date=&theme=&note=`。输入时 `history.replaceState` 同步 → Copy link 直接复制当前 URL。
- **观览模式**：URL 带合法 `date` 参数时隐藏表单、全屏展示卡片 + `Make your own` 按钮（指向无参数的工具页）。同一路由，无新 URL。
- PNG 导出：Canvas 2D 原生，1080×1080（`devicePixelRatio` 无关，直接高分辨率画布），`toBlob` 下载。

## 4. 新增/修改文件

```
src/lib/tools/countdown-card/index.ts + index.test.ts    # 逻辑 + 测试
src/lib/shared/canvas-card/index.ts                      # fitTextSize 可测；绘制函数
src/pages/tools/countdown-card/index.astro               # 工具页 + 观览模式
src/lib/shared/tools.ts                                  # 登记表 +1 行
```
