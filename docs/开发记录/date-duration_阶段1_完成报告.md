# date-duration — 完成报告

**切片（阶段）**：日期时长计算器（工具 4，slug `date-duration`）全量 T1–T5
**完成时间**：2026-09-23 21:50
**切片完成标准**：用户打开 `/tools/date-duration/`，填起点立即看到天数、周/年月日/工作日分解与里程碑；可复制分享文案、可发链接给他人观览

---

## 完成的任务

| 任务 | 测试 | 验收方式 | 状态 |
|------|------|---------|------|
| T1: 核心计算纯函数（parseDate / computeDuration / computeYearMonthDay / countWeekdays） | 18 个测试（RED→GREEN） | TDD | ✅ |
| T2: 里程碑纯函数（computeMilestones / parseLabel / formatDate / formatNumber / formatShareText / directionFor） | 14 个测试（RED→GREEN） | TDD | ✅ |
| T3: 状态编解码（encodeState / decodeState） | 6 个测试（RED→GREEN） | TDD | ✅ |
| T4: 页面实现 + tools.ts 登记 | 复用以上 38 测试 | agent-browser 实测 | ✅ |
| T5: 门禁与收尾 | — | typecheck + build + 体积测量 | ✅ |

全套 106 测试绿（既有 68 + 新增 38），typecheck 0 错误。

## 浏览器验收汇总（agent-browser 实测，截图存 /tmp/dd-0*.png）

| 场景 | 结果 |
|------|------|
| 空态：终点预填今天、无结果区、Copy 禁用 | ✅ |
| 纪念日：2023-12-27→今天 = 1,001 天 / 143w 0d / 2 年 8 月 27 天 / 工作日 715 + 周末 286 = 1001 | ✅ |
| 里程碑：100/365/500/1000 已过（1000 天 = 2026-09-22，昨天），next=2000 天高亮 in 999 days | ✅ |
| 倒计时：终点 2027-06-15 → 「265 days until June 15, 2027」 | ✅ |
| 自动交换：start>end → 365 天 + 交换提示 + URL 规范化升序 | ✅ |
| 观览模式：带参打开 → 表单隐藏、Make your own 可见 | ✅ |
| 非法参数 ?s=garbage → 安全回退空表单（终点重置今天） | ✅ |
| 标签「Dating」→ 结果区显示 + 复制文案含标签 | ✅ |
| Copy：无头环境剪贴板被拒时降级提示正常（真机路径与 countdown-card 相同，已验证过） | ✅ |

## 文件变更

### 新增
- `src/lib/tools/date-duration/index.ts` — 纯逻辑层（计算 / 里程碑 / 编解码 / 文案）
- `src/lib/tools/date-duration/index.test.ts` — 38 个测试（名称带 AC-xxx）
- `src/pages/tools/date-duration/index.astro` — 工具页
- `specs/features/date-duration.md` / `_技术方案.md` / `_任务规划.md` — s8/s9/s10 产物

### 修改
- `src/lib/shared/tools.ts` — 登记新工具（首页索引出现卡片）

## AC 覆盖进度

AC-001 ~ AC-019 全部满足。AC-016（外部请求 0）由服务器访问日志核实：仅自托管资源，无任何第三方请求。

## 问题与决策

### Astro scoped style 对 JS 运行时创建的元素无效

**情况**：里程碑列表项由 `renderMilestoneItem` 在运行时创建，Astro 的 scoped style（data-astro-cid 属性）不会作用到它们，导致高亮/边框样式静默失效（computed 背景 = transparent）。
**处理**：里程碑列表项样式改用 `<style is:global>` 独立块，并加注释说明原因。
**影响**：后续工具页凡是用 JS 创建元素并要套页面级样式，必须走 is:global 或把样式挂到模板静态元素上。建议在下一次 DESIGN.md 维护时把这条写进 §9 或组件规范。

### 计数口径（BR-001）的实现钉子

totalDays = 本地零点差再 round（吸收 DST 的 23/25 小时日）；工作日 = [start, end) 区间整周公式 + 余数逐日，O(1) 无长循环。测试用 23h/25h 构造 Date 直接钉死 DST 行为，不依赖 CI 时区。

## 技术债务

- parseDate 与 countdown-card 的实现语义相同但各自独立（有意为之：工具互不依赖）；若第 3 次出现同形解析器（工具 5 大概率不需要），再考虑抽 `shared/date`。

---

## 遗留

- 未推送：等用户手动验收后再 push（沿用 countdown-card 流程）。
