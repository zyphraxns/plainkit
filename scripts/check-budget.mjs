#!/usr/bin/env node
/**
 * 性能门禁 —— 规范来源：specs/DESIGN.md §13。
 *
 * 为什么需要这个脚本：性能预算是本项目的产品卖点（首屏速度直接影响留存，也决定能否
 * 通过 r/InternetIsBeautiful 的入场要求），而用户不读代码。所以预算必须是可机械执行的，
 * 不能靠"注意一下"。这个脚本在 CI 里跑，任何一项超标就拒绝合并。
 *
 * 检查项：
 *   1. 首页 JS 必须为 0 字节（首页是纯索引）
 *   2. 任一工具页 JS ≤ 10KB（gzip）；全站硬上限 30KB
 *   3. 单页 CSS ≤ 12KB（gzip）
 *   4. HTML 体积上限（首页 15KB / 其他页 25KB，未压缩）
 *   5. dist 内的 HTML/CSS/JS 不得出现外部域名（零外部请求）
 *   6. 不得内联 <style> 或 style="..."（CSP 是 style-src 'self'，内联会被浏览器拦掉）
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const KB = 1024;

const BUDGET = {
  homeJsBytes: 0,
  pageJsBytes: 10 * KB,
  pageJsHardLimitBytes: 30 * KB,
  cssBytes: 12 * KB,
  homeHtmlBytes: 15 * KB,
  pageHtmlBytes: 25 * KB,
};

/** 允许出现的外部域名。加入任何一项都要先问：它真的不会产生网络请求吗？ */
const ALLOWED_HOSTS = new Set([
  'plainkit.app', // 自身域名，出现在 canonical 与 sitemap 里
  'www.w3.org', // SVG / XML 命名空间，是标识符不是请求
]);

const failures = [];
const notes = [];

function fail(message) {
  failures.push(message);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function gzipBytes(buffer) {
  return gzipSync(buffer).length;
}

function human(bytes) {
  return `${(bytes / KB).toFixed(1)} KB`;
}

function urlToFile(pathname) {
  const decoded = decodeURIComponent(pathname);
  const candidates = [decoded, decoded.replace(/^\/[^/]+/, ''), decoded.split('/').pop()];
  for (const candidate of candidates) {
    const file = join(DIST, candidate);
    try {
      if (statSync(file).isFile()) return file;
    } catch {
      // 继续尝试下一个候选
    }
  }
  return null;
}

function refsIn(html) {
  const refs = [];
  const patterns = [
    { re: /<script[^>]*\ssrc="([^"]+)"/g, kind: 'js' },
    { re: /<link[^>]*\srel="stylesheet"[^>]*\shref="([^"]+)"/g, kind: 'css' },
    { re: /<link[^>]*\shref="([^"]+)"[^>]*\srel="stylesheet"/g, kind: 'css' },
    { re: /<link[^>]*\srel="modulepreload"[^>]*\shref="([^"]+)"/g, kind: 'js' },
  ];
  for (const { re, kind } of patterns) {
    for (const match of html.matchAll(re)) refs.push({ kind, url: match[1] });
  }
  return refs;
}

// ── 主流程 ────────────────────────────────────────────────────────────────

let distFiles;
try {
  distFiles = walk(DIST);
} catch {
  console.error(`✗ 找不到 ${DIST}/ 目录。先跑 npm run build。`);
  process.exit(1);
}

const htmlFiles = distFiles.filter((f) => extname(f) === '.html');
if (htmlFiles.length === 0) {
  console.error(`✗ ${DIST}/ 里没有 HTML 文件，构建产物可能不对。`);
  process.exit(1);
}

// 1–4：逐页面统计体积
for (const htmlFile of htmlFiles) {
  const isHome = relative(DIST, htmlFile).split(sep).join('/') === 'index.html';
  const label = isHome ? '首页 (index.html)' : relative(DIST, htmlFile).split(sep).join('/');
  const html = readFileSync(htmlFile, 'utf8');

  const gzipHtml = gzipBytes(Buffer.from(html));
  const rawHtml = Buffer.byteLength(html);

  let js = 0;
  let css = 0;
  const counted = new Set();

  for (const ref of refsIn(html)) {
    const file = urlToFile(new URL(ref.url, 'http://localhost').pathname);
    if (!file || counted.has(file)) continue;
    counted.add(file);
    const bytes = gzipBytes(readFileSync(file));
    if (ref.kind === 'js') js += bytes;
    else css += bytes;
  }

  notes.push(
    `  ${label.padEnd(34)} JS ${human(js).padStart(8)}   CSS ${human(css).padStart(8)}` +
      `   HTML ${human(rawHtml).padStart(8)}（gzip ${human(gzipHtml)}）`,
  );

  if (isHome) {
    if (js > BUDGET.homeJsBytes) {
      fail(`首页必须 0 字节 JS，实际 ${human(js)}。首页是纯索引，不得有任何 <script>。`);
    }
    if (rawHtml > BUDGET.homeHtmlBytes) {
      fail(`首页 HTML ${human(rawHtml)} 超过上限 ${human(BUDGET.homeHtmlBytes)}。`);
    }
  } else {
    if (js > BUDGET.pageJsHardLimitBytes) {
      fail(`${label} 的 JS ${human(js)} 超过硬上限 ${human(BUDGET.pageJsHardLimitBytes)}。`);
    } else if (js > BUDGET.pageJsBytes) {
      fail(
        `${label} 的 JS ${human(js)} 超过目标 ${human(BUDGET.pageJsBytes)}。` +
          `砍功能或砍依赖，不要放宽预算。`,
      );
    }
    if (rawHtml > BUDGET.pageHtmlBytes) {
      fail(`${label} 的 HTML ${human(rawHtml)} 超过上限 ${human(BUDGET.pageHtmlBytes)}。`);
    }
  }

  if (css > BUDGET.cssBytes) {
    fail(`${label} 的 CSS ${human(css)} 超过上限 ${human(BUDGET.cssBytes)}。`);
  }

  // 6：内联样式会被 CSP（style-src 'self'）拦掉，必须在构建期就发现
  if (/<style[\s>]/i.test(html)) {
    fail(`${label} 含内联 <style> 标签。CSP 是 style-src 'self'，内联样式会被浏览器拦掉。`);
  }
  if (/\sstyle="/i.test(html)) {
    fail(`${label} 含内联 style="..." 属性。CSP 会拦掉，改用 class 或 CSSOM。`);
  }
}

// 5：外部请求扫描
//
// 关键设计：只扫【会发起请求的位置】，不扫散文里的 URL。
// 否则 About 页里那句「自托管后访问 http://localhost:8080」会被误判成外部请求，
// 而一个天天误报的门禁最终会被关掉——那比没有门禁更糟。
//
//   HTML —— 只取 src / srcset / action，以及 <link> 的 href
//   CSS  —— 只取 url(...) 与 @import
//   JS   —— 任何绝对 URL 都值得看一眼（JS 里的 URL 极可能就是网络目标）

const SCANNED_EXTENSIONS = new Set(['.html', '.css', '.js']);
const URL_RE = /https?:\/\/[^\s"'<>()\\]+/g;

function requestUrlsIn(file, text) {
  const urls = [];
  const ext = extname(file);

  if (ext === '.html') {
    const attrRe =
      /(?:\s(?:src|srcset|action)="([^"]+)")|(?:<link[^>]*\shref="([^"]+)")|\ssrcset="([^"]+)"/g;
    for (const match of text.matchAll(attrRe)) {
      for (const value of match.slice(1)) {
        if (value) urls.push(value);
      }
    }
    return urls;
  }

  if (ext === '.css') {
    for (const match of text.matchAll(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g)) urls.push(match[1]);
    for (const match of text.matchAll(/@import\s+['"]([^'"]+)['"]/g)) urls.push(match[1]);
    return urls;
  }

  // .js：任何绝对 URL 都报出来
  return [...text.matchAll(URL_RE)].map((match) => match[0]);
}

for (const file of distFiles) {
  if (!SCANNED_EXTENSIONS.has(extname(file))) continue;
  const text = readFileSync(file, 'utf8');
  for (const raw of requestUrlsIn(file, text)) {
    let host;
    try {
      host = new URL(raw, 'http://localhost').hostname;
    } catch {
      continue;
    }
    if (ALLOWED_HOSTS.has(host) || host === 'localhost') continue;
    fail(
      `${relative(DIST, file)} 引用了外部域名 ${host}。` +
        `全站外部请求数必须为 0。如果它不产生网络请求，把它加进本脚本的 ALLOWED_HOSTS 并说明原因。`,
    );
  }
}

// ── 输出 ──────────────────────────────────────────────────────────────────

console.log('性能门禁（dist 实测）\n');
console.log(notes.join('\n'));
console.log('');

if (failures.length > 0) {
  console.error(`✗ 未通过，共 ${failures.length} 项：\n`);
  for (const message of failures) console.error(`  · ${message}`);
  console.error('\n裁决规则：性能优先。砍掉视觉方案，不要放宽 specs/DESIGN.md §13 的预算。');
  process.exit(1);
}

console.log('✓ 全部通过。');
