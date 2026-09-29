/**
 * 站点地址与部署基路径的单一来源。
 *
 * astro.config.mjs 与 scripts/generate-sitemap.mjs 都从这里读，避免「两处各写一遍
 * 域名」这种迟早会漂的配置。
 *
 * 自托管时改 SITE（并按需设 BASE_PATH 环境变量），sitemap 与 robots 会自动跟着变。
 */
export const SITE = 'https://zyphraxns.github.io';
export const BASE_PATH = process.env.BASE_PATH ?? '/';

/**
 * 站点根 URL（带尾斜杠），例如 https://zyphraxns.github.io/plainkit/ 。
 * 用字符串拼接而不是模板字符串：astro.config.mjs 会 import 本文件，而 Astro 加载配置时
 * 走的解析器（rolldown）在模板字符串上会解析失败。
 */
export function siteRoot() {
  const trimmed = BASE_PATH.replace(/^\/+|\/+$/g, '');
  const base = trimmed === '' ? '/' : '/' + trimmed + '/';
  return SITE + base;
}
