// @ts-check
import { defineConfig } from 'astro/config';

// 同一份代码、两套部署：
//   Cloudflare Pages（主站）  BASE_PATH=/
//   GitHub Pages（镜像）      BASE_PATH=/<仓库名>/
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  // 正式域名确定后更新这里（见 specs/技术栈.md §13）
  site: 'https://plainkit.app',
  base,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // 必须为 'never'：Astro 默认会把小于 4KB 的样式表内联成 <style> 标签，
    // 而我们的 CSP 是 style-src 'self'（不含 'unsafe-inline'），内联样式会被浏览器拦掉，
    // 表现为线上页面「没有样式」，且本地开发完全看不出问题。见 specs/DESIGN.md §16。
    inlineStylesheets: 'never',
  },
  devToolbar: { enabled: false },
});
