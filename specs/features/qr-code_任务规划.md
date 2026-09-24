# qr-code — 任务规划

> s10 产物（按 specs/README.md §6.1 最小篇幅，≤1 页）。每个任务带验证标准（具体输入 → 预期输出）。
> 定稿时间：2026-09-24
>
> 状态：T1–T6 全部完成（2026-09-24）。完成报告见 `docs/开发记录/qr-code_阶段1_完成报告.md`。
> **TDD 铁律**：没有失败的测试就不写实现代码。每个任务必须先 RED（见到失败且明白失败原因）再 GREEN。
> **上个工具的教训**（`docs/错题本.md` 2026-09-23）：不要在 T1 顺手把 T2 的函数也实现了——任务边界划清，逐个走 RED → GREEN。

## [x] 前置：装两个测试用依赖

`npm install --save-dev qrcode-generator jsqr`（**必须是 devDependencies**。QR 编码核心自研，这两个库只用于测试验证，不进 `src/`、不进 bundle）
验证标准：`package.json` 的 `dependencies` 仍为空，两个库出现在 `devDependencies`。

## 任务清单

### [x] T1 载荷构建（7 个 builder + 转义）

新建 `src/lib/tools/qr-code/index.ts`，先写 `index.test.ts` 再实现。

**验证标准**（测试名以 `AC-xxx:` 开头）：
- 链接：输入 `plainkit.app` → `https://plainkit.app`；输入 `http://a.com` → 不变（AC-004）
- Wi-Fi：SSID `Cafe;1` 密码 `a:b\c` → 转义后 `\;` `\:` `\\`，用于生成 `WIFI:T:WPA;S:Cafe\;1;P:a\:b\\c;;`（AC-021）
- 名片：姓名含 `,` `;` → 正确转义，字段不串位（AC-022）
- 邮件：只填收件人 → `mailto:a@b.com`，无 `?`；主题正文都填 → 两个参数都在（AC-024）
- 电话：`+49 30 123456` → `tel:+4930123456`（AC-023）
- 短信：`sms:+49123?body=Hi%20there`
- 空 / 纯空格 → `null`（AC-018）

### [x] T2 QR 编码核心（分两步走，不要一次写完）

`src/lib/tools/qr-code/encoder.ts`。**先写测试再实现**，且 T2-a 与 T2-b 各自 RED → GREEN，不要合并。

**T2-a 码字层**：`utf8Bytes` / `buildDataCodewords` / `rsEncode` / `interleave` / `chooseVersion`。
**T2-b 矩阵层**：`buildMatrix` / `maskPenalty` / `describeMatrix`。

**验证标准**：
- 码字层：与 `qrcode-generator` 同一版本同载荷的**数据码字 + 纠错码字 + 交织结果逐字节相等**（取 v1 / v5 / v10 / v25 / v40 各一例，载荷长度分别取「刚好填满」「差一个字节」两种）
- 矩阵层：与 `qrcode-generator` 的矩阵比对——自研在**强制 8 个掩码**下逐一比对，**要求至少一个逐模块完全相等**（若参考库暴露 `maskPattern` 则直接对齐该掩码比对）
- `chooseVersion`：短网址 → v2–v3；超长文本（>2331 字节）→ `null`（AC-019）
- 确定性：同一输入调两次 `buildMatrix`，结果完全一致（AC-029）
- `describeMatrix` 返回的版本 / 模块数 / 等级与参考库一致（AC-013）

### [x] T3 端到端「真的扫得出来」

用 `jsqr` 解码自研矩阵渲染出的 RGBA 像素数组。

**验证标准**：
- 7 种载荷各一例（含中文、emoji、超长 URL、含特殊字符的 Wi-Fi 密码）→ `jsqr` 解出的文本 **== 原始载荷**（AC-005 / 006 / 008 / 009 / 010 / 011 / 020 / 021 / 022）
- 8 个掩码各解码一次，全部成功（证明任意掩码都合法可用）
- 覆盖 v1 / v10 / v25 / v40 四个版本

### [x] T4 渲染：SVG 字符串 + canvas

`src/lib/tools/qr-code/render.ts`。

**验证标准**：
- `matrixToSvg`：静区恒为 4 模块（AC-028）；底部含 `plainkit.app`（AC-017）；前景色随传入值变化、背景恒白（AC-012）
- `renderQrCanvas`：与 SVG 同色同布局；尺寸随 512 / 1024 变化（AC-014）
- 两个产物的模块位置一致（预览 = 导出，所见即所得）

### [x] T5 页面层 + 表单切换 + 即时生成

新建 `src/pages/tools/qr-code/index.astro`（工具台模板 + 7 套表单 + radio/CSS 显隐 + 预览区 + 编码内容折叠区 + 一段 script），`tools.ts` 登记。

**验证标准**：
- `npm run typecheck`、`npm run build` 通过
- 打开即显示示例码（`https://plainkit.app`），三个导出按钮可用（AC-001）
- 7 个类型标签同时可见、切换后表单跟着变、切回内容仍在（AC-002）
- 输入即时出码，页面上**没有**「生成」按钮（AC-003）
- 必填为空 → 不出码 + 引导语 + 导出按钮置灰（AC-018）
- 超长内容 → 提示含上限数字，不截断（AC-019）
- 折叠区：显示载荷串 + 版本/模块数/ECC，ECC 恒为 M（AC-013 / 029）
- Wi-Fi 密码默认密文，「显示」可切换（AC-007）
- 刷新后无任何残留输入（AC-030）
- 禁用 JS：标题、说明、7 套表单均可见，布局不塌（AC-032）

### [x] T6 导出 + 颜色 + 质量门禁 + 浏览器验收

**验证标准**：
- 四个深色预设切换即时生效，背景恒白，无色取器（AC-012）
- PNG 512 / 1024 下载成功、文件名形如 `qrcode-wifi.png`、带静区与小字（AC-014 / 017）
- SVG 下载成功、矢量为 `path`/`rect` 无损（AC-015）
- 复制图片成功路径 + 不支持时的降级提示（AC-016 / 025）
- `npm run format && npm run typecheck && npm test && npm run build && npm run budget` 全绿；**工具页 JS ≤ 10KB gzip**（自研编码核心目标 ≤3KB）
- 用 Chrome headless 打开真实页面按 AC 操作截图：空状态、7 种类型各一张、超容量提示、390px 视口（AC-026）
- 控制台 `performance.getEntriesByType('resource').filter(r => !r.name.startsWith(location.origin))` 为空（AC-027）
- **给用户的扫码验收**：截出 7 张码（链接/文本/Wi-Fi/名片/邮件/电话/短信），用户用手机扫验 AC-006 / 008 / 009 / 010 / 011——这是唯一能证明「真的扫得出来」的人工环节
