import { roundTo } from './roundTo';

/**
 * 把分数格式化成固定小数位的展示字符串。
 *
 * 为什么不只是 roundTo：读数要求「恒定保留 1 位小数」（87.5、100.0），
 * `String(roundTo(v))` 会在整数时丢掉小数位。先舍入再固定位数，
 * 两步都收在本函数里，页面不出现裸的 toFixed（DESIGN.md §4.4）。
 *
 * @param value 待展示的数值（内部计算已完成、未舍入）
 * @param digits 小数位数，默认 1
 */
export function formatScore(value: number, digits: number = 1): string {
  return roundTo(value, digits).toFixed(digits);
}
