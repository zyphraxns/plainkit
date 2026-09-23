# date-duration — 任务规划（轻量 s10）

> TDD 铁律：每个任务先写失败测试（RED）再实现（GREEN）。≤1 页。
>
> 状态（2026-09-23）：T1–T5 全部完成 ✅

## [x] T1 — 核心计算纯函数

`parseDate` + `computeDuration` + `computeYearMonthDay` + `countWeekdays`。

验证标准（测试用例直接对应 AC）：
- 2026-09-21 → 2026-09-26：totalDays=5、weekdays=5、weekendDays=0（AC-017）
- 2024-02-28 → 2024-03-01：totalDays=2（AC-014）
- 2023-12-27 → 2026-09-23：年月日分解与 weeks+remDays 正确且与 totalDays 自洽（AC-004）
- start=end → 全 0 无异常（AC-010）；end<start → swapped=true 且数值取绝对差（AC-011）
- 跨 DST 固定用例无 ±1（AC-013，用固定时区偏移注入测试，不依赖机器时区）

## [x] T2 — 里程碑纯函数

`computeMilestones` + `parseLabel`。

验证标准：
- 起点 2023-12-27、today 2026-09-23：100/365/500/1000/2000 已过，5000/10000 未到，next=5000 且 daysFromToday 正确（AC-005）
- 起点 2024-02-29 + 365 天 = 2025-02-28（AC-014）
- today 在起点之前（起点在未来）→ 全部未到；`parseLabel` 61 字符截断为 60（AC-018）

## [x] T3 — 状态编解码

`encodeState` / `decodeState` / `formatShareText`。

验证标准：
- encode → decode 往返一致（AC-006）
- 缺参、格式错、多余垃圾参数 → decodeState 返回 null（AC-015）
- 有/无标签两种 shareText 快照断言，均含 plainkit.app（AC-008、AC-009）

## [x] T4 — 页面实现

`src/pages/tools/date-duration/index.astro` + `tools.ts` 登记。

验证标准：
- 空态：终点预填今天、起点空、无结果区（AC-001、AC-012）
- 填起点即算；终点未来措辞 until、今天/过去措辞 since（AC-002、AC-003）
- 里程碑区仅起点在过去时渲染、next 高亮（AC-005）
- URL replaceState 同步；带参打开进观览模式 + Make your own（AC-006、AC-007）
- Copy 按钮写剪贴板（AC-008）；swapped 提示（AC-011）；工作日脚注（AC-017）
- 沿用 grade-calculator 教训：守卫后字段对象、闭包不引用裸 querySelector 返回值

## [x] T5 — 门禁与收尾

验证标准：
- `npm run typecheck` 0 错误；全部测试绿（测试名带 AC-xxx）
- 工具页 JS gzip ≤ 10KB；首页 JS 0；外部请求 0（AC-016、AC-019）
- build 通过、首页索引出现工具卡
