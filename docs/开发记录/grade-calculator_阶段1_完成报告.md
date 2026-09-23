# grade-calculator — 阶段 1（完整工具）完成报告

**切片（阶段）**：完整工具（首版全量）
**完成时间**：2026-09-23 17:50
**切片完成标准**：用户打开 `/tools/grade-calculator/`，填三个数字立刻看到「期末要考多少分」；不可达/已稳有明确提示；Copy link 生成的链接打开后还原同样的输入与结果；首页索引出现该工具。

---

## 完成的任务

| 任务 | 测试 | 验收方式 | 状态 |
|------|------|---------|------|
| T1 纯函数层（roundTo / formatScore / parse×3 / computeRequiredFinal） | 26 个测试全部通过（RED→GREEN） | TDD | ✅ |
| T2 状态编解码（encodeState / decodeState） | 4 个测试全部通过 | TDD（实现先于测试，见问题 1） | ✅ |
| T3 页面层（index.astro + tools.ts 登记） | typecheck 0 错误 | Chrome headless 截图 × 5 | ✅ |
| T4 Copy link 按钮 | — | 按钮状态随结果启用/禁用（截图核对）；剪贴板写入需真机手动验证 | ✅ |
| T5 质量门禁 + 浏览器验收 | format / typecheck / test / build / budget 全绿 | 预算：工具页 JS gzip 1.6KB（≤10KB），首页 JS 0 | ✅ |

---

## 手动验收汇总

| 验收点 | 结果 |
|--------|------|
| 空状态：三字段 + 邀请文案 + 无错误（AC-001/015） | ✅ 截图 01 |
| 75/40/80 → 读数 87.5「to reach an overall grade of 80.0」（AC-002/005） | ✅ 截图 02 |
| 84/30/90 → 「Not reachable / 88.8 / even with a perfect 100」（AC-009） | ✅ 截图 03 |
| 90/10/80 → 「Already secured / 0.0 / Even a 0 keeps you at 80.0+」（AC-010） | ✅ 截图 04 |
| `?currentGrade=abc` → 字段红色边框 + 「Current grade must be a number.」+ 读数回邀请态（AC-006/011） | ✅ 截图 05 |
| 零外部请求（AC-014） | ✅ budget 门禁扫描 0 命中 |

截图存档：`/tmp/grade-screens/01-empty.png` … `05-invalid.png`

---

## 文件变更

### 新增
- `src/lib/tools/grade-calculator/index.ts` — 纯逻辑：parse×3 + computeRequiredFinal + encodeState/decodeState
- `src/lib/tools/grade-calculator/index.test.ts` — 18 测试（AC-002/006/007/008/009/010/013 命名）
- `src/lib/tools/grade-calculator/state.test.ts` — 4 测试（AC-005/011 命名）
- `src/lib/shared/format/`（index.ts / roundTo.ts / formatScore.ts / index.test.ts）— 展示舍入
- `src/pages/tools/grade-calculator/index.astro` — 工具页

### 修改
- `src/lib/shared/tools.ts` — 登记 grade-calculator（首页索引生效）
- `specs/features/grade-calculator_技术方案.md` — 补记 formatScore 偏差

---

## AC 覆盖进度

| AC 编号 | 状态 | 说明 |
|---------|------|------|
| AC-001 / 002 / 003 / 006 / 007 / 008 / 009 / 010 / 011 / 013 | ✅ | 单测 + 截图 |
| AC-005 | ✅ | URL 预填由截图 02–05 证实（预填即走同一路径） |
| AC-012 | ✅ | 实时重校验：错误始终反映当前值（input 事件路径） |
| AC-004 | ⚠️ | 按钮启用/禁用已截图核对；**剪贴板实际写入请在真机点一次验证**（headless 无法可靠测剪贴板） |
| AC-014 / 015 / 016 | ✅ | 门禁扫描 0 外部请求；静态 HTML 完整可读；读数带上下文 |

---

## 问题与决策

### 1. T2 实现先于测试（违反 TDD 铁律）

**情况**：encodeState/decodeState 在 T1 GREEN 时被顺手实现，之后才补测试。
**处理**：测试补齐并全部通过；已记入 `docs/错题本.md`。不采用「删掉实现假装 RED」的表演式补救。
**影响**：下一个工具（countdown-card）的 TDD 执行要更严格按任务切分。

### 2. TS strictest 的闭包窄化

**情况**：`if (!(x instanceof HTMLInputElement)) throw` 守卫后，嵌套函数里直接引用 `x` 仍报 possibly-null——窄化不进闭包。
**处理**：守卫后立即创建字段对象（`currentField = { input: x, ... }`），闭包只引用对象属性。
**影响**：后续工具页脚本沿用这个结构。

### 3. formatScore 超出技术方案原清单

**情况**：AC-013 要求读数恒定 1 位小数（100.0 而非 100），roundTo 不够。
**处理**：`shared/format` 增加 formatScore（先 roundTo 再固定位数），页面不出现裸 toFixed；技术方案文档已同步。
**影响**：无。

---

## 技术债务

- 无。已知边界：AC-004 剪贴板真机验证遗留用户手动确认（不阻塞交付）。
