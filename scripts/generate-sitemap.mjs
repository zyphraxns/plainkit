#!/usr/bin/env node
/**
 * 构建后生成 sitemap.xml，并给 robots.txt 加上 Sitemap 声明。
 *
 * 为什么自己写而不装 @astrojs/sitemap：只需要「把目录式 URL 列出来」这一件事，
 * 约 60 行、零依赖即可完成；本项目 `dependencies` 必须永远为空（见 specs/项目结构.md）。
 *
 * 规范约束：
 *   - 纯静态产物，不产生任何运行时网络请求（sitemap 里只有本站 URL）
 *   - 输出确定性：URL 排序固定，lastmod 优先取 SOURCE_DATE_EPOCH，便于可复现构建
 *   - 不碰页面文件本身，只新增 sitemap.xml 并改写 robots.txt
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { siteRoot } from './site.config.mjs';

const DIST = 'dist';

/** 递归收集 dist 下的页面：目录式 URL = 每个 index.html 所在目录 + 尾斜杠。 */
function collectPages(dir) {
  const pages = [];
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (entry !== 'index.html') continue;
      const dirPath = relative(DIST, current).split(sep).join('/');
      pages.push(dirPath === '' ? '/' : `/${dirPath}/`);
    }
  };
  walk(dir);
  return pages.sort();
}

/** 输出日期：优先 SOURCE_DATE_EPOCH（可复现构建），否则用今天。 */
function lastmod() {
  const epoch = process.env.SOURCE_DATE_EPOCH;
  const date = epoch ? new Date(Number(epoch) * 1000) : new Date();
  return date.toISOString().slice(0, 10);
}

function main() {
  if (!existsSync(DIST)) {
    console.error(`generate-sitemap: ${DIST} does not exist — run \`npm run build\` first`);
    process.exit(1);
  }

  const root = siteRoot();
  const date = lastmod();
  const pages = collectPages(DIST);

  const urls = pages
    .map(
      (path) =>
        `  <url>\n    <loc>${root}${path.replace(/^\//, '')}</loc>\n    <lastmod>${date}</lastmod>\n  </url>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  writeFileSync(join(DIST, 'sitemap.xml'), xml);

  const robotsPath = join(DIST, 'robots.txt');
  const existing = existsSync(robotsPath)
    ? readFileSync(robotsPath, 'utf8')
    : 'User-agent: *\nAllow: /\n';
  const withoutSitemap = existing
    .split('\n')
    .filter((line) => !line.toLowerCase().startsWith('sitemap:'))
    .join('\n')
    .replace(/\n+$/, '');
  writeFileSync(robotsPath, `${withoutSitemap}\n\nSitemap: ${root}sitemap.xml\n`);

  console.log(`generate-sitemap: ${pages.length} pages → ${root}sitemap.xml`);
}

main();
