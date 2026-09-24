# random-picker — 阶段 1（完整工具）完成报告

**切片（阶段）**：完整工具（首版全量）
**完成时间**：2026-09-24 12:40
**切片完成标准**：用户打开 `/tools/random-picker/`，粘贴名单一键随机分组 / 抽人 / 随机排序；超限与重名有明确提示；结果可复制文本、可下载带站点标识的 PNG；名单在刷新后自动恢复；首页索引出现该工具。

---

## 完成的任务

| 任务 | 测试 | 验收方式 | 状态 |
|------|------|---------|------|
| T1 纯函数层（splitNames / dedupeNames / parseCount / shuffle / assignGroups / pickNames / formatGroupsText / formatListText） | 21 个测试全部通过（RED→GREEN） | TDD | ✅ |
| T2 卡片绘制（shared/canvas-card 增加 computeGroupCardLayout + drawGroupCard） | 7 个布局测试通过（含 300 人高度增长、超长名截断、3 栏上限） | TDD + 真实导出验证（PNG ~990KB / 高 6940px） | ✅ |
| T3 页面层（index.astro + tools.ts 登记 + localStorage） | typecheck 0 错误 | Chrome headless 按 AC 逐项操作 | ✅ |
| T4 图片导出 + 复制文本 + 重新生成 | 文本格式由 T1 单测覆盖 | toBlob 拦截验证 PNG 生成；复制降级文案验证（headless 无剪贴板权限） | ✅ |
| T5 质量门禁 + 浏览器验收 | format / typecheck / test(130) / build / budget 全绿 | 截图 × 5 存档 | ✅ |

---

## 手动验收汇总

| 验收点 | 结果 |
|--------|------|
| 空状态：Generate 置灰 + 邀请文案 + 无红色错误（AC-010） | ✅ 截图 01 |
| 23 人按 4 组 → 6/6/6/5，名字不重不漏（AC-001） | ✅ 截图 02 + DOM 断言 |
| 每组 3 人 → [3,3,3,3,3,3,3,2]（AC-002） | ✅ DOM 断言 |
| 抽 5/10 → 5 个互不相同（AC-003） | ✅ DOM 断言 + 截图 03 |
| 随机排序 10 人全量打乱（AC-004） | ✅ DOM 断言 |
| 组数 8 > 5 人 → max 钳到 5 + 提示（AC-011） | ✅ |
| 抽 15 > 10 人 → 「must be between 1 and 10」（AC-012） | ✅ 截图 04 |
| 重名提示 + 一键去重保留首次（AC-009） | ✅ |
| 换行/逗号/分号混合输入 → 4 names（AC-008） | ✅ |
| 重新生成 → 新结果整体替换（AC-007） | ✅ innerHTML 对比 |
| 305 人 → 截断 300 + 提示（AC-014）；300 人生成 1ms、卡片高 6940 不截断（AC-013） | ✅ |
| 刷新后名单恢复（AC-016） | ✅ |
| 零外部请求（AC-015） | ✅ performance resource 过滤 = 0 |
| 390px 无横向溢出（AC-018） | ✅ scrollWidth = clientWidth = 390 |

截图存档：`docs/开发记录/random-picker_验收截图/01–05`

---

## 过程中发现并修复的问题

1. **`.bench__error--action` 的 `display:flex` 覆盖 `hidden` 属性**——无重复名字时「Remove duplicates」也可见。修复：补 `[hidden] { display: none }`。
2. **初始空状态显示红色「Enter at least 2 names.」**——违反「未输入不显示错误」约定（grade-calculator 同款问题）。修复：引入 `namesTouched` 标记。
3. **shuffle 的解构交换在 `noUncheckedIndexedAccess` 下类型报错**——改为显式暂存。测试脚本曾误把单选框 `value` 属性覆盖为 `"on"` 导致模式判定异常，排查确认是测试污染而非应用缺陷。

---

## 文件变更

### 新增
- `src/lib/tools/random-picker/index.ts` — 纯逻辑层
- `src/lib/tools/random-picker/index.test.ts` — 21 测试（AC-001/002/003/004/006/008/009/011/012/017 命名）
- `src/pages/tools/random-picker/index.astro` — 工具页
- `specs/features/random-picker.md` / `_技术方案.md` / `_任务规划.md` — 三份规格文档
- `docs/开发记录/random-picker_验收截图/` — 验收截图 × 5

### 修改
- `src/lib/shared/canvas-card/index.ts` — 新增 `computeGroupCardLayout` + `drawGroupCard`（工具 2/5 共用模块）
- `src/lib/shared/canvas-card/index.test.ts` — 新增 7 个布局测试
- `src/lib/shared/tools.ts` — 登记 random-picker（Study 分类）

---

## 遗留事项

- 剪贴板写入在 headless 中被权限拦截，走的是设计的降级文案；真机上「Copied」状态需用户发布后顺手点一次确认（AC-006 的最后一环）。
- 抽卡模拟（游戏模式）按需求文档留待下个迭代，需单独一轮 s8 需求澄清。
