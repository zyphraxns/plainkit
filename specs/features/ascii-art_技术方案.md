# ascii-art — 轻量技术方案

> s9 产物（按 specs/README.md §6.1 最小篇幅，≤1 页）。AC 见 [ascii-art.md](./ascii-art.md)。
> 定稿时间：2026-09-24

## 核心思路

**页面层只做「解码 + 缩画」，逻辑层做全部映射。** 图片解码和 canvas 是浏览器 API，留在页面层；页面把原图一次性 `drawImage` 进一张「列数 × 行数」的小画布（`imageSmoothing` 自动完成降采样，超大图天然不卡，AC-014），`getImageData` 后把小画布的像素数据交给纯函数——`src/lib/` 不碰任何浏览器 API，可全量 TDD。

行数 = `round(原图高 / 原图宽 × 列数 × 0.5)`（0.5 是字符高宽比校正，AC-017），下限 1。

## 纯函数清单

### `src/lib/tools/ascii-art/index.ts`

| 函数 | 签名 | 说明 |
|---|---|---|
| `CHARSETS` | `Record<CharsetPreset, string>` | 三套 ramp，**从暗到亮**排列：classic `@%#*+=-:. `、blocky `█▓▒░ `、minimal `#*. ` |
| `imageDataToLuminance` | `(data: Uint8ClampedArray) => number[]` | 每像素亮度 0（黑）→1（白）：`0.2126R+0.7152G+0.0722B`（Rec. 709），归一化到 0–1 |
| `luminanceToGrid` | `(lum: number[], cols: number, rows: number) => number[]` | 平均池化成 cols×rows 网格，每格取块内平均 |
| `gridToText` | `(grid: number[], cols: number, charset: string, inverted: boolean) => string[]` | 亮度映射字符：inverted 时先取 `1-lum`；每行去掉行尾空格（不影响等宽对齐） |
| `gridToColorArt` | `(grid: number[], rgb: number[], cols: number, charset: string, inverted: boolean) => AsciiCell[]` | AsciiCell = `{ char: string; color: string }`（hex），色取块内平均 RGB |
| `buildPlainText` | `(lines: string[]) => string` | `\n` 连接，去首尾空行（AC-007） |
| `renderAsciiCanvas` | `(ctx, cells, options) => void` | 等宽字体逐格绘制 + 右下角 `plainkit.app`（BR-002）；单色用 `--ink` 值、白底——**PNG 与预览永远一致**（AC-006 / 008） |

## 边界情况处理表

| 输入 | 行为 | 对应 AC |
|---|---|---|
| 非图片文件 | 页面层 `image.onerror` → 错误提示，已有结果不动 | AC-009 |
| 浏览器解不动的格式（Chrome+HEIC） | 同上，提示用 JPG/PNG/WebP | AC-010 |
| 透明区域 | 小画布先填白再 drawImage，浏览器合成完成 | AC-011 |
| GIF | `<img>` 解码天然取第一帧 | AC-012 |
| EXIF 方向 | 用 `HTMLImageElement`（浏览器自动按 EXIF 渲染）再 drawImage，**不用** `createImageBitmap`（其 orientation 默认值跨浏览器不一致） | AC-013 |
| 超大图 | 不读原图像素，只在列数×行数的小画布上采样 | AC-014 |
| 未选图 | 复制/导出按钮 disabled | AC-015 |
| 粘贴无图/拖入多文件 | 取第一个图片项，其余忽略 | AC-002 |

## 页面与结构落点

- 页面：`src/pages/tools/ascii-art/index.astro`，照工具台模板；一段 `<script>` 只做 DOM ↔ 纯函数搬运
- 首页登记：`src/lib/shared/tools.ts` 的 `TOOLS` 加条目
- 输入三合一：`<input type="file" accept="image/*">` + dropzone 拖拽 + `paste` 事件监听 `clipboardData.items`
- 示例图：`public/` 放一张小图（≤40KB），点空状态时才创建 `<img>` 按需加载（不占首屏请求）
- 导出：复用工具 2/5 的 canvas→`toBlob`→下载路径；导出前按 2 倍分辨率重绘
- 彩色开关：一个 checkbox 同时驱动重绘预览与导出（AC-006）

## 三个记录在案的判断

1. **PNG 白底深字，与预览完全一致**——不做「导出换黑底」的花活：AC-006 已裁定两处永远一致，一致性 > 观感。
2. **DESIGN.md §6-bis.5「两个操作按钮须含复制可分享链接」在本工具不适用**：本工具无可分享链接（图片不编码进 URL，AC 范围已裁定），两个按钮 = Copy text + Download PNG。
3. **不持久化任何状态**——没有文本输入，参数重置为零成本，localStorage 是无意义的复杂度。

## 明确不做

SVG 导出、亮度/对比度、URL 状态、任何异步网络请求、任何新依赖。
