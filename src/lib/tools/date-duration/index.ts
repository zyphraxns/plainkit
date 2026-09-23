/**
 * 日期时长计算器——纯逻辑层。
 *
 * 本目录下的文件禁止出现 document / window / navigator / localStorage
 * （DESIGN.md 红线 1）。所有可能因用户输入而失败的函数返回 Result<T>，
 * 不抛异常（DESIGN.md §9.2）。
 *
 * 对应验收标准：specs/features/date-duration.md
 */
import type { Result } from '@/lib/shared/result';
import { err, ok } from '@/lib/shared/result';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const MAX_LABEL_LENGTH = 60;

/** 计算结果的完整形态。天数口径全局为 end − start（BR-001，不含头）。 */
export interface DurationResult {
  /** 输入顺序颠倒时为 true（页面据此显示提示，AC-011） */
  swapped: boolean;
  /** 总天数，恒非负 */
  totalDays: number;
  /** 完整周数（totalDays 向下取整除 7） */
  weeks: number;
  /** 剩余天数（totalDays % 7），weeks × 7 + remainingDays = totalDays */
  remainingDays: number;
  /** 日历分解（整年 / 整月 / 剩余天，按真实月长借位） */
  calendar: DurationCalendar;
  /** 工作日数（[start, end) 内的周一至周五，不扣节假日，BR-002） */
  weekdays: number;
  /** 周末日数（totalDays − weekdays） */
  weekendDays: number;
}

export interface DurationCalendar {
  years: number;
  months: number;
  days: number;
}

export interface WeekdayCounts {
  weekdays: number;
  weekendDays: number;
}

const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * 解析 ISO 日期字符串。
 *
 * 必须是真实日历日期（2027-02-30、平年的 02-29 都算无效）。
 * 与 countdown-card 同一套语义，但保持工具独立、不互相引用。
 */
export function parseDate(input: string, kind: 'start' | 'end' = 'start'): Result<string> {
  const trimmed = input.trim();
  if (trimmed === '') {
    return err(kind === 'start' ? 'Enter a start date.' : 'Enter an end date.');
  }
  if (!ISO_DATE_PATTERN.test(trimmed)) return err('Enter a valid date.');

  const year = Number(trimmed.slice(0, 4));
  const month = Number(trimmed.slice(5, 7));
  const day = Number(trimmed.slice(8, 10));
  const probe = new Date(year, month - 1, day);
  // 构造后回读各分量：越界的日/月会被 Date 进位，回读不一致即为无效日期。
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return err('Enter a valid date.');
  }

  return ok(trimmed);
}

/** YYYY-MM-DD 在本地时区的零点（AC-013 的基础：两边都取零点再相减）。 */
export function localMidnight(iso: string): Date {
  return new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

/**
 * [start, start + totalDays) 区间内的工作日 / 周末日计数。
 *
 * 整周部分用公式（每周恒 5 个工作日），余数部分逐日判断——O(1)，任意
 * 年份跨度都不退化（BR-006）。只排除周六周日，不扣法定节假日（BR-002）。
 */
export function countWeekdays(startMidnight: Date, totalDays: number): WeekdayCounts {
  const fullWeeks = Math.floor(totalDays / 7);
  const remainder = totalDays % 7;

  let weekdays = fullWeeks * 5;
  const startDayOfWeek = startMidnight.getDay(); // 0 = Sunday
  for (let offset = 0; offset < remainder; offset += 1) {
    const dayOfWeek = (startDayOfWeek + offset) % 7;
    if (dayOfWeek !== 0 && dayOfWeek !== 6) weekdays += 1;
  }

  return { weekdays, weekendDays: totalDays - weekdays };
}

/**
 * 日历分解：整年 / 整月 / 剩余天。
 *
 * 按真实月长借位（借位可能跨多个月，用 while 而不是一次减 12），
 * 不做 30.44 天的月均近似。
 */
export function computeYearMonthDay(start: Date, end: Date): DurationCalendar {
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  while (days < 0) {
    months -= 1;
    // end 所在月的前一个月的真实天数（day=0 即上一月最后一天）
    days += new Date(end.getFullYear(), end.getMonth(), 0).getDate();
  }
  while (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days };
}

/**
 * 核心计算：两个日期之间的时长。
 *
 * end 早于 start 时自动交换（AC-011，swapped 置位，不做负数）。
 * 天数 = 两边本地零点之差再 round——round 吸收 DST 造成的 23/25 小时日
 * （AC-013，沿用 countdown-card 验证过的做法）。
 */
export function computeDuration(rawStart: Date, rawEnd: Date): DurationResult {
  const ascending = rawStart.getTime() <= rawEnd.getTime();
  const start = ascending ? rawStart : rawEnd;
  const end = ascending ? rawEnd : rawStart;

  const totalDays = Math.round((end.getTime() - start.getTime()) / MILLISECONDS_PER_DAY);
  const { weekdays, weekendDays } = countWeekdays(start, totalDays);

  return {
    swapped: !ascending,
    totalDays,
    weeks: Math.floor(totalDays / 7),
    remainingDays: totalDays % 7,
    calendar: computeYearMonthDay(start, end),
    weekdays,
    weekendDays,
  };
}

// ── 里程碑（AC-005）──────────────────────────────────────────────────

/** 固定档位：100 天到 10000 天。只做「天」档位，不掺周 / 月 / 年。 */
export const MILESTONE_TIERS = [100, 365, 500, 1000, 2000, 5000, 10000] as const;

export interface Milestone {
  /** 档位天数（起点后第 N 天） */
  days: number;
  /** 对应日期，YYYY-MM-DD */
  date: string;
  /** 该日期是否已经到来（含当天） */
  achieved: boolean;
  /** 距今天多少天：负 = 已过去，0 = 就是今天，正 = 还差 */
  daysFromToday: number;
}

export interface MilestoneSet {
  items: Milestone[];
  /** 第一个未到的里程碑；全部已过时为 null */
  next: Milestone | null;
}

/** 标签：trim 后截断到 60 字符（BR-004）。空串合法（AC-009）。 */
export function parseLabel(input: string): string {
  return input.trim().slice(0, MAX_LABEL_LENGTH);
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** 把 YYYY-MM-DD 格式化为 "December 27, 2023"（en-US，确定性输出）。 */
export function formatDate(iso: string): string {
  const month = MONTHS[Number(iso.slice(5, 7)) - 1];
  const day = Number(iso.slice(8, 10));
  return `${month} ${day}, ${iso.slice(0, 4)}`;
}

/** 千位分节（en-US 逗号），手写实现保证任何运行环境输出一致。 */
export function formatNumber(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 日期加 N 天：走本地日历分量进位，不经过毫秒加法（DST 安全）。 */
function addDays(iso: string, days: number): string {
  const base = localMidnight(iso);
  const moved = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  const month = String(moved.getMonth() + 1).padStart(2, '0');
  const day = String(moved.getDate()).padStart(2, '0');
  return `${moved.getFullYear()}-${month}-${day}`;
}

/**
 * 起点之后的里程碑档位。
 *
 * 每档 = 起点 + N 天（加天不加月，无月末钳位问题）。起点在未来时全部未到；
 * 起点极早时全部已过，next 为 null。
 */
export function computeMilestones(startIso: string, today: Date): MilestoneSet {
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  const items = MILESTONE_TIERS.map((days) => {
    const date = addDays(startIso, days);
    const daysFromToday = Math.round((localMidnight(date).getTime() - todayMidnight) / MILLISECONDS_PER_DAY);
    return { days, date, achieved: daysFromToday <= 0, daysFromToday };
  });

  const next = items.find((milestone) => !milestone.achieved) ?? null;
  return { items, next };
}

// ── 措辞与分享文案（AC-003 / AC-008 / AC-009）────────────────────────

export type DurationDirection = 'since' | 'until';

/**
 * 措辞判定：终点在今天或更早 → since（引用起点日期）；终点在未来 → until（引用终点日期）。
 * 交换后 end ≥ start，所以「end ≤ today」时两个日期都在过去，「since 起点」语义正确。
 */
export function directionFor(endIso: string, today: Date): DurationDirection {
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return localMidnight(endIso).getTime() <= todayMidnight ? 'since' : 'until';
}

function plural(count: number, unit: 'day' | 'week'): string {
  return count === 1 ? `1 ${unit}` : `${formatNumber(count)} ${unit}s`;
}

/**
 * 可分享的英文句子，结尾带站点标识（AC-008）。
 *
 * 有标签时以「Label: 」开头，无标签用中性措辞（AC-009）。
 * 不足一周时省略周数从句；天数恒用千位分节。
 */
export function formatShareText(
  startIso: string,
  endIso: string,
  label: string,
  today: Date,
): string {
  const { totalDays, weeks, remainingDays } = computeDuration(localMidnight(startIso), localMidnight(endIso));
  const direction = directionFor(endIso, today);

  const core =
    direction === 'since'
      ? `${plural(totalDays, 'day')} since ${formatDate(startIso)}`
      : `${plural(totalDays, 'day')} until ${formatDate(endIso)}`;

  const weeksClause =
    weeks > 0 ? ` — that's ${formatNumber(weeks)} weeks and ${remainingDays} days` : '';
  const labelPrefix = label === '' ? '' : `${label}: `;

  return `${labelPrefix}${core}${weeksClause}. plainkit.app`;
}

// ── URL 状态编解码（AC-006 / AC-015 / AC-018）────────────────────────

/** 工具的完整可分享状态，也是 URL 参数的编解码对象。 */
export interface DateDurationState {
  /** 规范化的 YYYY-MM-DD */
  start: string;
  /** 规范化的 YYYY-MM-DD */
  end: string;
  /** 可为空串：空 = 中性文案（AC-009） */
  label: string;
}

/** 把状态编码进 URL 参数。s / e 恒写入，l 为空则省略。 */
export function encodeState(state: DateDurationState): URLSearchParams {
  const params = new URLSearchParams();
  params.set('s', state.start);
  params.set('e', state.end);
  if (state.label !== '') params.set('l', state.label);
  return params;
}

/**
 * 从 URL 参数解码状态。
 *
 * 链接会被转发、参数可能被篡改（DESIGN §16：URL 里的值不可信），所以
 * 两个日期都走与手输完全相同的 parse 路径。任何一步失败——包括参数
 * 整体缺失——都返回 null，调用方据此回退到默认空状态（AC-015）。
 * 标签不校验只截断：被改长的链接不应失效（AC-018）。
 */
export function decodeState(params: URLSearchParams): DateDurationState | null {
  const rawStart = params.get('s');
  if (rawStart === null) return null;
  const start = parseDate(rawStart, 'start');
  if (!start.ok) return null;

  const rawEnd = params.get('e');
  if (rawEnd === null) return null;
  const end = parseDate(rawEnd, 'end');
  if (!end.ok) return null;

  return { start: start.value, end: end.value, label: parseLabel(params.get('l') ?? '') };
}
