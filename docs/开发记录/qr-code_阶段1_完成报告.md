# qr-code（二维码生成器） — 阶段 1 完成报告

**切片（阶段）**：二维码生成器全量（载荷构建 → 编码核心 → 渲染 → 页面 → 导出与验收）
**完成时间**：2026-09-24 20:10
**切片完成标准**：用户可以打开 `/tools/qr-code/`，在 7 种类型（链接 / 文本 / Wi-Fi / 名片 / 邮件 / 电话 / 短信）里任选一种、填字段即时出码，换 4 种预设深色，查看实际编码内容与码的规格，下载 PNG（512/1024）/ SVG 或复制图片。

---

## 完成的任务

| 任务 | 测试 | 验收方式 | 状态 |
|------|------|---------|------|
| 前置：devDependencies（qrcode-generator + jsqr） | — | package.json 确认 `dependencies` 仍为空 | ✅ |
| T1 载荷构建（7 个 builder + 转义） | 22 个测试 | TDD | ✅ |
| T2 编码核心（码字层 + 矩阵层） | 18 个测试 | TDD + 与 qrcode-generator 逐模块比对 | ✅ |
| T3 端到端解码（jsQR 独立解码） | 10 个测试 | TDD（验证性任务，RED 由 T2 实现前承担） | ✅ |
| T4 渲染（SVG 字符串 + canvas） | 9 个测试 | TDD | ✅ |
| T5 页面层 + 表单切换 + 即时生成 | typecheck + build | 浏览器验收 | ✅ |
| T6 导出 + 颜色 + 门禁 + 浏览器验收 | 全量 209 测试 | 五步门禁 + 真实页面操作 + 截图 | ✅ |

全量测试：**209 个全绿**（此前 150 + 本工具新增 59）。

---

## 手动验收汇总（agent-browser，真实页面）

| 验证点 | 结果 | 截图 |
|---|---|---|
| AC-001 空状态示例（打开即有码，三按钮可用） | ✅ | `01-空状态示例.png` |
| AC-002 七类型平铺切换 + 各类型输入互不覆盖 | ✅ | `01` / `02` |
| AC-006/007 Wi-Fi：密码默认密文；载荷 `WIFI:T:WPA;S:Cafe\;Guest;P:a\:b\\c;;`（特殊字符正确转义） | ✅ | `02-WiFi含特殊字符.png` |
| AC-018 空输入：引导语 + 导出按钮置灰 | ✅ | `03-空输入引导.png` |
| AC-019 超容量：明确提示上限 2331 字符，无码、按钮置灰，**不截断** | ✅ | `04-超容量提示.png` |
| AC-004 链接自动补 `https://` 并提示「Using https://plainkit.app」 | ✅ | eval 断言 |
| AC-012 四个深色预设即时换色，背景恒白 | ✅ | `05-森林色.png` |
| AC-013/029 折叠区显示载荷 + `Version 2 · 25 × 25 modules · Error correction M` | ✅ | eval 断言 |
| AC-014/015/017/028 导出 PNG（`qrcode-link.png`，文件名正确）：481×481 实测，**逐模块与预览 SVG 完全一致（0 行差异）**，静区 4 模块，底部 `plainkit.app` | ✅ | `qrcode-link.png` |
| AC-026 移动端 390px：无横向滚动（scrollWidth=clientWidth=390） | ✅ | `06-移动端390.png` |
| AC-027 网络请求：全程只有 127.0.0.1 本地资源 + 测试自身注入的 data: 图片，**零外部请求** | ✅ | network requests 记录 |
| 控制台 / 页面错误 | 零 | errors 输出为空 |

**留真机抽查**（headless 做不了）：用手机实扫 AC-006/008/009/010/011——扫 `docs/开发记录/qr-code_验收截图/qrcode-link.png` 应得到 `https://plainkit.app`；Wi-Fi 码应能直接连网。注：jsQR 独立解码已在 Node 里覆盖了同样的端到端路径（7 种载荷 + 中文/emoji + 8 掩码 + v1–v40）。

---

## 文件变更

### 新增
- `src/lib/tools/qr-code/index.ts` — 载荷构建层（7 个 builder + Wi-Fi/vCard 转义）
- `src/lib/tools/qr-code/encoder.ts` — QR 编码核心（GF(256) Reed-Solomon、交织、版本选择、矩阵放置、掩码、惩罚评分）
- `src/lib/tools/qr-code/render.ts` — SVG 字符串 + canvas 绘制（静区 4 模块、站点标识）
- `src/lib/tools/qr-code/index.test.ts` / `encoder.test.ts` / `decode.test.ts` / `render.test.ts` — 59 个测试
- `src/pages/tools/qr-code/index.astro` — 工具页
- `docs/开发记录/qr-code_验收截图/` — 6 张验收截图 + 导出产物

### 修改
- `src/lib/shared/tools.ts` — 登记工具 7（slug `qr-code`，分类 Utility）
- `specs/features/qr-code_任务规划.md` — 勾选 T1–T6
- `scripts/check-budget.mjs` — 修门禁误报（见下）

---

## AC 覆盖进度

32 条 AC 全部有对应实现与验证。其中 AC-016（复制图片成功路径）在 headless 下无法真实写入剪贴板（与 ascii-art 的遗留同一情况），代码路径有 try/catch 降级（AC-025 已验证提示逻辑存在），留真机点一次确认。其余 30 条已通过测试或浏览器验收，AC-006/008/009/010/011 的「手机实扫」留真机抽查（jsQR 端到端已覆盖同等验证）。

---

## 问题与决策

### 1. 参考库默认按 Shift-JIS 取字节
**情况**：qrcode-generator 主构建的 `stringToBytes` 是 Shift-JIS（「你好」→ [96,125]），中文/emoji 比对全部失败。
**处理**：测试里把它换成自己的 UTF-8 取字节函数后再比对（该库在 `addData` 时才读这个属性，替换生效）。
**影响**：无。库只活在测试里。

### 2. 性能门禁误报模板字符串里的 URL
**情况**：`npm run budget` 把 `https://${r}` 和 `plainkit.app`,Y`（压缩后代码碎片）当成外部域名，构建失败。
**处理**：修 `scripts/check-budget.mjs`——URL 正则排除反引号 + 主机名必须形如域名（`HOSTNAME_RE`）才判失败。这是门禁自身的漏判，不是放宽预算。
**影响**：后续工具页不会再被这类误报卡住。

### 3. 操作按钮超出「最多两个」的设计规则
**情况**：AC 要求 PNG / SVG / 复制图片三种导出，DESIGN.md §6-bis.5 说操作按钮最多两个且须含「复制可分享链接」。
**处理**：两个 `.btn`（Copy image / Download PNG）+ 一个 `link-btn`（Download SVG）+ PNG 尺寸选择。本工具无可分享链接（内容编码进 URL 有容量与隐私问题，AC 已裁定），「复制可分享链接」由「Copy image」承担——产物即分享物。
**影响**：无。与 ascii-art 的先例一致。

### 4. `agent-browser download` 在本沙箱触发 SIGTERM
**情况**：`download` 命令连续两次把 shell 杀掉（exit 137）。
**处理**：改用「拦截 `URL.createObjectURL` + FileReader」在页面内取出真实导出 Blob，再逐像素比对 PNG 与 SVG（0 差异）。这个验证比「下载成功」更强。
**影响**：无。沙箱路径问题，与产品无关。

---

## 技术债务

- 无遗留。jsqr（Apache-2.0）与 qrcode-generator（MIT）均为 devDependency，不进 `src/`、不进 bundle、不随 dist 分发，不触发 NOTICE 合并义务。
