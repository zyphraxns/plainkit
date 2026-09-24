# random-picker — 任务规划

> s10 产物（按 specs/README.md §6.1 最小篇幅，≤1 页）。每个任务带验证标准（具体输入 → 预期输出）。
> 定稿时间：2026-09-24
>
> 状态：T1–T5 全部完成（2026-09-24）。完成报告见 `docs/开发记录/random-picker_阶段1_完成报告.md`。

## 任务清单（TDD：RED → GREEN → REFACTOR）

### [x] T1 纯函数层

新建 `src/lib/tools/random-picker/index.ts`（splitNames / dedupeNames / parseCount / shuffle / assignGroups / pickNames / formatGroupsText），先写测试（`index.test.ts`）再实现。

**验证标准**：
- 测试名以 `AC-xxx:` 开头，覆盖 AC-001 / 002 / 003 / 004 / 006 / 008 / 009 / 011 / 012 / 017 对应用例
- `npm test` 全绿；RED 阶段必须先见失败
- 手工对照：23 人按 4 组 → 尺寸 [6,6,6,5]；确定性 rng 下 shuffle 结果可复现；均匀性抽查（同一名单跑 200 次，每人落组 1 的次数在 35–65 区间）

### [x] T2 卡片绘制

在 `src/lib/shared/canvas-card/` 增加 `drawGroupCard` + 测试。

**验证标准**：
- 测试覆盖：组数 1–3 栏排版切换、名字过长折行/截断、30 人与 300 人两个规模的画布高度增长、右下角 `plainkit.app`（AC-005 / 013 的绘制部分）
- jsdom canvas 不可用时按现有 `canvas-card/index.test.ts` 的既有模式处理

### [x] T3 页面层

新建 `src/pages/tools/random-picker/index.astro`（工具台模板 + 名单框 + 模式切换 + 参数输入 + 结果区 + 一段 script），`tools.ts` 登记，localStorage 存取。

**验证标准**：
- `npm run typecheck`、`npm run build` 通过
- 无 JS 时：名单框与 label 可见、邀请文案在结果区
- 粘贴 23 人按 4 组：显示 4 组 5–6 人（AC-001）；每组 3 人 → 8 组（AC-002）
- 空名单 / 1 人：按钮置灰 + 引导文案（AC-010）；组数 8 > 5 人：限制 + 提示（AC-011）；抽 15 > 10 人：限制 + 提示（AC-012）
- 重名：提示出现，去重按钮生效（AC-009）
- 刷新页面名单恢复；清除确认后清空（AC-016）

### [x] T4 图片导出 + 复制文本 + 重新生成

**验证标准**：
- 有结果时点保存图片：下载 PNG，含组结果、日期、`plainkit.app`（AC-005）
- 点复制文本：剪贴板为「Group 1\nAlice\nBob…」格式，按钮短暂变 "Copied"（AC-006）
- 点重新生成：新结果替换旧结果，无残留（AC-007）

### [x] T5 质量门禁 + 浏览器验收

`npm run format && npm run typecheck && npm test && npm run build && npm run budget` 全过；用 Chrome headless 打开真实页面按 AC 输入并截图给用户。

**验证标准**：五步门禁全绿；截图覆盖空状态、分组结果、抽人结果、错误/提示态、卡片图片五个画面；外部请求数为 0（AC-015）；390px 宽视口无横向溢出（AC-018）。
