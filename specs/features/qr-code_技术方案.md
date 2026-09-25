# qr-code — 轻量技术方案

> s9 产物（按 specs/README.md §6.1 最小篇幅，≤1 页）。AC 见 [qr-code.md](./qr-code.md)。
> 定稿时间：2026-09-24

## 核心思路

**三段串联，前两段全是纯函数**：内容 → 载荷字符串 → 布尔矩阵 → 渲染。

1. **载荷构建**（纯字符串）：7 种表单 → 各自的标准载荷串（BR-007）
2. **QR 编码核心**（纯函数，无浏览器 API）：字节模式 + ECC 固定 M + 自动最小版本 → 布尔矩阵。这是全部技术难度的所在（Reed-Solomon、掩码、版本表）
3. **渲染**：**预览与 SVG 导出同源**——把矩阵序列化成 SVG 字符串（纯字符串，可测、清晰、可缩放）；只有 PNG 导出才用 canvas

**正确性靠两道交叉验证兜住**（用户 2026-09-24 裁定）：成熟库只作 devDependency，**只在测试里 import，绝不出现在 `src/`**（DESIGN.md §11.2 运行时依赖禁令）。

- **黄金标准比对**：`qrcode-generator`（MIT，v2.0.4）。对同一版本 / 同一载荷，自研矩阵在**强制 8 个掩码**下逐一与参考矩阵比对，**要求至少有一个逐模块完全相等**；同时「数据码字 + 纠错码字 + 交织结果」逐字节相等（这一段与掩码无关，专门兜住 RS 与版本表）
- **端到端解码**：`jsqr`（仅 devDependency，不进 bundle 也不分发，因此不触发 NOTICE 合并义务）。把矩阵渲染成 RGBA 像素数组交给它解码，**断言解出的文本 == 原始载荷**——这是「真的扫得出来」的硬证据，比逐模块比对更能说明问题

## 纯函数清单

### `src/lib/tools/qr-code/index.ts` — 载荷构建

| 函数 | 签名 | 说明 |
|---|---|---|
| `buildLinkPayload` | `(raw: string) => string` | 无协议头时补 `https://`（AC-004）；已含 `http(s)://` 则不动 |
| `buildTextPayload` | `(text: string) => string` | 原样 |
| `buildWifiPayload` | `(input: WifiInput) => string` | `WIFI:T:<WPA\|WEP\|nopass>;S:<esc>;P:<esc>;;`；`\ ; , : "` 前加 `\` 转义（AC-021） |
| `buildVCardPayload` | `(input: ContactInput) => string` | **vCard 3.0**（`BEGIN:VCARD`…`END:VCARD`）；`, ; \` 转义（AC-022） |
| `buildEmailPayload` | `(input: EmailInput) => string` | `mailto:<to>?subject=<enc>&body=<enc>`；主题/正文为空则省略该参数（AC-024） |
| `buildPhonePayload` | `(raw: string) => string` | `tel:` + 去掉空格、保留 `+` `-`（AC-023） |
| `buildSmsPayload` | `(input: SmsInput) => string` | `sms:<号码>?body=<enc>`（iOS 与现代 Android 都认） |
| `isEmptyPayload` | `(s: string) => string \| null` | 空串 / 纯空格 → `null`（AC-018） |

### `src/lib/tools/qr-code/encoder.ts` — QR 编码核心

| 函数 | 签名 | 说明 |
|---|---|---|
| `utf8Bytes` | `(s: string) => Uint8Array` | UTF-8 编码（`TextEncoder`，Node 与浏览器同为全局，测试可用） |
| `buildDataCodewords` | `(bytes: Uint8Array, version: number) => Uint8Array` | 模式指示符 `0100` + 字符数（v1–9 用 8 位 / v10–40 用 16 位）+ 数据 + 终止符 + 补齐到该版本数据码字数 |
| `rsEncode` | `(data: Uint8Array, ecCount: number) => Uint8Array` | GF(256) Reed-Solomon 生成纠错码字 |
| `interleave` | `(blocks: Uint8Array[]) => Uint8Array` | 按块交织数据码字与纠错码字 |
| `chooseVersion` | `(byteLength: number) => number \| null` | 能装下的**最小版本**；超过 v40 → `null`（AC-019 走提示，不截断） |
| `buildMatrix` | `(codewords, { version, mask? }) => QrMatrix` | 放置定位/时序/校正图形/格式信息/版本信息/暗模块 + 数据 zigzag 填充 + 掩码；`mask` 省略时按惩罚分自动选（AC-029：同一输入结果恒定） |
| `maskPenalty` | `(m: QrMatrix) => number` | ISO 4 条惩罚规则（连续同色、同色块、1:1:3:1 模式、黑白比例） |
| `describeMatrix` | `(m: QrMatrix) => { version; moduleCount; ecl }` | 供 AC-013 的规格显示 |

### 渲染（`src/lib/tools/qr-code/render.ts`）

| 函数 | 签名 | 说明 |
|---|---|---|
| `matrixToSvg` | `(m, { fg, bg, quietZone, label }) => string` | SVG 字符串；`quietZone` 默认 4 模块（BR-003）；底部带 `PlainKit` 小字（BR-002） |
| `renderQrCanvas` | `(ctx, m, { fg, bg, size, quietZone }) => void` | canvas 绘制 + 底部小字；与 SVG 同源同色（所见即所得） |

> 版本表（每版本总码字数 / 每块纠错码字数 / 分块数）取 ISO/IEC 18004 的 M 级列，落成常量表。**表里 40 行全部由上面的交叉验证测试兜住**——任何一行错，比对就会红。

## 边界情况处理表

| 输入 | 行为 | 对应 AC |
|---|---|---|
| 必填为空 / 纯空格 | `isEmptyPayload` 返回 `null` → 页面不生成，结果区显示引导语，导出按钮 disabled | AC-018 |
| 内容超容量 | `chooseVersion` 返回 `null` → 提示「最多容纳约 N 个字符」（N 由版本表算出，v40·M 字节模式标称 2331 字节），**不截断** | AC-019 |
| 中文 / emoji | 走字节模式 UTF-8，不加 ECI（扫码器默认按 UTF-8 解） | AC-020 |
| Wi-Fi / vCard 特殊字符 | 按各自格式转义 | AC-021 / 022 |
| 号码含空格 | 去空格，保留 `+` `-` | AC-023 |
| 邮件主题/正文空 | 省略对应 query 参数 | AC-024 |
| 剪贴板不支持 / 非安全上下文 | `navigator.clipboard.write` 抛错 → catch → 提示改用下载 | AC-025 |
| 刷新页面 | 不写任何本地存储，回到示例态 | AC-030 |

## 页面与结构落点

- 页面：`src/pages/tools/qr-code/index.astro`，照工具台模板；一段 `<script>` 只做「表单 → 纯函数 → 预览/导出」搬运
- **7 套表单全部渲染进 DOM，用 radio input + CSS `:checked` 显隐**：一举满足 AC-002（切换不丢输入）与 AC-032（无 JS 时表单可见），且不需要 tab 切换的状态代码
- 预览：把 `matrixToSvg` 的字符串内联进 DOM（清晰、可缩放、与 SVG 导出同源）
- 导出：PNG → canvas `toBlob` + 下载（512 / 1024 两档，按 2 倍分辨率绘制再缩放）；SVG → `Blob` 直接下载；复制图片 → `ClipboardItem`
- 颜色：4 个预设深色写成 CSS 变量，预览 SVG 与 canvas 取同一变量值
- 示例：空状态预填 `https://zyphraxns.github.io/plainkit/`（AC-001）
- 首页登记：`src/lib/shared/tools.ts` 的 `TOOLS` 加条目（分类 `Utility`）

## 三个记录在案的判断

1. **预览用内联 SVG 而非 canvas**：与 SVG 导出同源，所见即所得；且 `matrixToSvg` 是纯字符串函数，能在 Node 里全量测试（jsdom 没有真 canvas）。
2. **掩码自动选择即使算错也不致命**——掩码编号写在格式信息里，8 个掩码都能被正常扫出；所以掩码惩罚分是「质量优化」不是「正确性」，真正兜住正确性的是上面两道交叉验证。
3. **编码内容折叠区（AC-013）显示的是载荷串而非二进制码字**：用户要看的是「这码里装的是不是我要的内容」，二进制码字对他没有意义。

## 明确不做

二维码解码功能、logo / 渐变 / 圆点样式、ECC 等级选项、自由取色器、任何新运行时依赖、任何网络请求。
