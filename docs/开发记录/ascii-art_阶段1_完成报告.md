# ascii-art（图片 → ASCII 字符画）— 阶段 1 完成报告

**切片（阶段）**：工具 6 完整功能（T1–T5）
**完成时间**：2026-09-24 15:00
**切片完成标准**：用户可以用三种方式（选文件 / 拖拽 / 粘贴截图）导入图片，看到 ASCII 字符画实时预览，调密度 / 字符集 / 反相 / 彩色四项参数，复制纯文本或导出带 `plainkit.app` 标识的 PNG，全程数据不出设备。

---

## 完成的任务

| 任务 | 测试 | 验收方式 | 状态 |
|------|------|---------|------|
| T1: 纯函数层（池化 / 字符映射 / 文本构建） | 17 个测试（AC-003/004/005/006/007/011/013） | TDD | ✅ |
| T2: 画布布局 + 绘制 | 3 个布局测试（AC-008） | TDD + 浏览器目视 | ✅ |
| T3: 页面层 + 三合一输入 | typecheck / build / 无 JS 可读 | 浏览器验收 | ✅ |
| T4: 参数接线 + 复制 + 导出 | — | 浏览器验收 | ✅ |
| T5: 质量门禁 + 浏览器验收 | 全量 150 个测试 | 五步门禁 + agent-browser | ✅ |

**五步门禁**：`format → typecheck（0 errors）→ test（150 passed）→ build → budget` 全绿。
工具页 JS **2.5 KB gzip**（红线 10KB），CSS 3.0 KB，HTML 6.2 KB。

---

## 浏览器验收汇总（agent-browser，截图见 `docs/开发记录/ascii-art_验收截图/`）

| AC | 验证内容 | 结果 |
|---|---|---|
| AC-001 | 空状态点示例图立即出结果 | ✅ 01/03 |
| AC-003 | 密度滑块即时刷新（100→160 columns） | ✅ |
| AC-004 | 三套字符集输出明显不同 | ✅ |
| AC-005 | 反相翻转明暗（背景变实心块） | ✅ 07 |
| AC-006 | 彩色开关同步驱动预览与 PNG | ✅ 08 + 导出物 |
| AC-007 | 复制文本：53 行、行尾无空格、无站点尾巴 | ✅（writeText 替身验证） |
| AC-008 | PNG 导出：彩色、比例正确、plainkit.app 标识 | ✅ /tmp/ac_export.png |
| AC-009 | 上传 .txt → 明确错误 + 原结果保留 | ✅ 05 |
| AC-011 | 透明 PNG 按白底合成 | ✅ 06 |
| AC-014 | 4000×3000 图正常渲染不卡死 | ✅ 11 |
| AC-015 | 未选图时复制/导出置灰 | ✅ |
| AC-016/019 | 外部请求 `[]`（零外部域名请求） | ✅ |
| AC-017 | 正方形图输出正圆（高宽比校正） | ✅ 03 |
| AC-018 | 390px 视口 scrollWidth 386，无横向溢出 | ✅ 10 |

**Headless 无法模拟、留给真机抽查的 3 项**（代码路径已由其他 AC 覆盖）：
- **AC-002 的拖拽与粘贴**：与文件选择共用同一 `loadFile` 路径，文件选择已验证
- **AC-013 EXIF 方向**：实现用 `HTMLImageElement`（浏览器自动按 EXIF 渲染），建议拿真机竖拍照片看一眼
- **AC-010 HEIC 解码失败**：Chrome 能解所有测试图，触发不了该路径；与 AC-009 同一错误 handler

---

## 文件变更

### 新增
- `src/lib/tools/ascii-art/index.ts` — 纯逻辑层：字符集、池化、文本/彩色映射、画布布局与绘制
- `src/lib/tools/ascii-art/index.test.ts` — 20 个测试，测试名带 AC 编号
- `src/pages/tools/ascii-art/index.astro` — 工具页（三合一输入 + 四参数 + 预览 + 导出）
- `public/ascii-sample.svg` — 内置示例图（约 600 字节，点击时才加载，不占首屏请求）
- `specs/features/ascii-art.md` / `ascii-art_技术方案.md` / `ascii-art_任务规划.md` — s8/s9/s10 产物
- `docs/开发记录/ascii-art_验收截图/` — 11 张验收截图

### 修改
- `src/lib/shared/tools.ts` — 登记工具 6（slug `ascii-art`，分类 Fun）

---

## 问题与决策

### 1. 正方形图被画成椭圆（浏览器验收抓到的真 bug）
**情况**：首版 canvas 用正方形格子 + 0.5 行数系数，正方形示例图渲染成椭圆。
**处理**：canvas 改用 2:1 矩形格（等宽字体 advance 0.6em × 行距 1.2 的真实几何），字号按 `格宽/0.6` 反推。现在 canvas、预览、复制文本三者几何一致。
**影响**：`computeAsciiCanvasLayout` / `renderAsciiCanvas` 各改一处，测试仍绿。

### 2. 页面脚本类型收窄失效
**情况**：元素守卫后的类型收窄不会保留进嵌套函数，`astro check` 报一批 null 错误。
**处理**：照 random-picker 的既有模式改为 `view` 对象访问。
**影响**：与既有代码风格一致，无功能影响。

### 3. 技术方案与实现的两处偏差（已同步）
- 池化接口从「亮度/RGB 分开两个函数」合并为 `poolCells`（一次遍历同时产出）
- `cellsToColorArt` 去掉了用不到的 `cols` 参数（strictest 的 noUnusedParameters 拦下）

---

## 技术债务

无新增。遗留三张 headless 测不了的真机抽查项（见上表），不影响发布。
