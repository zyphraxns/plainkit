/**
 * 判别式联合结果类型。
 *
 * 本项目无后端、无数据库，全部计算在用户浏览器内完成。用户输入错误是
 * 【可预期】的情况，不是异常，因此逻辑层（src/lib/**）一律不抛异常，
 * 而是返回 `Result<T>`，让每个失败路径都能被测试覆盖。
 *
 * 见 specs/DESIGN.md §9.2。
 */
export type Result<T> = { ok: true; value: T } | { ok: false; message: string };

/** 构造一个成功结果。 */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

/**
 * 构造一个失败结果。
 *
 * `message` 必须是可直接展示给用户的英文一句话，说清「哪里错 + 怎么改」，
 * 且不得包含任何技术细节（堆栈、内部变量名、正则、undefined）。
 */
export function err(message: string): Result<never> {
  return { ok: false, message };
}

/** 失败结果的 message 长度上限，防止界面被超长提示撑破。 */
export const MAX_ERROR_MESSAGE_LENGTH = 160;
