/**
 * 展示前舍入。
 *
 * DESIGN.md §4.4：所有对外展示的数值必须先经过这里，禁止在页面里直接
 * `toFixed()`；内部计算不得调用本函数中途舍入。
 *
 * @param value 待舍入的数值
 * @param digits 保留的小数位数（0–2 足够本站所有工具使用）
 */
export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
