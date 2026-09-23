# countdown-card — 任务规划（s10，最小篇幅）

> 每个任务带验证标准（具体输入 → 预期输出）。TDD：每个任务先 RED 后 GREEN。

## 任务 1：逻辑层（RED → GREEN）

`src/lib/tools/countdown-card/index.test.ts` 覆盖：AC-001/002/003（三种 mode）、AC-008（附言 >80 拒绝）、AC-009（空标题合法）、AC-010（空/无效日期拒绝）、AC-014（DST 边界：以本地时区零点构造 `now`，00:01 与 23:59 结果一致）、AC-015（篡改参数 decode 返回 null）、`decode(encode) === x` 往返。

**验证**：`npm test` 全绿；测试名全部以 `AC-xxx:` 开头。

## 任务 2：Canvas 内核

`src/lib/shared/canvas-card/`：`fitTextSize` 纯函数 + 测试（长文本缩到 minPx、短文本不缩）；`drawCountdownCard` 绘制函数（含 `plainkit.app` 标识）。

**验证**：`fitTextSize` 测试全绿；绘制函数 typecheck 通过，视觉效果留待任务 5。

## 任务 3：工具页 UI

`src/pages/tools/countdown-card/index.astro`：表单（Title / Date / Theme / Note）、卡片预览（DOM 版，3 主题纯 CSS）、URL replaceState 同步、观览模式（有合法 `date` 参数时隐藏表单 + `Make your own`）、登记 `tools.ts`。

**验证**：`npm run build` 出页面；无 JS 时表单与文案可读；`?date=...` 打开即观览模式。

## 任务 4：导出与复制

`Download image`（1080×1080 PNG，右下角 `plainkit.app`）+ `Copy link`（复制当前 URL，含完整域名）+ `Link copied` 反馈。

**验证**：下载的 PNG 可打开、尺寸 1080×1080；复制动作后出现反馈文案。

## 任务 5：门禁 + 浏览器验收

`format → typecheck → test → build → budget` 全过（工具页 JS ≤ 10KB，外部请求 0）。`agent-browser` 按 AC 实操并截图给用户。

**验证**：五步门禁零失败；截图覆盖倒计时、纪念日、今天、移动端、观览页。
