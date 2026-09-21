# PlainKit · DESIGN.md（开发规范）

> s5（开发规范）的产物。**这是本项目的「法律法规」——所有实现对话必须遵守。**
>
> 输入依据：[`技术栈.md`](./技术栈.md)、[`项目结构.md`](./项目结构.md)、[`产品概述.md`](./产品概述.md)
>
> 定稿时间：2026-09-21
>
> ---
>
> **给未来的 Agent**：这份文档存在的唯一理由，是让**几十个互不相识的对话**产出一模一样质感的页面。本项目的对话划分是「一个工具一个对话」，新对话不记得上一个工具的任何细节——**所有一致性都靠这份文档承载**。
>
> 本文档中每一条规则要么是「必须」，要么是「禁止」。**不出现「建议」「可以考虑」这类软性表述。** 如果你认为某条规则有问题，先说明理由并询问用户，不要擅自绕过。

---

## 0. 执行总则

### 0.1 这份文档的权威范围

| 冲突情形 | 以谁为准 |
|---|---|
| 本文档 vs 任何 skill 的默认做法 | **本文档** |
| 本文档 vs `技术栈.md` / `项目结构.md` | **本文档**（它是后写的，且更具体） |
| 本文档 vs `产品概述.md` 的硬约束 | **`产品概述.md`**（四条底线不可协商） |
| 本文档 vs 用户当场的明确指示 | **用户**（但要提醒用户这会偏离规范） |

### 0.2 三条不可违反的红线

1. **`src/lib/` 下的任何文件不得出现 `document` / `window` / `navigator` / `localStorage`。**
2. **页面初始化时不得发起任何对外部域名的请求。** 全站外部请求数为 0。
3. **没有失败的测试，就不写实现代码。**（TDD 铁律）

### 0.3 处理 skill 与本文档冲突的已知情形

| 情形 | 处理 |
|---|---|
| s11 / s13 要求用 Playwright MCP 做浏览器验收 | **用 `agent-browser`**，不要装 Playwright |
| s5 要求读 `API设计规范.md` / `数据模型设计.md` | **不适用**，本项目无后端、无数据库，写「当前阶段不适用」 |
| s11 要求三份文档齐全（需求 + 技术方案 + 任务规划） | **保留 s9 / s10 但按最小篇幅做**（各 ≤ 1 页），见 `specs/README.md` §6.1 |

---

## 1. 语言与运行时要求

| 维度 | 规格 |
|---|---|
| 语言 | TypeScript **6.x**，全站 `.ts` / `.astro`。**禁止新增 `.js` 文件** |
| **运行时** | Node.js **24 LTS**（`.nvmrc` 写 `24`；Cloudflare 构建环境变量 `NODE_VERSION=24`；`engines.node` 写 `>=22.12.0`） |
| **包管理器** | **npm**（禁止 pnpm / yarn / bun） |
| **严格模式** | `extends: "astro/tsconfigs/strictest"`，**禁止 `any`** |
| **框架** | Astro 7.x，`output: 'static'`。**禁止改成 `server` / `hybrid`，禁止添加任何 SSR 适配器** |
| **测试** | Vitest 5.x，`environment: 'node'` |
| **格式化** | Prettier 3.x + `prettier-plugin-astro` |
| **Lint** | 无独立 Linter。类型检查（`tsc --noEmit`）+ Prettier 是全部代码质量门禁 |

> **为什么锁 TypeScript 6.x 而不是 7.x**（2026-09-21 实测）：TypeScript 7 的原生编译器**不暴露 `astro check` 依赖的 programmatic API**，装上 7.x 后 `npm run typecheck` 直接报错退出。等 Astro 官方支持后再升（跟踪：`withastro/roadmap` discussion 1321）。**不要为了"用新版"而放弃 `astro check`** —— `.astro` 文件的类型检查只有它能做。

> **关于「没有 Lint 工具」**：这是刻意的。判断标准是——**这个工具能不能被更少的东西替掉？** 本项目是纯函数 + 少量 DOM 绑定，`strictest` 的 TypeScript 已经覆盖了 `no-unused-vars`、隐式 `any`、未处理的 `null` 等绝大部分问题；引入 ESLint 会多一套配置和依赖，而 50 个工具规模下增量收益不足。
>
> **触发条件**：如果出现**一次**因为「类型检查抓不到」而合入的规范违规（风格漂移、死代码），就引入 ESLint 并加进 CI。在那之前不加。

---

## 2. 代码风格与 Lint 规则

### 2.1 工具链

| 工具 | 职责 | 配置文件 |
|---|---|---|
| Prettier | 代码格式化 | `.prettierrc` |
| `astro check` | Astro 文件类型检查 | `tsconfig.json` |
| `tsc --noEmit` | TypeScript 类型检查 | `tsconfig.json` |
| Vitest | 单元测试 | `vitest.config.ts` |
| `.editorconfig` | 编辑器基础一致性 | `.editorconfig` |

### 2.2 Prettier 配置（`.prettierrc`）

```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "bracketSpacing": true,
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-astro"],
  "overrides": [
    {
      "files": "*.astro",
      "options": { "parser": "astro" }
    },
    {
      "files": "*.md",
      "options": { "printWidth": 100, "proseWrap": "preserve" }
    }
  ]
}
```

**关键决策说明**：

- `singleQuote: true` —— TS 里单引号是主流，也与 `import '@/lib/...'` 的写法一致。
- `printWidth: 100` —— 工具逻辑常有较长的函数签名和条件表达式，80 会逼出大量无意义的换行；100 是 Astro / Vite 生态的常见值。
- `trailingComma: "all"` —— 加一行参数不会产生 diff 噪音。
- `endOfLine: "lf"` —— CI 在 Linux 上跑，强制 LF 避免换行符引起的假 diff。

### 2.3 `.prettierignore`

```
dist
node_modules
package-lock.json
specs
docs
public
*.html
```

> `specs` 和 `docs` 里的中文文档不参与格式化——Prettier 会破坏中文换行和 Markdown 排版。

### 2.4 `tsconfig.json`

```jsonc
{
  "extends": "astro/tsconfigs/strictest",
  "compilerOptions": {
    // 不用 baseUrl：它在 TS 6/7 已废弃，会直接报 TS5101 错误。
    // 不写 baseUrl 时，paths 的映射按 tsconfig 所在目录解析。
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

**必须安装 `@types/node`**（devDependency）。否则 `astro.config.mjs` 里的 `process.env` 会报 `TS2591: Cannot find name 'process'`。

### 2.5 `astro.config.mjs`

```js
// @ts-check
import { defineConfig } from 'astro/config';

// 同一份代码、两套部署：Cloudflare Pages 用 '/'，GitHub Pages 镜像用 '/<repo>/'
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  site: 'https://plainkit.app', // 正式域名确定后更新
  base,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // 必须为 'never'：Astro 默认会把小于 4KB 的样式表内联成 <style> 标签，
    // 而我们的 CSP 是 style-src 'self'（不含 'unsafe-inline'），内联样式会被浏览器
    // 拦掉，表现为线上页面「完全没有样式」，且本地开发环境完全看不出问题。
    inlineStylesheets: 'never',
  },
  devToolbar: { enabled: false },
});
```

**禁止**：添加 `@astrojs/cloudflare` / `@astrojs/node` / `@astrojs/react` 等任何集成或适配器。

### 2.6 `vitest.config.ts`

```ts
/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

首行的 `/// <reference types="vitest/config" />` **必需**：`getViteConfig` 返回的是 Vite 的配置类型，不加载这条引用时 `test` 字段会被判为未知属性而报 `TS2353`。

### 2.6.1 关闭 Astro 遥测

构建时 Astro 默认会上报匿名使用数据。**本项目的立场是零追踪，所以构建环境也必须关掉**：

```bash
npx astro telemetry disable
```

CI 里通过环境变量关闭：`ASTRO_TELEMETRY_DISABLED=1`。

### 2.7 `.editorconfig`

```
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

### 2.8 IDE 配置（`.vscode/settings.json`）

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.organizeImports": "never"
  },
  "files.eol": "\n",
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.associations": {
    "*.astro": "astro"
  }
}
```

> `organizeImports` 刻意设为 `never` —— 自动整理导入会悄悄删掉「暂时未使用但正在写」的导入，也会打乱下面 §5.4 规定的分组顺序。

### 2.9 npm scripts（`package.json`）

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "typecheck": "astro check && tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "budget": "node scripts/check-budget.mjs"
  }
}
```

> `budget` 是性能门禁脚本，见 §13.3。

---

## 3. 命名约定

### 3.1 文件与目录命名

| 类型 | 命名风格 | 示例 |
|---|---|---|
| **工具 slug（目录名）** | `kebab-case` | `grade-calculator/` |
| **纯逻辑入口** | 固定为 `index.ts` | `src/lib/tools/grade-calculator/index.ts` |
| **测试文件** | `<模块名>.test.ts`，与模块同目录 | `index.test.ts`、`date-math.test.ts` |
| **Astro 页面** | 目录内 `index.astro` | `src/pages/tools/grade-calculator/index.astro` |
| **Astro 组件** | `PascalCase.astro` | `ToolShell.astro`、`CopyLinkButton.astro` |
| **共享逻辑目录** | `kebab-case` | `src/lib/shared/url-state/` |
| **样式文件** | `kebab-case.css` | `tokens.css`、`base.css` |
| **脚本工具** | `kebab-case.mjs` | `scripts/check-budget.mjs` |

### 3.2 代码命名

| 元素 | 命名风格 | 示例 |
|---|---|---|
| Astro 组件 | `PascalCase` | `CopyLinkButton` |
| 函数 | `camelCase`，**动词开头** | `computeWeightedAverage()`、`parseChemicalFormula()` |
| 变量 | `camelCase` | `finalWeight` |
| 常量 | `SCREAMING_SNAKE_CASE` | `MAX_COURSES`、`CARD_TICK_SPACING` |
| 类型 / 接口 | `PascalCase` | `CourseGrade`、`BalanceResult` |
| 类型参数 | 单个大写字母或 `PascalCase` | `T`、`TInput` |
| 布尔变量 | `is` / `has` / `should` / `can` 前缀 | `isValid`、`hasDuplicateCourses` |
| 事件处理函数 | `handle` + 事件名 | `handleSubmit`、`handleInput` |
| 纯函数返回成功标志 | 判别式字段 `ok` | `{ ok: true, value }` |
| CSS 自定义属性 | `--kebab-case`，按域分组 | `--ink-muted`、`--space-4`、`--accent` |
| CSS 类名 | **BEM 风格的 `block__element`**，无修饰符后缀 | `.tool__head`、`.bench__rule`、`.readout__value` |

> **CSS 类名只有两层**：`block__element`。**不允许 BEM 的 `--modifier` 后缀**，也**不允许工具类**（`.mt-4`、`.flex`）。需要变体和状态样式用属性选择器（`.btn[data-variant='primary']`、`.bench[data-state='empty']`、`[aria-invalid='true']`）。理由：修饰符和工具类会让「同一件事有五种写法」重新出现，而这正是本文档要消灭的东西。

**唯一例外**：`.sr-only`（视觉隐藏但屏幕阅读器可读）。它是可访问性基础设施，不是样式工具类，定义在 `base.css`。

### 3.3 路由命名

| 类型 | 规则 | 示例 |
|---|---|---|
| 首页 | `/` | `/` |
| 工具页 | `/tools/<slug>/`，**目录式，必须带尾斜杠** | `/tools/grade-calculator/` |
| 关于页 | `/about/` | `/about/` |
| URL 状态参数 | **camelCase，全部小写开头，不用缩写** | `?currentGrade=84&targetGrade=90` |

**禁止**：hash 路由（`/#/tools/...`）、SPA 路由、动态路由参数（`[slug]`）、API 路由。

---

## 4. TypeScript 特定规范

### 4.1 类型导入

```ts
// ✅ 正确：类型专用导入，构建后不产生运行时代码
import type { CourseGrade, Result } from '@/lib/tools/grade-calculator';
import { computeWeightedAverage } from '@/lib/tools/grade-calculator';

// ❌ 错误：把类型当值导入，会让本可擦除的导入变成运行时依赖
import { CourseGrade, computeWeightedAverage } from '@/lib/tools/grade-calculator';
```

**规则**：导入清单里**只要有一项是类型，就必须拆成两条 import**，类型那条用 `import type`。

### 4.2 `interface` vs `type`

| 场景 | 偏好 | 原因 |
|---|---|---|
| 对象形状（函数参数、返回值、数据模型） | `interface` | 报错信息可读，可被 `extends` 扩展 |
| Astro 组件的 props | `interface Props`（**名称固定为 `Props`**） | Astro 约定，必须叫这个名字 |
| 联合类型、字面量联合 | `type` | `interface` 表达不了 |
| 函数签名 | `type` | 组合更灵活 |
| 映射类型、条件类型 | `type` | `interface` 表达不了 |

### 4.3 避免的写法（正反对比）

```ts
// ── 1. any ────────────────────────────────────────────────
// ❌ 禁止：any 会静默关掉整条类型链
function parse(input: any) { ... }

// ✅ 正确：用 unknown 接住，再窄化
function parse(input: unknown) {
  if (typeof input !== 'string') return { ok: false, message: 'Expected text.' } as const;
  // 此处 input 已被窄化为 string
}

// ── 2. 非空断言 ────────────────────────────────────────────
// ❌ 禁止：! 是在向编译器撒谎，运行时可能是 undefined
const total = document.querySelector('#total')!.textContent;

// ✅ 正确：显式处理缺失
const totalEl = document.querySelector('#total');
if (!totalEl) return;

// ── 3. 类型断言 ────────────────────────────────────────────
// ❌ 禁止：as 绕过检查（本项目的用户输入不可信，断言等于关掉防线）
const grade = input as CourseGrade;

// ✅ 正确：用类型守卫函数
function isCourseGrade(value: unknown): value is CourseGrade {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).score === 'number'
  );
}

// ── 4. 枚举 ────────────────────────────────────────────────
// ❌ 禁止：enum 会产生运行时代码，且与 erasableSyntaxOnly 冲突
enum GradeLevel { A, B, C }

// ✅ 正确：as const 对象 + 派生联合类型，零运行时代码
const GRADE_LEVELS = ['A', 'B', 'C', 'D', 'F'] as const;
type GradeLevel = (typeof GRADE_LEVELS)[number];

// ── 5. 忽略类型错误 ─────────────────────────────────────────
// ❌ 禁止：@ts-ignore 会永久静默错误，即使错误已被修掉
// @ts-ignore
doSomething(badType);

// ✅ 正确：@ts-expect-error 在错误消失时会自己报错，强制清理
// @ts-expect-error 第三方类型定义缺少该方法，已在 issue #123 跟踪
doSomething(badType);

// ── 6. 抛异常处理可预期的失败 ───────────────────────────────
// ❌ 禁止：用户输入错误是可预期的，不是异常
function parseFormula(text: string): Formula {
  if (!text) throw new Error('Empty input');
  ...
}

// ✅ 正确：返回判别式联合，让每个失败路径都可测（见 §9）
function parseFormula(text: string): Result<Formula> {
  if (!text) return { ok: false, message: 'Enter a chemical formula.' };
  ...
}

// ── 7. 数值精度 ────────────────────────────────────────────
// ❌ 禁止：浮点直接比较
if (average === 89.7) { ... }

// ✅ 正确：用容差比较；对外展示前统一走舍入函数
if (Math.abs(average - 89.7) < 1e-9) { ... }
```

### 4.4 数值与舍入（本项目高频）

- **所有对外展示的数值必须先经过 `src/lib/shared/format/` 里的舍入函数**，禁止在页面里直接 `toFixed()`。
- 内部计算**不得中途舍入**，只在最终展示时舍入。
- 涉及化学计算的工具必须显式处理**有效数字**，规则写在 `chem-balancer` 的技术方案里。

---

## 5. Astro 特定规范

### 5.1 三层职责（本项目最重要的结构规则）

| 层 | 位置 | 允许做的事 | 禁止做的事 |
|---|---|---|---|
| **外壳层** | `src/layouts/BaseLayout.astro` | `<head>`、header、nav、footer、导入 tokens | 出现任何业务文案或计算 |
| **页面层** | `src/pages/**` | 渲染表单与结果结构、把 DOM 值交给 `src/lib/`、把结果画回去 | **出现任何计算公式** |
| **逻辑层** | `src/lib/**` | 全部计算、解析、校验、编码 | 触碰 `document` / `window` / `navigator` |

**判断方法**：打开一个页面文件，如果看到 `+`、`*`、`/`、`%` 参与业务计算（不是索引和拼接），就是放错地方了。

### 5.2 `.astro` 文件结构模板

```astro
---
// 1. 类型导入
import type { CourseGrade } from '@/lib/tools/grade-calculator';

// 2. 依赖导入
import BaseLayout from '@/layouts/BaseLayout.astro';
import { computeWeightedAverage } from '@/lib/tools/grade-calculator';

// 3. 本地类型
interface Props {
  /** 首页卡片上显示的副标题 */
  summary: string;
}

// 4. 组件定义
const { summary } = Astro.props;
const eyebrow = 'Grades';
const title = 'Final Grade Calculator';
---

<!-- 5. 结构：BaseLayout 必须传齐 title / description / tool -->
<BaseLayout title={title} description={summary} tool="grade-calculator">
  <article class="tool">
    <header class="tool__head">
      <p class="eyebrow">{eyebrow}</p>
      <h1 class="tool__title">{title}</h1>
      <p class="tool__lead">{summary}</p>
    </header>

    <section class="bench">
      <div class="bench__rule" aria-hidden="true"></div>
      <!-- 表单与结果 -->
    </section>
  </article>
</BaseLayout>

<!-- 6. 唯一一段脚本，只做 DOM ↔ 纯函数之间的搬运 -->
<script>
  import { computeWeightedAverage } from '@/lib/tools/grade-calculator';
  // ...
</script>

<!-- 7. scoped 样式 -->
<style>
  /* ... */
</style>
```

### 5.3 脚本规则

- **一个工具页面只能有一段 `<script>`。** 多段会让 Astro 产出多个 bundle，且难以判断执行顺序。
- `<script>` 里**禁止出现任何计算公式**——只允许：读 DOM、调用 `@/lib/` 的函数、写 DOM。
- 默认的 `<script>` 会被 Astro 打包为 ES module，天然 deferred。**禁止加 `is:inline`**（会绕过打包、失去类型检查、内联进 HTML 违反 CSP）。
- **禁止使用 `client:*` 指令**——本项目没有任何 UI 框架组件，`client:*` 只会误导后续读者。
- 页面必须在**没有 JS 的情况下依然可读**（表单可见、文案完整）。渐进增强是硬要求，不是加分项。

### 5.4 导入排序

```ts
// 1. 类型导入（import type）
import type { Result } from '@/lib/shared/result';

// 2. 外部依赖（本项目几乎不会出现）
// （空组也保留位置）

// 3. 项目内绝对路径导入（@/ 开头）
import BaseLayout from '@/layouts/BaseLayout.astro';
import { formatNumber } from '@/lib/shared/format';

// 4. 相对路径导入
import { CARD_TICK_SPACING } from './constants';
```

组间**必须空一行**。同一组内按路径字母序。

### 5.5 导出规则

- **只用命名导出（named export）。** Astro 页面文件和 `src/lib/**` 一律禁止 `export default`。
- **唯一例外**：`*.astro` 组件文件通过 Astro 的隐式默认导出机制被导入（`import X from './X.astro'` 是框架要求），这不是我们写的 `export default`，无需处理。

### 5.6 `BaseLayout` 的 props 契约
```ts
interface Props {
  /** 页面标题，会拼到 "· PlainKit" 前。≤ 60 字符 */
  title: string;
  /** meta description。一句话，≤ 155 字符 */
  description: string;
  /** 当前工具 slug，用于高亮导航 + 生成 canonical。首页/关于页不传 */
  tool?: string;
}
```

**这三个 prop 是机械一致性的保证**：`title` 和 `description` 是必填的，类型检查会拦住漏传；`tool` 传入时生成 canonical URL 并给 `<body>` 打上 `data-tool`，供工具级样式钩子和将来更复杂的导航使用。

> 这就是选 Astro 而不是原生 HTML 多页面的原因：**外壳只有一份，槽位由类型系统强制填满。** 50 个工具页不可能各写各的头部。

### 5.7 站内链接必须走 `href()`（**极易漏，且只在镜像站上暴露**）

本项目同一份代码部署到两个基路径不同的地方：

| 部署 | 基路径 |
|---|---|
| Cloudflare Pages（主站） | `/` |
| GitHub Pages（镜像） | `/plainkit/` |

**Astro 只会给「它自己生成的」资源（例如打包后的 CSS）自动加基路径。手写的 `href="/about/"` 不会被加上——在镜像站上直接 404。**

```astro
// ❌ 禁止
<a href="/about/">How this works</a>
<link rel="icon" href="/favicon.svg" />

// ✅ 必须
import { href } from '@/lib/shared/paths';

<a href={href('about/')}>How this works</a>
<link rel="icon" href={href('favicon.svg')} />
```

**这条规则对本项目格外重要**：50 个工具页每个都要写「返回全部工具」的链接，漏一次就是一个 404。

**已经有两道防线**：

1. `scripts/check-budget.mjs` 在 `BASE_PATH != '/'` 时会检查所有根相对 `href` / `src` 是否带基路径前缀，不带就**构建失败**
2. `.github/workflows/deploy-pages.yml` 会用 `BASE_PATH=/<仓库名>/` 构建并跑门禁——**只有子路径构建才暴露这个 bug，主站构建发现不了**

> 记住：这个 bug 在本地 `npm run dev` 和主站上是**完全看不见的**。不要靠"我看过没问题"来判断，必须靠上面两道防线。

---

## 6. 样式规范

### 6.1 唯一样式方案

**原生 CSS + CSS 自定义属性。** 禁止任何 CSS 框架、预处理器、CSS-in-JS。

| 用途 | 位置 |
|---|---|
| 设计令牌（颜色、排版、间距、圆角、动效） | `src/styles/tokens.css` —— 由 `BaseLayout.astro` 导入一次 |
| 全局重置与排版基线 | `src/styles/base.css` —— 同上 |
| 工具私有样式 | 该工具 `.astro` 文件的 `<style>`（**Astro 自动 scoped**） |
| 共享组件样式 | 该组件 `.astro` 文件的 `<style>` |

**禁止**：`<style is:global>`（除了 `tokens.css` 和 `base.css` 通过 import 引入）、`style="..."` 内联属性（CSP 会拦截，见 §17）、`!important`。

### 6.2 禁止的样式写法

```css
/* ❌ 硬编码颜色 —— 必须走 token，否则暗色模式/改色时会漏掉 */
.tool__title { color: #16191A; }

/* ✅ */
.tool__title { color: var(--ink); }

/* ❌ 硬编码间距 —— 破坏垂直节奏的一致性 */
.bench { padding: 18px 22px; }

/* ✅ */
.bench { padding: var(--space-5); }

/* ❌ 工具类思维 —— 本项目禁止工具类 */
.mt-4 { margin-top: 1rem; }

/* ✅ 语义类 + token */
.tool__head { margin-bottom: var(--space-6); }

/* ❌ BEM 修饰符 —— 只允许 block__element 两层 */
.bench--wide { ... }

/* ✅ 用属性选择器表达状态 */
.bench[data-state='empty'] { ... }

/* ❌ !important */
.readout__value { font-size: var(--text-result) !important; }

/* ❌ deep 选择器穿透 scoped 边界 */
:global(.tool) .readout { ... }

/* ❌ 除 tokens.css / base.css 之外的全局样式 */
:root { --my-local-var: 1px; }
```

### 6.3 主题（明暗模式）

**第一版不做暗色模式。**

理由：它会让设计令牌的数量翻倍，而项目当前优先级是 3 个月内验证有人愿意用。令牌已经全部是 CSS 自定义属性，将来加暗色模式 = 在 `tokens.css` 里加一个 `@media (prefers-color-scheme: dark)` 块 + 复核对比度，成本很低。

**硬性要求**：因此**所有颜色必须走 token**（见 §6.2）。任何硬编码颜色都会让将来的暗色模式变成一个找 bug 的项目。

---

## 6-bis. 设计系统

> 这一章不在 s5 模板里，但对本项目是**最关键的一章**。它决定了 50 个工具页看起来是不是同一个产品。
>
> **视觉调性由 `frontend-design` skill 定调，但它的「冒一次美学风险」这条要求被刻意压住了**：本项目要的是**可信赖**，不是大胆。用户是来找一个数字的，不是来欣赏设计的。所有美学判断都必须让位于「一眼看懂、立刻能用、不会怀疑这个站要骗我什么」。

### 6-bis.1 设计论点

**一套工具台。**

产品是「一把量具」。所以视觉语言从**量具本身**取：刻度、基准线、读数。全站只有**一个**结构装置——**刻度规尺**——它标记出「从这里开始是工作区」。工作区之外的一切（标题、说明、页脚）都**不加框**，直接落在页面上。

这条装置同时承担了三件事，所以它不是装饰：

1. 它是**结构**——把「输入区」和「说明区」在视觉上分开，不需要额外加卡片
2. 它是**识别**——每个工具页都长这样，用户第二次来就认得
3. 它是**隐喻**——量具才有刻度，这个站是量具

**刻意不做的事**（都不是疏忽）：

- 不做大 hero、不做营销区、不做 CTA 按钮
- 不做卡片网格堆叠（首页除外，首页是索引）
- 不做渐变、不做阴影、不做装饰性插图、不做图标库
- 不做编号标记（01 / 02 / 03）——工具之间没有顺序关系，编号是假的暗示
- 不做落地页套路

### 6-bis.2 颜色令牌

配色沿用用户在 `everyday-tools-plan.html` 里已经用过的色相家族（青绿 / 蓝 / 琥珀 / 红），但把中性色从暖调（`#f7f7f5`）改成**冷中性**，避免读起来像「米色纸张」这类模板感。

| 令牌 | 值 | 用途 | 对比度（对 `--bg`） |
|---|---|---|---|
| `--bg` | `#FFFFFF` | 页面背景 | — |
| `--surface` | `#F6F7F7` | 工作台底色 | — |
| `--surface-alt` | `#EFF2F1` | 工作台内的次级区块（表头、分栏底） | — |
| `--line` | `#E2E5E4` | 分隔线、输入框边框 | — |
| `--line-strong` | `#C8CECC` | 刻度规尺、需要更明确的边框 | — |
| `--ink` | `#16191A` | 正文、标题 | 17.6:1 ✅ |
| `--ink-muted` | `#5A6360` | 次级说明、字段标签 | 6.1:1 ✅ |
| `--ink-faint` | `#8B928F` | **仅限非必要文字**（页脚、辅助提示） | 3.2:1 ⚠️ |
| `--accent` | `#0F6E56` | 主操作按钮底色、结果读数、当前导航项 | 6.3:1 ✅ |
| `--accent-hover` | `#0B5A46` | 主操作按钮 hover / active | 8.4:1 ✅ |
| `--accent-wash` | `#E6F3EF` | 结果区淡底 | — |
| `--on-accent` | `#FFFFFF` | 主操作按钮上的文字 | 6.3:1 ✅ |
| `--warn` | `#8A530B` | 警告文字 | 6.7:1 ✅ |
| `--warn-wash` | `#FBF0DE` | 警告区底色 | — |
| `--danger` | `#A32D2D` | 错误文字、无效输入边框 | 7.1:1 ✅ |
| `--danger-wash` | `#FBEBEB` | 错误区底色 | — |
| `--focus` | `#0F6E56` | 焦点环（与 accent 同值） | 6.3:1 ✅ |

**硬性规则**：

1. **`--ink-faint` 禁止用于任何必要信息。** 正文、标签、结果、按钮文字一律不得使用。
2. **红色（`--danger`）只用于错误状态**，不得用作强调色。
3. **青绿（`--accent`）是唯一的主色**，用于「主操作」和「结果读数」。一屏之内不得出现两个视觉权重相同的主色元素。
4. 任何新增颜色必须先加进这张表并标注对比度，再使用。

### 6-bis.3 排版令牌

**零 web font。** 使用系统字体栈，全站**一套**字体。

```css
--font-sans:
  -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
  'Noto Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
--font-mono:
  ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
```

个性来自**排版行为**，不来自字体文件。三个刻意的选择：

1. **所有数值输出启用等宽数字** —— `font-variant-numeric: tabular-nums`。数字是产品本身，改一个输入时旁边的数字**不得左右跳动**。
2. **字段标签用仪表标注体** —— 12px、字重 500、`letter-spacing: 0.08em`、`text-transform: uppercase`。这是仪表盘、量具面板的语言，也是本设计「工具台」论点的直接表达。
3. **大字号用负字距** —— 结果读数 `letter-spacing: -0.02em`。系统无衬线在大字号下默认偏松，收紧后显得精密。

| 令牌 | 值 | 用途 | 字重 / 行高 / 字距 |
|---|---|---|---|
| `--text-label` | `12px` | 仪表标注（字段标签、eyebrow、表头） | 500 / 1.4 / `0.08em` / UPPERCASE |
| `--text-xs` | `12px` | 页脚、极小的辅助信息 | 400 / 1.5 / normal |
| `--text-sm` | `14px` | 辅助说明、错误提示、表格内容 | 400 / 1.55 / normal |
| `--text-base` | **`16px`** | 正文、输入框数值、按钮 | 400 / 1.6 / normal |
| `--text-lg` | `18px` | 工具页的 lead 说明 | 400 / 1.55 / normal |
| `--text-xl` | `22px` | 区块标题 | 500 / 1.3 / `-0.01em` |
| `--text-2xl` | `28px` | 工具页主标题 | 600 / 1.2 / `-0.02em` |
| `--text-3xl` | `36px` | 首页标题 | 600 / 1.15 / `-0.02em` |
| `--text-readout` | `clamp(40px, 12vw, 64px)` | **结果读数（唯一的大字号）** | 600 / 1.05 / `-0.02em` / tabular-nums |

**硬性规则**：

1. **输入框字号必须 ≥ 16px。** 低于 16px 时 iOS Safari 会在聚焦时自动放大页面，用户会觉得页面「跳了一下」——这是小工具站在手机上最常翻的车。
2. **一页之内只能有一个 `--text-readout`。** 结果只有一个。
3. **字重只用 400 / 500 / 600。** 禁止 700 及以上（系统字体在 700 下开始显得笨重），禁止 300 及以下（小字号下过细，影响可读性）。
4. 大段文字必须限制行宽，`--measure: 68ch`。

### 6-bis.4 间距、圆角、边框、层叠

```css
/* 间距：4px 基准，只允许用这套刻度 */
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;
--space-4: 16px;  --space-5: 24px;  --space-6: 32px;
--space-7: 48px;  --space-8: 64px;  --space-9: 96px;

/* 圆角：小而一致，不做胶囊 */
--radius-sm: 4px;   /* 输入框、按钮、小控件 */
--radius-md: 8px;   /* 工作台、结果区 */
--radius-lg: 12px;  /* 首页索引卡 */

/* 布局 */
--measure: 680px;      /* 全站唯一内容列宽 */
--page-pad: 20px;      /* 移动端左右内边距 */
--page-pad-lg: 24px;   /* ≥ 640px 时的左右内边距 */

/* 刻度规尺 */
--rule-tick: 12px;     /* 刻度间距 */
--rule-height: 8px;    /* 刻度高度 */

/* 动效 */
--ease-out: cubic-bezier(0.2, 0, 0, 1);
--dur-state: 120ms;    /* 状态反馈（颜色） */
--dur-enter: 180ms;    /* 结果出现（唯一允许的动效） */

/* 层级：全站只用三档，且只用一次 */
--z-base: 0;
--z-sticky: 10;        /* 仅 header */
--z-overlay: 100;      /* 仅「已复制」浮层 */
```

**硬性规则**：

1. **全站只有一个内容列宽 `--measure: 680px`。** header、工具页标题、工作台、页脚全部对齐到它。禁止为某个工具单独放宽——需要更宽的信息用内部网格解决。
2. **禁止出现阴影（`box-shadow`）。** 层级靠底色和边框表达。
3. **禁止 1px 以外的边框宽度。**
4. **间距只能用 `--space-*` 刻度。** 禁止 `13px`、`18px` 这类自由值。

### 6-bis.5 工具台结构模板（**所有工具页必须照这个填**）

```astro
<article class="tool">
  <!-- 1. 头部：eyebrow / 标题 / 一句话说明 -->
  <header class="tool__head">
    <p class="eyebrow">Grades</p>
    <h1 class="tool__title">Final Grade Calculator</h1>
    <p class="tool__lead">What you need on the final to hit your target grade.</p>
  </header>

  <!-- 2. 工作台：唯一带边框的区域，顶边是刻度规尺 -->
  <section class="bench">
    <div class="bench__rule" aria-hidden="true"></div>

    <div class="bench__fields">
      <!-- 字段：每个都必须有 label，禁止用 placeholder 当标签 -->
    </div>

    <!-- 3. 结果读数：一页只能有一个 -->
    <output class="readout" aria-live="polite">
      <p class="readout__label">You need on the final</p>
      <p class="readout__value">78.0</p>
      <p class="readout__note">points to reach an A</p>
    </output>

    <!-- 4. 操作：最多两个，其中一个必须是「复制可分享链接」 -->
    <div class="tool__actions">
      <button type="button" class="btn" data-variant="primary" data-action="copy-link">Copy link</button>
      <button type="button" class="btn" data-action="download-image">Download image</button>
    </div>
  </section>

  <!-- 5. 说明区：无边框，解释怎么算的、边界怎么处理 -->
  <section class="tool__notes">
    <h2 class="tool__notes-title">How this is calculated</h2>
    <!-- ... -->
  </section>
</article>
```

**刻度规尺的实现**（≈200 字节 CSS，零 JS）：

```css
.bench {
  background: var(--surface);
  border: 1px solid var(--line);
  border-top: 0;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  padding: var(--space-5);
}

.bench__rule {
  height: var(--rule-height);
  border-top: 1px solid var(--line-strong);
  background-image: repeating-linear-gradient(
    to right,
    var(--line-strong) 0 1px,
    transparent 1px var(--rule-tick)
  );
}

/* 工作台顶边与规尺之间不能有空隙，否则刻度会「浮起来」 */
.bench__rule { margin: calc(var(--space-5) * -1) calc(var(--space-5) * -1) var(--space-5); }
```

**硬性规则**：

1. **工作台是全站唯一带边框的区域。** 其他任何地方都不加框。
2. **一个工具页只有一个工作台、一个结果读数、最多两个操作按钮。**
3. **每个字段必须有 `<label>`**，`placeholder` 只能给示例，不能替代标签。
4. **操作按钮最多两个，且必须包含一个「复制可分享链接」。** 这是「可分享产物」这条产品硬性要求在设计上的落点。

### 6-bis.6 结果读数的表现

- 读数用 `<output>` 元素，带 `aria-live="polite"`（屏幕阅读器会播报结果变化）。
- 读数数字用 `--accent` 色。**这是全站唯一用主色的文字。**
- 数值必须带单位或说明，不能只扔一个裸数字。
- 精度：默认显示到**有效且必要**的位数（成绩类 1 位小数；天数类整数；化学类按有效数字规则）。

### 6-bis.7 动效规范

**全站只有两类动效，除此之外零动效。**

| 类型 | 属性 | 时长 | 用途 |
|---|---|---|---|
| **状态反馈** | `color` / `background-color` / `border-color` | `--dur-state` (120ms) | 按钮、输入框、链接的 hover / focus / active |
| **结果出现** | `opacity` + `translateY(4px → 0)` | `--dur-enter` (180ms) | 结果读数从无到有 |

**禁止**：滚动触发动画、页面加载动画、骨架屏闪烁、任何循环动画、任何 `@keyframes`（结果出现用 CSS transition 实现）、任何动画库。

**必须**：

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

> 这是全项目**唯一允许使用 `!important`** 的地方。

**结果出现只在「结果首次产生或数值变化」时触发一次。** 用户连续微调输入时不得反复播放。

### 6-bis.8 界面文案规范

文案是设计材料，不是装饰。以下规则对每一句界面文字生效。

| 规则 | ✅ 正确 | ❌ 错误 |
|---|---|---|
| **句式统一用 sentence case**，按钮也一样 | `Copy link` | `Copy Link`、`COPY LINK` |
| **主动语态，说清点下去会发生什么** | `Copy link` | `Submit`、`Go`、`OK` |
| **动作名贯穿全流程** | 按钮 `Copy link` → 提示 `Link copied` | 按钮 `Copy link` → 提示 `Success!` |
| **说结果不说过程** | `78.0 points to reach an A` | `Calculation complete` |
| **不要感叹号、不要卖萌、不要道歉** | `Credit hours must be greater than 0.` | `Oops! Something went wrong 😅` |
| **错误说清「哪里错 + 怎么改」** | `Target grade must be between 0 and 100.` | `Invalid input` |
| **空状态是邀请，不是墓碑** | `Add your first course to start.` | `No data` |
| **不用行话、不用缩写** | `What you need on the final` | `Req. final score` |
| **数字必须带单位** | `217 days` | `217` |
| **界面里不出现营销形容词** | — | `Super fast!`、`Amazing!` |

**英文界面**（第一版）。所有界面文案必须是自然的英文，**不得出现中文**（包括注释以外的任何用户可见文字）。

### 6-bis.9 可访问性硬性要求

这些是质量地板，不是加分项。

1. 所有输入控件有 `<label for>` 关联，或用 `<label>` 包裹。
2. 焦点可见：`:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }`。**禁止 `outline: none`**。
3. 对比度：正文 ≥ 4.5:1，大字号（≥ 18.66px 或 ≥ 24px）≥ 3:1。
4. 键盘可完成整个流程：Tab 顺序 = 视觉顺序。
5. 触控目标 ≥ 44×44px（按钮的实际点击区域，可用 padding 撑开）。
6. `prefers-reduced-motion` 必须被尊重（见 §6-bis.7）。
7. 结果区用 `<output aria-live="polite">`。
8. `<html lang="en">`。
9. 错误提示必须与具体字段关联（`aria-describedby` + `aria-invalid="true"`）。
10. 颜色**不得是唯一的信息载体**（错误同时要有文字说明，不能只靠变红）。

---

## 7. Git 工作流

### 7.1 分支策略

**单人 + AI 实现 + CI 门禁 → 简化 Trunk-Based。**

```
main ──●──●──●──●──●──●──●──●──►   始终可部署
        ╲           ╱
         ●──●──●──●                    分支只用于「需要跨多天的大改动」
```

| 规则 | 说明 |
|---|---|
| **主分支** | `main`，**始终可部署**。推送到 `main` 即触发 Cloudflare Pages 自动部署 |
| **日常改动** | **直接提交到 `main`**，不建分支 |
| **何时建分支** | 仅当改动需要**多次提交、跨越一天以上**时（例如化学配平器的算法主体）。分支名见 §7.2 |
| **分支生命周期** | ≤ 3 天。超过就说明切分得不够小 |
| **合并方式** | **Squash Merge**。主分支历史保持「一个改动一个提交」 |
| **删除分支** | 合并后立即删除 |

> **为什么不强制 PR 流程**：用户不读代码，评审无意义；CI 门禁在 `main` 上同样会跑。PR 只会增加仪式感。

### 7.2 分支命名规范

```
<type>/<short-description>
```

| 类型 | 用途 | 示例 |
|---|---|---|
| `feat/` | 新工具、新能力 | `feat/chem-balancer` |
| `fix/` | Bug 修复 | `fix/leap-year-off-by-one` |
| `refactor/` | 重构 | `refactor/url-state-codec` |
| `style/` | 样式与视觉调整 | `style/readout-spacing` |
| `docs/` | 文档 | `docs/design-tokens` |
| `chore/` | 构建、配置、依赖 | `chore/bump-astro` |

### 7.3 提交信息规范（Conventional Commits）

```
<type>(<scope>): <subject>

[body]

[footer]
```

#### 类型

| 类型 | 说明 |
|---|---|
| `feat` | 新工具、新功能 |
| `fix` | Bug 修复 |
| `refactor` | 重构（不改变外部行为） |
| `style` | 纯样式与视觉调整 |
| `docs` | 文档 |
| `test` | 测试 |
| `chore` | 构建、工具、依赖 |
| `perf` | 性能优化 |
| `ci` | CI / CD 配置 |

#### 作用域（scope）

| scope | 范围 |
|---|---|
| `grade-calculator` | 成绩与目标分数计算器 |
| `countdown-card` | 倒计时 / 纪念日卡片 |
| `chem-balancer` | 化学工具 |
| `date-duration` | 日期时长计算器 |
| `random-grouping` | 随机分组 / 抽签器 |
| `shell` | `BaseLayout`、导航、页脚、首页、关于页 |
| `design` | 设计令牌、全局样式、组件样式 |
| `lib` | `src/lib/shared/` 下的共享逻辑 |
| `specs` | `specs/` 下的文档 |
| `ci` | 工作流、构建配置 |
| `deps` | 依赖升级 |

#### 提交信息规则

- `subject`：**英文**，全小写，祈使句，**结尾不加句号**，≤ 72 字符
- `body`：解释**为什么**，不是**做了什么**。每行 ≤ 100 字符
- `footer`：Issue 引用格式 `Refs: #12` / `Closes: #12`

#### 示例

```
feat(grade-calculator): add reverse target-grade calculation

Solving for the required final score is the reason students open this
tool at all — the forward weighted average is already available in every
school portal. Implemented as a pure function so the edge cases (zero
credit weight, unreachable target) are testable without a browser.

Refs: #3
```

```
fix(date-duration): count leap day in cross-year ranges

The day difference used the year length of the start date, so any range
spanning a February 29 lost one day. Now iterates calendar days instead
of dividing elapsed milliseconds.
```

```
style(design): tighten readout tracking at large sizes

System sans is set loose by default above 36px; -0.02em restores the
precision the instrument-panel direction depends on.
```

### 7.4 提交前必须通过

```bash
npm run format && npm run typecheck && npm test && npm run build && npm run budget
```

任何一步失败，**不提交**。

---

## 8. 代码注释规范

### 8.1 何时写注释

| 需要注释 | 不需要注释 |
|---|---|
| 为什么选这个算法而不是更直观的那个 | 复述代码在做什么 |
| 某个边界值/常量的来源（课本、标准、法规） | `// 声明变量` |
| 看起来是 bug、其实是刻意的写法 | `// 循环数组` |
| 第三方限制、浏览器怪癖的规避原因 | `// 增加计数` |
| 尚未实现但已预留的位置（用 TODO 格式） | 每个函数都写 JSDoc |

### 8.2 注释风格

```ts
// ✅ 解释「为什么」
// 化学方程式的配平解必须是最小正整数解，所以求得有理数解后要除以最大公约数；
// 直接用浮点解会让 H2 + O2 = H2O 这类简单方程得到 1.0 而不是 2。
const coefficients = divideByGcd(rationalSolution);

// ❌ 描述「做了什么」
// 把结果除以最大公约数
const coefficients = divideByGcd(rationalSolution);
```

**导出的纯函数必须有一行 JSDoc 说明它做什么、返回什么、什么时候失败。** 内部辅助函数不强制。

```ts
/**
 * 计算加权平均分。
 *
 * @returns 成功时返回 `{ ok: true, value }`；当总学分为 0 时返回
 *          `{ ok: false, message }`，因为加权平均在数学上未定义。
 */
export function computeWeightedAverage(courses: CourseGrade[]): Result<number> { ... }
```

**语言**：注释用**中文**（便于用户理解边界决策），但**所有用户可见的字符串必须是英文**。

### 8.3 TODO / FIXME / HACK 标记

```ts
// TODO(<scope>): <要做什么> —— <为什么现在不做>
// TODO(chem-balancer): 支持带结晶水的化学式（CuSO4·5H2O）—— 首批只覆盖课本常见形式

// FIXME(<scope>): <问题> —— <触发条件>
// FIXME(random-grouping): 名单超过 500 人时分组耗时超过 100ms —— 需要换成 Fisher-Yates 的分块版本

// HACK(<scope>): <绕过了什么> —— <为什么必须绕过> —— <什么时候能移除>
// HACK(shell): 用 CSSOM 设置刻度间距而非内联 style —— CSP 禁止内联样式 —— 若将来改用外部变量可移除
```

**禁止无归属的 `TODO` / `FIXME` / `HACK`**，必须带 scope。

---

## 9. 错误处理规范

### 9.1 服务端错误处理

**当前阶段不适用，原因：本项目无后端、无 API、无数据库。**

全部代码运行在用户浏览器内，不存在网络错误、服务端错误、数据库错误的处理场景。

### 9.2 逻辑层错误处理（本项目唯一的错误模式）

**`src/lib/` 下的函数不抛异常，返回判别式联合。**

```ts
// src/lib/shared/result.ts
export type Result<T> = { ok: true; value: T } | { ok: false; message: string };
```

**规则**：

1. **任何可能因用户输入而失败的函数，必须返回 `Result<T>`**，禁止 `throw`。
2. `message` 必须是**可直接展示给用户的英文一句话**，说清哪里错、怎么改。
3. **`message` 里不得出现技术细节**（堆栈、内部变量名、正则、`undefined`）。
4. 输入校验集中在**进入逻辑层之前**：页面把原始字符串交给 `src/lib/` 的解析/校验函数，逻辑层只接受已校验的类型。
5. **禁止静默失败**（返回 `undefined` 让调用方猜）。要么 `ok: true`，要么 `ok: false` 带原因。

```ts
// ✅ 正确
export function parseTargetGrade(input: string): Result<number> {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: false, message: 'Enter your target grade.' };

  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { ok: false, message: 'Target grade must be a number.' };
  if (value < 0 || value > 100) {
    return { ok: false, message: 'Target grade must be between 0 and 100.' };
  }

  return { ok: true, value };
}

// ❌ 错误
export function parseTargetGrade(input: string): number {
  const value = Number(input.trim());
  if (value < 0 || value > 100) throw new Error('bad range'); // 用户输入不是异常
  return value;
}
```

### 9.3 客户端错误处理

- **错误就地展示在字段下方**，不用弹窗、不用 toast。
- 错误提示必须与字段关联：`aria-describedby` 指向提示元素，输入框加 `aria-invalid="true"`。
- **用户开始修正时立即清除该字段的错误**，不要等重新提交。
- **一个字段同一时刻只显示一条错误。** 多条错误用优先级：必填 > 格式 > 范围。
- 页面级脚本必须**包一层顶层保护**，任何未预期的错误都不得导致整页白屏：

```ts
try {
  // 初始化
} catch {
  // 失败时页面仍可读（渐进增强的兜底）
  // 不要在界面上暴露任何技术细节
}
```

### 9.4 安全原则

- **永远不在界面中暴露原始错误、堆栈或内部标识符。**
- 客户端校验是为了**即时反馈**，不是安全边界。因为全部计算在本地，**校验必须存在于逻辑层并且必须有测试**（页面上的校验只是它的调用者）。

---

## 10. 测试规范

### 10.1 测试工具

| 工具 | 用途 |
|---|---|
| **Vitest** | 逻辑层纯函数的单元测试（`environment: 'node'`） |
| **`agent-browser` skill** | 浏览器端验收：真实打开页面、真实输入、截图 |
| **禁止** | Playwright、Cypress、jsdom、`@testing-library/*` —— 与 `agent-browser` 验收步骤职责重叠，或违反「逻辑层不碰 DOM」的架构 |

### 10.2 测试优先级

项目阶段：**MVP**（首批 5 个工具尚未上线）。

| 优先级 | 范围 | 要求 |
|---|---|---|
| **P0** | 工具的核心计算 + 全部 AC 中标注的边界情况 | **必须每个都有测试，缺一不可** |
| **P1** | `src/lib/shared/url-state/` 的编解码往返（`decode(encode(x)) === x`） | 必须有测试 |
| **P2** | `src/lib/shared/format/` 的舍入与格式化 | 应有测试 |
| **不做** | Canvas 渲染结果、DOM 交互、样式 | 靠 `agent-browser` 目视验收 |

### 10.3 测试文件位置

```
src/lib/tools/grade-calculator/
├── index.ts            ← 被测代码
└── index.test.ts       ← 测试，与代码同目录

src/lib/shared/date/
├── date-math.ts
└── date-math.test.ts
```

### 10.4 测试命名（**本项目关键的可追溯机制**）

```ts
describe('computeWeightedAverage', () => {
  it('AC-003: weights each course by its credit hours', () => { ... });
  it('AC-004: returns an error when total credits is zero', () => { ... });
  it('AC-004: returns an error when the course list is empty', () => { ... });
});
```

**硬性规则**：

1. **每个 AC 必须至少对应一个测试，且测试名以 `AC-xxx:` 开头。**
2. 一条 AC 有多个边界时**拆成多个测试**，每个测试只验证一个行为。
3. `describe` 用被测函数名，`it` 用行为描述（英文，祈使/陈述句）。
4. **为什么要这么做**：用户不读代码、不做代码评审。测试名里带 AC 编号，用户可以直接 `grep "AC-004"` 看到这条验收标准到底被验证了没有——这是他能抓住的唯一证据链。

### 10.5 TDD 循环

严格按 s11 的 RED → GREEN → REFACTOR：

1. **RED**：先写测试，运行，**必须全部失败**，且失败原因是「功能未实现」。
2. **GREEN**：写最少代码让测试通过。不改测试。
3. **REFACTOR**：在测试保护下整理。每次改动后测试必须通过。

**铁律：没有失败的测试，就不写实现代码。**

### 10.6 验收（Vue 之外的第二道门）

**TDD 通过 ≠ 任务完成。** 有 UI 变化的工具**必须**用 `agent-browser` 打开真实页面验证，并截图给用户。验收清单必须包含「我该输入什么、预期看到什么」。

---

## 11. 依赖管理

### 11.1 安装规范

```bash
# ✅ 正确：装到 devDependencies
npm install --save-dev <package>

# ✅ 正确：CI 里用锁文件安装
npm ci

# ❌ 禁止：任何运行时依赖
npm install <package>              # 不要用 --save / 默认的 dependencies

# ❌ 禁止：全局安装
npm install -g <package>
```

### 11.2 依赖审查

**引入任何新依赖前必须先询问用户。** 包括「只是想省几行代码」的小库。

判断标准，按顺序问：

1. **这个库能不能被 30 行原生代码替掉？** 能，就不加。
2. **它是构建期的还是运行时的？** 运行时的，一律拒绝（`dependencies` 永远为空）。
3. **它会不会让某个页面在初始化时发起外部请求？** 会，一律拒绝。
4. **它有没有维护？** 最后更新时间超过 18 个月，拒绝。
5. **它的协议是什么？** 加入后必须复核 `LICENSE` / `NOTICE` 义务（见 §11.4）。

### 11.3 版本锁定

- **提交 `package-lock.json`。** CI 用 `npm ci`，禁止 `npm install`。
- **依赖版本用插入符范围**（`"astro": "^7.3.3"`），由锁文件保证可复现。
- 升级依赖单独一个提交，scope 用 `deps`，**不与功能改动混在一起**。
- **禁止手动手写版本号**——用 `npm install --save-dev <pkg>` 让它自己解析。

### 11.4 协议合规

- 本项目 **Apache-2.0**。
- **交付前必须复核**：依赖树里是否出现 Apache-2.0 协议的包。出现则把它的 `NOTICE` 内容合并进根目录 `NOTICE`（PROJECT-BRIEF §6.1 第 2 条，最容易漏）。
- 已知 Astro / Vite / Vitest 均为 MIT，MIT 不要求合并 NOTICE。

---

## 12. 环境变量规范

### 12.1 命名规则

| 变量 | 暴露范围 | 用途 |
|---|---|---|
| `BASE_PATH` | **仅构建期** | 部署基路径。Cloudflare 用 `/`，GitHub Pages 用 `/<repo>/` |
| `NODE_VERSION` | **仅构建期（托管平台）** | 固定 Node 大版本为 `24` |

**禁止使用 `PUBLIC_` 前缀的任何变量。**

> 理由：Astro 会把 `PUBLIC_*` 注入到客户端代码。本项目**没有**任何需要出现在浏览器里的配置，一旦允许这个前缀，就会有人把本可以在构建期定死的东西搬到运行时，破坏「零外部请求、零运行时配置」的约束。

### 12.2 文件管理

| 文件 | 用途 | Git 追踪 |
|---|---|---|
| `.env.example` | 列出两个构建期变量及说明 | ✅ 提交 |
| `.env` | 本地覆盖（如有需要） | ❌ 已在 `.gitignore` |
| `.env.local` | 本地个人覆盖 | ❌ 已在 `.gitignore` |

### 12.3 安全红线

1. **本项目没有任何密钥。** 出现任何密钥就说明架构被改坏了——立即停止并询问用户。
2. 代码中**不得硬编码任何 token、API key、密码**。
3. 新增环境变量时**必须同步更新 `.env.example`**。
4. **禁止在客户端代码里读取 `process.env`**（构建期替换之外的使用一律禁止）。

---

## 13. 性能红线

> 项目约定明确：**性能红线由本文档定死**。`frontend-design` 与 `frontend-skill` 都不管性能，所以这是本文档独有的责任，也是不可协商的部分。
>
> 性能不只是「快」——它是产品卖点。首屏速度直接决定留存，也决定 r/InternetIsBeautiful 能不能过审。

### 13.1 预算（硬性上限）

| 指标 | 首页 | 工具页 | 说明 |
|---|---|---|---|
| **JS（gzip）** | **0 字节** | **≤ 10KB** | 首批 5 个工具的目标。**任何工具都不得超过 30KB** |
| **CSS（gzip）** | ≤ 12KB | ≤ 12KB | tokens + base + 该页 scoped |
| **HTML（未压缩）** | ≤ 15KB | ≤ 25KB | |
| **外部域名请求数** | **0** | **0** | 无字体、无 CDN、无分析、无第三方脚本 |
| **总请求数** | ≤ 3 | ≤ 4 | HTML + CSS + JS + favicon |
| **LCP** | < 1.0s | < 1.0s | 中端手机 / 4G |
| **CLS** | < 0.02 | < 0.02 | |
| **INP** | < 100ms | < 100ms | |
| **FCP** | < 0.8s | < 0.8s | |

**首页 JS 严格为 0** —— 首页是纯索引，不得有任何 `<script>`。

### 13.2 不可协商的性能规则

1. **零外部域名请求。** 任何导致页面发起对外请求的改动，一律拒绝。
2. **零 web font。** 只用系统字体栈。
3. **无 JS 时页面必须可读。** 表单可见、文案完整、布局不塌。
4. **图片必须显式声明 `width` / `height`**（防 CLS）。
5. **不得为了视觉效果引入任何体积。** 禁止装饰性插图、图标字体、大图 hero。
6. **第二期的重库（PDF / 图片处理）必须按页面动态引入**，不得进入首页或其他工具的加载路径。

### 13.3 怎么验证（**用户不读代码，所以必须是可机械执行的**）

#### CI 门禁（`scripts/check-budget.mjs`，`npm run budget`）

| 检查 | 判定 |
|---|---|
| 遍历 `dist/**/*.js`，逐个 gzip 后统计 | 首页引用的 JS 总体积必须为 **0**；任一工具页引用的 JS ≤ **10KB** |
| 遍历 `dist/**/*.css` | 单页引用的 CSS ≤ **12KB**（gzip） |
| `grep -rE 'https?://' dist/` | 除自身 `site` 域名、sitemap 命名空间、`robots.txt` 说明外，**零命中** |
| `dist/index.html` 含 `<script` | **零命中**（首页不得有脚本） |

CI 在 `format:check → typecheck → test → build` 之后增加 `budget` 一步，失败即不允许合并。

**脚本本身的两条设计约束**（改脚本时必须遵守）：

1. **外部域名扫描只扫「会发起请求的位置」**：HTML 只取 `src` / `srcset` / `action` 和 `<link>` 的 `href`；CSS 只取 `url()` 与 `@import`；JS 里任何绝对 URL 都报出来。
   **不要退化成「全文扫 `https?://`」**——About 页的说明文字里就写着 `http://localhost:8080`（自托管地址），全文扫描会把它误判成外部请求。**一个天天误报的门禁最终会被关掉，那比没有门禁更糟。**
2. **内联样式必须报错**：`<style>` 标签与 `style="..."` 属性都会被 CSP（`style-src 'self'`）拦掉，必须在构建期就发现，而不是等上线后页面「没有样式」。

**用户可自行复核的验收动作**（不依赖 CI）：

| 动作 | 预期 |
|---|---|
| 打开工具页，在浏览器控制台执行 `performance.getEntriesByType('resource').filter(r => !r.name.startsWith(location.origin))` | 返回**空数组** |
| 打开工具页并禁用 JavaScript | 页面仍可阅读，不存在空白或塌陷的区域 |
| 观察输入框聚焦 | 页面**不放大**（iOS Safari，验证输入框字号 ≥ 16px） |
| 改一个输入值，观察旁边的结果数字 | **数字不左右跳动**（验证 `tabular-nums`） |

### 13.4 性能与设计的冲突怎么裁决

**性能优先。** 如果某个视觉方案会突破 §13.1 的任何一条预算，**砍掉视觉方案，不是放宽预算**。必须在改动说明里写清砍掉了什么、为什么。

---

## 14. AI 协作协议

> 用户不写代码，实现全部由 AI 完成。这一章是给 AI 的作业规程。

### 14.1 写代码前必读

| 任务类型 | 必读 |
|---|---|
| **任何任务** | `specs/README.md`、本文档全文 |
| **新增/修改工具** | `specs/features/<slug>.md`（AC 是唯一验收依据）+ 该工具的 `_技术方案.md` 和 `_任务规划.md` |
| **修改样式** | 本文档 §6 与 §6-bis（设计令牌必须照抄，不得自创） |
| **新增文件** | `specs/项目结构.md`（文件放置规则 + 依赖方向） |
| **改构建/依赖** | `specs/技术栈.md` 第 12 节「明确不采用的东西」 |
| **任何任务** | **同类文件的现有实现**——保持一致比"写得更好"重要 |

### 14.2 写代码的规则

| 规则 | 说明 |
|---|---|
| **读后写** | 修改任何文件前必须先读它 |
| **最小改动** | 只改任务要求的部分，**不做「顺便优化」** |
| **不猜版本** | 安装依赖让包管理器解析版本，不手写版本号 |
| **不引入新依赖** | 任何新依赖都要**先问用户** |
| **不写无意义注释** | 不写复述代码的注释 |
| **不创建多余文件** | 不主动创建文档、配置、示例文件 |
| **遵循现有模式** | 同类代码必须与已有文件写法一致；不一致时**改新的那个** |
| **不自创令牌** | 颜色、间距、字号一律用 §6-bis 已定义的令牌。**需要新值时必须先问用户并加进令牌表** |
| **不用 `style="..."`** | CSP 会拦截；改用 class 或 `el.style.setProperty()` |
| **不用 `innerHTML`** | 一律 `textContent`（见 §17） |
| **数值先格式化再展示** | 展示前必须过 `src/lib/shared/format/` |
| **提交信息规范** | 严格遵循 §7.3 |

### 14.3 写完代码后必做

| 步骤 | 操作 | 不通过怎么办 |
|---|---|---|
| **1. 格式化** | `npm run format` | — |
| **2. 类型检查** | `npm run typecheck` | 修到通过，**禁止用 `any` / `@ts-ignore` 绕过** |
| **3. 测试** | `npm test` | 修实现，**不改测试**（除非确认测试本身写错，并说明理由） |
| **4. 构建** | `npm run build` | 修到通过 |
| **5. 性能门禁** | `npm run budget` | 砍视觉方案，**不放宽预算** |
| **6. 依赖方向自检** | 对照 §16：`src/lib/` 下是否出现 `document`/`window`/`navigator`；`lib/tools/A` 是否 import 了 `lib/tools/B` | 立即重构 |
| **7. 浏览器验收** | 用 `agent-browser` 打开真实页面，按 AC 输入并**截图给用户** | 见 §10.6 |
| **8. 环境变量** | 如有新增，同步 `.env.example` | — |
| **9. AC 覆盖核对** | 逐条核对本次涉及的 AC 是否都有对应测试（测试名带 `AC-xxx`） | 补测试 |

### 14.4 交付给用户时必须附带

用户不读代码。每次交付必须同时给出：

1. **验收清单**：我该输入什么 → 预期看到什么（覆盖正常 + 边界）
2. **截图**：`agent-browser` 的真实页面截图
3. **改了哪些文件**（路径列表）
4. **任何偏离本文档的地方** + 理由

### 14.5 错题本机制

**文件路径：`docs/错题本.md`**（不存在时创建）。

任何以下情况发生后，**必须**追加一条记录：

- 类型检查 / 测试 / 构建失败，且原因属于「规范没写清楚」或「Agent 没遵守」
- 交付后用户指出功能不对
- 违反依赖方向或性能红线被 CI 拦下
- 重复犯了之前犯过的错

记录格式：

```markdown
## YYYY-MM-DD · <一句话标题>

| 项 | 内容 |
|---|---|
| **类型** | 类型错误 / 逻辑错误 / 规范违规 / 依赖错误 / 性能超预算 |
| **现象** | 具体出了什么问题 |
| **根因** | 为什么会犯（**如果是规范没写清，必须写明本文档哪一节需要补充**） |
| **正确做法** | 下次怎么做 |
| **规范修订** | 本文档已补充 §x.y / 无需修订 |
```

> **错题本的真正用途**：当同类错误出现**两次**时，说明该在本文档里加一条硬规则，而不是继续靠 Agent 记住。**第二次出现同类错误时，必须同时修订本文档。**

---

## 15. 目录依赖方向（速查）

```
src/pages/**  ──▶  src/components/**  ──▶  src/lib/**  ──▶  (无外部运行时依赖)
      │                    │                   │
      └────────────────────┴───────────────────┘
                合法方向：从左往右，单向

src/lib/tools/<A>/  ──▶  src/lib/shared/     ✅ 允许
src/lib/tools/<A>/  ──▶  src/lib/tools/<B>/  ❌ 禁止（需要共用就下沉到 shared）
```

**禁止方向**

| 禁止 | 后果 |
|---|---|
| `src/lib/**` → `src/pages/**` | 逻辑层反向依赖界面层，TDD 立即失效 |
| `src/lib/**` → `src/components/**` | 同上 |
| `src/lib/**` → `src/layouts/**` | 同上 |
| `src/lib/tools/A/` → `src/lib/tools/B/` | 工具间耦合，删一个工具会连带崩另一个 |
| `src/lib/shared/` → `src/lib/tools/**` | 共享层反向依赖具体工具 |
| `src/components/**` → `src/pages/**` | 组件反向依赖页面 |
| `src/lib/**` 引用 `document` / `window` / `navigator` / `localStorage` | **违反红线 1**，同时废掉 TDD 与确定性 |

> 详细规则见 [`项目结构.md`](./项目结构.md) §5。

---

## 16. 安全编码规范

> 本项目**无后端、无数据库、无账号**，所以传统 Web 安全清单里大部分不适用。以下是真正相关的部分。
> 但有一条本项目的**独有风险**必须重视：工具会显示用户粘贴的内容（化学式、名单、文本），而**全部渲染发生在用户自己的浏览器里**。

| 类别 | 规则 |
|---|---|
| **输入校验** | 所有用户输入在进入 `src/lib/` 前必须校验；校验逻辑**存在于逻辑层并有测试**（页面上的只是调用者）。校验失败返回 `Result`，不抛异常 |
| **注入防护** | **当前阶段不适用**（无 SQL、无命令执行、无模板渲染到服务端）。**禁止在第二期引入任何服务端数据处理** |
| **XSS** | **禁止 `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write`。** 用户内容一律用 `textContent` 写入。这是本项目最现实的攻击面——用户会粘贴任意文本 |
| **URL 参数注入** | **URL 里的值不可信**（用户会收到别人发来的、带参数的链接）。解码后必须走与手输完全相同的校验路径，不得跳过 |
| **正则安全** | **禁止嵌套量词**（`(a+)+`、`(.*)*` 一类），会引发 ReDoS 让页面卡死。所有正则必须在单个输入上于 50ms 内返回；需要复杂匹配时改用逐字符解析 |
| **密钥管理** | 本项目**没有密钥**。出现密钥即视为架构被改坏，立即停止并询问用户。禁止硬编码任何 token |
| **文件上传** | **第一版无文件上传。** 第二期引入图片/PDF 处理时补规范，届时红线是：文件只在内存中处理，**禁止 `fetch` / `XMLHttpRequest` 到任何地址** |
| **认证检查** | **当前阶段不适用**（无账号、无登录） |
| **资源限制** | 用户可能粘贴超大输入。每个工具必须在技术方案里定义**输入上限**（字符数/条目数），超过即返回 `Result` 错误，防止主线程卡死 |
| **CSP** | `BaseLayout.astro` 必须在生产构建输出 `<meta http-equiv="Content-Security-Policy">`，至少包含：`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'`。**开发环境不输出**（Vite HMR 需要内联脚本与 WebSocket） |
| **完整安全头** | `public/_headers`（Cloudflare Pages 生效）里发同一套 CSP **外加 `frame-ancestors 'none'`**。`frame-ancestors` 与 `X-Frame-Options` 只能通过 HTTP 头设置，写在 `<meta>` 里会被浏览器忽略。GitHub Pages 不支持 `_headers`，会把它当普通文件忽略，那边靠 meta CSP 兜底 |
| **隐私头** | `BaseLayout.astro` 必须输出 `<meta name="referrer" content="no-referrer">` |

**关于 `connect-src 'none'`** —— 这一条值得单独说明：它让**浏览器本身**拒绝页面发起的任何网络连接。也就是说「数据不出设备」不只是我们的承诺，而是**由浏览器强制执行、用户可以自己验证的技术事实**。这是本项目最有说服力的一条技术差异，**不得因为调试方便而放宽**。

---

## 17. 一致性自检表（生成交付物前逐条过）

> 这张表是给 AI 的最后一道闸门。**任何一条打不了勾，就不要交付。**

- [ ] 所有颜色 / 间距 / 字号都来自 §6-bis 的令牌，没有硬编码值
- [ ] 页面用了 §6-bis.5 的工具台结构模板，槽位齐全
- [ ] 一个页面只有一个工作台、一个结果读数、最多两个操作按钮，且含「复制可分享链接」
- [ ] 每个字段都有 `<label>`；输入框字号 ≥ 16px
- [ ] 结果数字带 `tabular-nums`，且带单位
- [ ] 全站文案是英文、sentence case、无感叹号、无营销形容词
- [ ] 错误提示说明了「哪里错 + 怎么改」，且没有技术细节
- [ ] 焦点可见，没写 `outline: none`
- [ ] `prefers-reduced-motion` 已处理
- [ ] `src/lib/` 下没有 `document` / `window` / `navigator`
- [ ] 没有 `innerHTML`
- [ ] 没有 `style="..."` 内联属性
- [ ] **所有站内链接与静态资源引用都走了 `href()`**（见 §5.7，漏了会在镜像站上 404）
- [ ] 每个 AC 都有以 `AC-xxx:` 开头的测试
- [ ] `format` → `typecheck` → `test` → `build` → `budget` 全部通过
- [ ] 已用 `agent-browser` 截图，并给了用户验收清单
