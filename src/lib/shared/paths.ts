/**
 * 站内路径工具。
 *
 * 为什么必须有这个函数：本项目同一份代码要部署到两个地方，基路径不同——
 *   Cloudflare Pages（主站）  BASE_PATH=/
 *   GitHub Pages（镜像）      BASE_PATH=/plainkit/
 *
 * Astro 只会给【它自己生成的】资源（例如打包后的 CSS）自动加上基路径；
 * 手写的 `href="/about/"` 不会被加上，在镜像站上会直接 **404**。
 *
 * 所以：所有手写的站内链接、以及 public/ 里静态资源的引用，都必须经过 `href()`。
 *
 * `import.meta.env.BASE_URL` 是构建期常量替换，不触碰 DOM，符合逻辑层的约束。
 */
const BASE_URL = import.meta.env.BASE_URL;

/**
 * 把站内根相对路径转成带部署基路径的路径。
 *
 * @param path 站内根相对路径，可带或不带前导斜杠。例如 `'about/'`、`'/about/'`
 * @returns 带基路径的路径。基路径为 `/` 时原样返回；为 `/plainkit/` 时返回 `/plainkit/about/`
 */
export function href(path: string): string {
  return `${BASE_URL}${path.replace(/^\/+/, '')}`;
}
