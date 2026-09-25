# ascii-art — 任务规划

> s10 产物（按 specs/README.md §6.1 最小篇幅，≤1 页）。每个任务带验证标准（具体输入 → 预期输出）。
> 定稿时间：2026-09-24
>
> 状态：T1–T5 全部完成（2026-09-24）。完成报告见 `docs/开发记录/ascii-art_阶段1_完成报告.md`。

## 任务清单（TDD：RED → GREEN → REFACTOR）

### [x] T1 纯函数层

新建 `src/lib/tools/ascii-art/index.ts`（CHARSETS / imageDataToLuminance / luminanceToGrid / gridToText / gridToColorArt / buildPlainText / renderAsciiCanvas），先写测试（`index.test.ts`）再实现。

**验证标准**：
- 测试名以 `AC-xxx:` 开头，覆盖 AC-003 / 004 / 005 / 006 / 007 / 011 / 013（行数公式）对应的可测行为
- 构造已知像素（纯黑块/纯白块/左黑右白）验证：黑→首字符、白→末字符（空格）、反相翻转、平均池化取中、行尾空格已去
- 行数公式：4:3 图 100 列 → 约 38 行（±1），1×1 网格不崩
- `npm test` 全绿；RED 阶段必须先见失败

### [x] T2 画布导出

`renderAsciiCanvas` + 下载路径测试（jsdom canvas 不可用时按现有 `canvas-card/index.test.ts` 既有模式处理）。

**验证标准**：
- 测试覆盖：单色/彩色两种绘制路径、右下角 `PlainKit`（BR-002）、行数变化时画布尺寸相应增长
- 真实导出效果留给 T5 浏览器验收目视

### [x] T3 页面层 + 三合一输入

新建 `src/pages/tools/ascii-art/index.astro`（工具台模板 + 空状态示例图 + dropzone + 参数区 + 预览区 + 一段 script），`tools.ts` 登记，`public/` 放示例图。

**验证标准**：
- `npm run typecheck`、`npm run build` 通过
- 无 JS 时：提示文案与 label 可见，页面不塌
- 选文件 / 拖拽 / 粘贴截图三种方式都能出预览（AC-002）；点示例图立即出结果（AC-001）
- 拖入 .txt → 错误提示且原结果保留（AC-009）

### [x] T4 参数 + 复制 + 导出

**验证标准**：
- 四项参数拖动/切换即时刷新，无「生成」按钮（AC-003 / 004 / 005 / 006）
- 复制文本：剪贴板为等宽纯文本、无站点尾巴（AC-007）；无图时按钮置灰（AC-015）
- 导出 PNG：下载成功，白底深字、角落 `PlainKit`、彩色开关同步（AC-008）

### [x] T5 质量门禁 + 浏览器验收

`npm run format && npm run typecheck && npm test && npm run build && npm run budget` 全过；用 Chrome headless 打开真实页面按 AC 操作并截图给用户。

**验证标准**：五步门禁全绿（工具页 JS ≤ 10KB gzip）；截图覆盖空状态、单色结果、彩色结果、错误态、PNG 导出物五个画面；控制台执行 `performance.getEntriesByType('resource').filter(r => !r.name.startsWith(location.origin))` 为空（AC-016 / 019）；390px 宽视口无横向溢出（AC-018）；竖拍 EXIF 图与透明 PNG 各验一张（AC-011 / 013）。
