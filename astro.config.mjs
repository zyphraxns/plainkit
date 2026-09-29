// @ts-check
import { defineConfig } from 'astro/config';

import { BASE_PATH as base, SITE } from './scripts/site.config.mjs';

// 同一份代码、两套部署：
//   Cloudflare Pages（主站）  BASE_PATH=/
//   GitHub Pages（镜像）      BASE_PATH=/<仓库名>/
// 站点地址与基路径的唯一来源在 scripts/site.config.mjs（sitemap 生成脚本也读它）。

export default defineConfig({
  // 用于生成绝对 URL：sitemap.xml / robots.txt 由 scripts/generate-sitemap.mjs 产出。
  // 当前实际访问地址是 GitHub Pages 镜像；正式域名确定后改 site.config.mjs 里的 SITE。
  site: SITE,
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
