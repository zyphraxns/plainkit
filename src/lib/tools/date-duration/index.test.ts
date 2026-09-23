import { describe, expect, it } from 'vitest';

import {
  computeDuration,
  computeMilestones,
  countWeekdays,
  decodeState,
  encodeState,
  formatDate,
  formatNumber,
  formatShareText,
  localMidnight,
  parseDate,
  parseLabel,
} from './index';

/** 以本地时区构造零点 Date，避免测试依赖运行环境的时区偏移。 */
const d = (year: number, month: number, day: number): Date =>
  new Date(year, month - 1, day, 0, 0, 0, 0);

describe('parseDate', () => {
  it('AC-012: rejects an empty input', () => {
    expect(parseDate('')).toEqual({ ok: false, message: 'Enter a start date.' });
  });

  it('AC-015: rejects a non-date string', () => {
    expect(parseDate('soon')).toEqual({ ok: false, message: 'Enter a valid date.' });
  });

  it('AC-015: rejects impossible calendar dates such as February 30', () => {
    expect(parseDate('2027-02-30')).toEqual({ ok: false, message: 'Enter a valid date.' });
  });

  it('accepts a valid ISO date and a leap day in a leap year', () => {
    expect(parseDate('2026-09-23')).toEqual({ ok: true, value: '2026-09-23' });
    expect(parseDate('2024-02-29')).toEqual({ ok: true, value: '2024-02-29' });
  });

  it('rejects a leap day in a non-leap year', () => {
    expect(parseDate('2025-02-29')).toEqual({ ok: false, message: 'Enter a valid date.' });
  });
});

describe('localMidnight', () => {
  it('gives the local midnight of the given date', () => {
    const midnight = localMidnight('2026-09-23');
    expect(midnight.getFullYear()).toBe(2026);
    expect(midnight.getMonth()).toBe(8);
    expect(midnight.getDate()).toBe(23);
    expect(midnight.getHours()).toBe(0);
    expect(midnight.getMinutes()).toBe(0);
  });
});

describe('computeDuration', () => {
  it('AC-002: counts days between a past start and today', () => {
    const result = computeDuration(d(2026, 9, 21), d(2026, 9, 23));
    expect(result.swapped).toBe(false);
    expect(result.totalDays).toBe(2);
  });

  it('AC-004: breaks 2023-12-27 → 2026-09-23 into weeks and calendar parts', () => {
    const result = computeDuration(d(2023, 12, 27), d(2026, 9, 23));
    expect(result.totalDays).toBe(1001);
    expect(result.weeks).toBe(143);
    expect(result.remainingDays).toBe(0);
    expect(result.calendar).toEqual({ years: 2, months: 8, days: 27 });
  });

  it('AC-004: weeks and remaining days always reassemble the total', () => {
    const result = computeDuration(d(2026, 1, 1), d(2026, 9, 23));
    expect(result.weeks * 7 + result.remainingDays).toBe(result.totalDays);
  });

  it('AC-010: reports all zeros when start equals end', () => {
    const result = computeDuration(d(2026, 9, 23), d(2026, 9, 23));
    expect(result.swapped).toBe(false);
    expect(result.totalDays).toBe(0);
    expect(result.weeks).toBe(0);
    expect(result.remainingDays).toBe(0);
    expect(result.calendar).toEqual({ years: 0, months: 0, days: 0 });
    expect(result.weekdays).toBe(0);
    expect(result.weekendDays).toBe(0);
  });

  it('AC-011: swaps automatically when end is before start', () => {
    const result = computeDuration(d(2026, 9, 23), d(2026, 1, 1));
    expect(result.swapped).toBe(true);
    expect(result.totalDays).toBe(265);
    expect(result.calendar).toEqual({ years: 0, months: 8, days: 22 });
  });

  it('AC-013: absorbs a simulated 23-hour day (DST spring forward)', () => {
    const start = d(2026, 3, 8);
    const nextDayPlus23h = new Date(start.getTime() + 23 * 3_600_000);
    expect(computeDuration(start, nextDayPlus23h).totalDays).toBe(1);
  });

  it('AC-013: absorbs a simulated 25-hour day (DST fall back)', () => {
    const start = d(2026, 10, 25);
    const nextDayPlus25h = new Date(start.getTime() + 25 * 3_600_000);
    expect(computeDuration(start, nextDayPlus25h).totalDays).toBe(1);
  });

  it('AC-014: counts 2024-02-28 → 2024-03-01 across a leap day as 2 days', () => {
    const result = computeDuration(d(2024, 2, 28), d(2024, 3, 1));
    expect(result.totalDays).toBe(2);
    expect(result.calendar).toEqual({ years: 0, months: 0, days: 2 });
  });
});

describe('countWeekdays', () => {
  it('AC-017: Mon 2026-09-21 → Sat 2026-09-26 is 5 weekdays and 0 weekend days', () => {
    // [start, end) 区间：周一到周五共 5 天，周六不含在内
    const result = countWeekdays(d(2026, 9, 21), 5);
    expect(result.weekdays).toBe(5);
    expect(result.weekendDays).toBe(0);
  });

  it('AC-017: a full week from Monday to Monday is 5 weekdays and 2 weekend days', () => {
    const result = countWeekdays(d(2026, 6, 1), 7);
    expect(result.weekdays).toBe(5);
    expect(result.weekendDays).toBe(2);
  });

  it('AC-017: weekdays + weekendDays equal the total across a long span', () => {
    const total = 1000;
    const result = countWeekdays(d(2024, 2, 29), total);
    expect(result.weekdays + result.weekendDays).toBe(total);
  });

  it('AC-010: zero days give zero counts', () => {
    const result = countWeekdays(d(2026, 9, 23), 0);
    expect(result.weekdays).toBe(0);
    expect(result.weekendDays).toBe(0);
  });
});

describe('parseLabel', () => {
  it('AC-009: an empty label stays empty', () => {
    expect(parseLabel('')).toBe('');
    expect(parseLabel('   ')).toBe('');
  });

  it('trims surrounding whitespace', () => {
    expect(parseLabel('  Dating  ')).toBe('Dating');
  });

  it('AC-018: truncates labels longer than 60 characters instead of rejecting', () => {
    expect(parseLabel('x'.repeat(80))).toBe('x'.repeat(60));
    expect(parseLabel('x'.repeat(60)).length).toBe(60);
  });
});

describe('computeMilestones', () => {
  // 起点 2026-01-01，今天 2026-09-23：已过 265 天
  const today = d(2026, 9, 23);

  it('AC-005: marks reached tiers as achieved and keeps future ones pending', () => {
    const { items, next } = computeMilestones('2026-01-01', today);
    expect(items).toHaveLength(7);
    expect(items[0]).toMatchObject({ days: 100, date: '2026-04-11', achieved: true });
    expect(items[1]).toMatchObject({ days: 365, date: '2027-01-01', achieved: false });
    expect(items[6]).toMatchObject({ days: 10000, achieved: false });
    expect(next).not.toBeNull();
    expect(next?.days).toBe(365);
    expect(next?.daysFromToday).toBe(100);
  });

  it('AC-005: reports zero days to go for a milestone that is today', () => {
    // 起点 2026-06-15 + 100 天 = 2026-09-23（正好是今天）→ 已达成
    const { items } = computeMilestones('2026-06-15', today);
    expect(items[0]).toMatchObject({ days: 100, date: '2026-09-23', achieved: true });
  });

  it('AC-005: every milestone is pending when the start date is in the future', () => {
    const { items, next } = computeMilestones('2027-01-01', today);
    expect(items.every((milestone) => !milestone.achieved)).toBe(true);
    expect(next?.days).toBe(100);
  });

  it('AC-005: has no next milestone once all tiers are behind', () => {
    const { items, next } = computeMilestones('1990-01-01', today);
    expect(items.every((milestone) => milestone.achieved)).toBe(true);
    expect(next).toBeNull();
  });

  it('AC-014: a Feb 29 start adds days without calendar drift', () => {
    const { items } = computeMilestones('2024-02-29', d(2025, 6, 1));
    // 2024-02-29 + 365 天 = 2025-02-28（2025 不是闰年）
    expect(items[1]).toMatchObject({ days: 365, date: '2025-02-28', achieved: true });
  });
});

describe('formatDate', () => {
  it('formats an ISO date as "Month D, YYYY" in English', () => {
    expect(formatDate('2023-12-27')).toBe('December 27, 2023');
    expect(formatDate('2027-06-15')).toBe('June 15, 2027');
  });
});

describe('formatNumber', () => {
  it('groups thousands the en-US way, deterministically', () => {
    expect(formatNumber(1001)).toBe('1,001');
    expect(formatNumber(217)).toBe('217');
    expect(formatNumber(10000)).toBe('10,000');
  });
});

describe('formatShareText', () => {
  const today = d(2026, 9, 23);

  it('AC-009: builds a neutral sentence with the site mark for a past span', () => {
    const text = formatShareText('2023-12-27', '2026-09-23', '', today);
    expect(text).toBe(
      '1,001 days since December 27, 2023 — that\'s 143 weeks and 0 days. plainkit.app',
    );
  });

  it('AC-008: prefixes the label when one is set', () => {
    const text = formatShareText('2023-12-27', '2026-09-23', 'Dating', today);
    expect(text).toBe(
      'Dating: 1,001 days since December 27, 2023 — that\'s 143 weeks and 0 days. plainkit.app',
    );
  });

  it('AC-003: uses "until" wording when the end date is in the future', () => {
    const text = formatShareText('2026-09-23', '2027-06-15', '', today);
    expect(text).toBe(
      '265 days until June 15, 2027 — that\'s 37 weeks and 6 days. plainkit.app',
    );
  });

  it('AC-009: drops the weeks clause for spans shorter than a week and pluralizes correctly', () => {
    expect(formatShareText('2026-09-22', '2026-09-23', '', today)).toBe(
      '1 day since September 22, 2026. plainkit.app',
    );
  });
});

describe('encodeState / decodeState', () => {
  const full = { start: '2023-12-27', end: '2026-09-23', label: 'Dating' };

  it('AC-006: round-trips a full state through URL params', () => {
    expect(decodeState(encodeState(full))).toEqual(full);
  });

  it('AC-009: round-trips an empty label (the param is omitted entirely)', () => {
    const state = { start: '2026-01-01', end: '2026-09-23', label: '' };
    expect(encodeState(state).get('l')).toBeNull();
    expect(decodeState(encodeState(state))).toEqual(state);
  });

  it('AC-015: returns null when the start param is missing', () => {
    expect(decodeState(new URLSearchParams('e=2026-09-23'))).toBeNull();
  });

  it('AC-015: returns null when the end param is missing', () => {
    expect(decodeState(new URLSearchParams('s=2026-01-01'))).toBeNull();
  });

  it('AC-015: returns null when either date is invalid', () => {
    expect(decodeState(new URLSearchParams('s=2026-02-30&e=2026-09-23'))).toBeNull();
    expect(decodeState(new URLSearchParams('s=2026-01-01&e=nope'))).toBeNull();
  });

  it('AC-018: truncates an over-long label from a tampered link instead of failing', () => {
    const longLabel = 'x'.repeat(80);
    const params = new URLSearchParams(`s=2026-01-01&e=2026-09-23&l=${longLabel}`);
    const decoded = decodeState(params);
    expect(decoded?.label).toBe('x'.repeat(60));
  });
});
