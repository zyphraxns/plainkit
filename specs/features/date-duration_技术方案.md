# date-duration — 技术方案（轻量 s9）

> 遵循 date-calculator 系既有模式：页面只做 DOM↔纯函数搬运，纯函数全部可测。≤1 页。

## 目录

- `src/lib/tools/date-duration/`（纯函数，全部带单测）
- `src/pages/tools/date-duration/index.astro`（复用 grade-calculator / countdown-card 工具台模板）

## 纯函数清单

| 函数 | 输入 → 输出 | 说明 |
|---|---|---|
| `parseDate(input: string): Date \| null` | `"YYYY-MM-DD"` → 本地零点 Date \| null | 格式不符返回 null；沿用 countdown-card 的 parseDate 模式（不复制粘贴共享，保持工具独立） |
| `computeDuration(rawStart: Date, rawEnd: Date): DurationResult` | 两个本地零点 Date → 结果对象 | **内部先规范化**：若 end < start 则交换（`swapped: true`）；totalDays = round((end−start)/86400000)（round 吸收 DST，BR-005）；含 totalDays / weeks+remDays / 年月日分解 / weekdays / weekendDays / swapped / direction 措辞所需信息 |
| `computeYearMonthDay(start, end): { years, months, days }` | 同上 → 日历分解 | 标准借位算法：先整年、再整月、剩余天（月长按实际，不做 30.44 近似） |
| `countWeekdays(start, end): { weekdays, weekendDays }` | 同上 → 计数 | 统计 [start, end) 区间：周一~五为 weekday。实现用整周数 + 余数公式（区间可能极长，避免逐日循环 O(n) 风险；n 上限约 365 万天 < 50ms，逐日也可接受，以公式优先、测试对照为准） |
| `computeMilestones(start: Date, today: Date): Milestone[]` | 过去时起点 + 今天 → 7 档数组 | 档位 [100, 365, 500, 1000, 2000, 5000, 10000]；每项 = { days, date: start+days, achieved: date ≤ today, daysFromToday }；`next` = 第一个未到的 |
| `parseLabel(input: string): string` | 任意字符串 → ≤60 字符标签 | trim + 截断 60（BR-004） |
| `encodeState(state): string` | {start, end, label} → URL query | 沿用 countdown-card 参数风格：`s=YYYY-MM-DD&e=…&l=…` |
| `decodeState(params): State \| null` | URLSearchParams → State \| null | 任一步失败（缺参/格式错）→ null，调用方回退空表单（AC-015） |
| `formatShareText(state, result): string` | 状态+结果 → 英文句子 | 有标签含标签，无标签中性措辞；结尾带 PlainKit |

## 边界处理表

| 边界 | 处理 | 对应 AC |
|---|---|---|
| start = end | totalDays=0，分解全 0 | AC-010 |
| end < start | 交换 + swapped 提示 | AC-011 |
| start 空/无效 | 页面层不渲染结果区 | AC-012 |
| 跨 DST | 本地零点对齐 + round | AC-013 |
| 闰年 / 2-29 起点 | 日期加法天然正确（加天不加月），测试钉死 2-28→3-1=2 天、2-29+365=2025-02-28 | AC-014 |
| URL 参数非法 | decodeState → null → 空表单 | AC-015 |
| 标签 >60 | parseLabel 截断 | AC-018 |
| 极大年份跨度 | 公式法 weekday 计数 O(1)，Date 支持范围 1970±27 万年，足够 | — |

## 措辞判定（页面层）

- 终点（规范化后）= 今天或更早 → `N days since <start>`
- 终点在未来 → `N days until <end>`
- 标签存在时作为主语插入标题，如 `Together 1,000 days`

## 不引入

无新依赖、无新色板令牌、无 canvas——全部复用现有模板与 tokens。
