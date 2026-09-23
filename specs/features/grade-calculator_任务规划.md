# grade-calculator — 任务规划

> s10 产物（按 specs/README.md §6.1 最小篇幅，≤1 页）。每个任务带验证标准（具体输入 → 预期输出）。
> 定稿时间：2026-09-23

## 任务清单（TDD：RED → GREEN → REFACTOR）

> 状态：T1–T5 全部完成（2026-09-23）。完成报告见 `docs/开发记录/grade-calculator_阶段1_完成报告.md`。

### [x] T1 纯函数层

新建 `src/lib/shared/format/index.ts`（`roundTo`）与 `src/lib/tools/grade-calculator/index.ts`（parse×3 + `computeRequiredFinal`），先写测试（`index.test.ts`、`roundTo.test.ts`）再实现。

**验证标准**：
- 测试名以 `AC-xxx:` 开头，覆盖 AC-002 / 006 / 007 / 008 / 009 / 010 / 013 对应用例
- `npm test` 全绿；RED 阶段必须先见失败
- 手算对照：75/40/80 → 87.5；84/30/90 → unreachable(bestPossible 88.8)；90/10/80 → secured

### [x] T2 状态编解码

工具内实现 `encodeState` / `decodeState` + 测试。

**验证标准**：
- 往返测试：`decodeState(encodeState(s))` 的三个字段与原值一致
- 非法参数：`decodeState('?currentGrade=abc')` 返回原样字符串，由 parse 拒绝（AC-005 / AC-011）

### [x] T3 页面层

新建 `src/pages/tools/grade-calculator/index.astro`（工具台模板 + 表单 + 读数 + 字段错误 + 一段 script），`tools.ts` 登记。

**验证标准**：
- `npm run typecheck`、`npm run build` 通过
- 无 JS 时：三字段与 label 可见、邀请文案在结果区（AC-001 / AC-015）
- 输入 75/40/80：读数变 87.5「points on the final to reach 80%」（AC-002/003）
- 当前 84/30/90：读数区变「Not reachable…88.8」（AC-009）；90/10/80 →「Already secured…」（AC-010）
- 留空/`abc`/`120`/权重 0：字段下方出现对应错误（AC-006/007/008）；修正时错误即清（AC-012）

### [x] T4 Copy link 按钮

**验证标准**：
- 有效结果时点击：剪贴板为带 `?currentGrade=…&finalWeight=…&targetGrade=…` 的完整 URL，出现「Link copied」（AC-004）
- 用该 URL 重新打开页面：三字段预填、结果一致（AC-005）

### [x] T5 质量门禁 + 浏览器验收

`npm run format && npm run typecheck && npm test && npm run build && npm run budget` 全过；用 Chrome headless 打开真实页面按 AC 输入并截图给用户。

**验证标准**：五步门禁全绿；截图覆盖空状态、正常结果、不可达、已稳、错误态五个画面；外部请求数为 0（AC-014）。
