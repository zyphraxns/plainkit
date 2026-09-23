import { describe, expect, it } from 'vitest';

import {
  computeCountdown,
  decodeState,
  encodeState,
  formatTargetDate,
  parseDate,
  parseNote,
  parseTheme,
  parseTitle,
} from './index';

describe('parseDate', () => {
  it('AC-010: rejects an empty input with a specific message', () => {
    expect(parseDate('')).toEqual({ ok: false, message: 'Enter a date.' });
  });

  it('AC-010: rejects a non-date string with a specific message', () => {
    expect(parseDate('soon')).toEqual({
      ok: false,
      message: 'Enter a valid date.',
    });
  });

  it('AC-010: rejects impossible calendar dates such as February 30', () => {
    expect(parseDate('2027-02-30')).toEqual({
      ok: false,
      message: 'Enter a valid date.',
    });
  });

  it('accepts a valid ISO date', () => {
    expect(parseDate('2027-06-15')).toEqual({ ok: true, value: '2027-06-15' });
  });

  it('accepts a leap day in a leap year', () => {
    expect(parseDate('2028-02-29')).toEqual({ ok: true, value: '2028-02-29' });
  });

  it('rejects a leap day in a non-leap year', () => {
    expect(parseDate('2027-02-29')).toEqual({
      ok: false,
      message: 'Enter a valid date.',
    });
  });
});

describe('parseTitle', () => {
  it('AC-009: accepts an empty title (the card simply has no title line)', () => {
    expect(parseTitle('')).toEqual({ ok: true, value: '' });
  });

  it('trims surrounding whitespace', () => {
    expect(parseTitle('  Graduation  ')).toEqual({ ok: true, value: 'Graduation' });
  });

  it('rejects titles longer than 60 characters', () => {
    expect(parseTitle('x'.repeat(61))).toEqual({
      ok: false,
      message: 'Title must be 60 characters or fewer.',
    });
  });

  it('accepts a title of exactly 60 characters', () => {
    expect(parseTitle('x'.repeat(60))).toEqual({ ok: true, value: 'x'.repeat(60) });
  });
});

describe('parseNote', () => {
  it('AC-008: accepts an empty note', () => {
    expect(parseNote('')).toEqual({ ok: true, value: '' });
  });

  it('AC-008: rejects notes longer than 80 characters', () => {
    expect(parseNote('x'.repeat(81))).toEqual({
      ok: false,
      message: 'Note must be 80 characters or fewer.',
    });
  });

  it('AC-008: accepts a note of exactly 80 characters', () => {
    expect(parseNote('x'.repeat(80))).toEqual({ ok: true, value: 'x'.repeat(80) });
  });
});

describe('parseTheme', () => {
  it('accepts every defined theme', () => {
    expect(parseTheme('light')).toEqual({ ok: true, value: 'light' });
    expect(parseTheme('midnight')).toEqual({ ok: true, value: 'midnight' });
    expect(parseTheme('warm')).toEqual({ ok: true, value: 'warm' });
  });

  it('AC-015: rejects an unknown theme name', () => {
    expect(parseTheme('neon')).toEqual({
      ok: false,
      message: 'Pick one of the available themes.',
    });
  });
});

describe('computeCountdown', () => {
  // 以本地时区构造 now（2026-09-23 附近），避免测试依赖运行环境的时区设置。
  const now = (month: number, day: number, hour = 12, minute = 0): Date =>
    new Date(2026, month - 1, day, hour, minute, 0, 0);

  it('AC-001: counts down to a future date', () => {
    const result = computeCountdown('2026-09-24', now(9, 23));
    expect(result.mode).toBe('countdown');
    expect(result.days).toBe(1);
    expect(result.headline).toBe('1 day to go');
  });

  it('AC-001: uses plural days for multi-day countdowns', () => {
    const result = computeCountdown('2027-06-15', now(9, 23));
    expect(result.mode).toBe('countdown');
    expect(result.days).toBe(265);
    expect(result.headline).toBe('265 days to go');
  });

  it('AC-002: switches to anniversary mode for a past date', () => {
    const result = computeCountdown('2024-01-01', now(9, 23));
    expect(result.mode).toBe('anniversary');
    expect(result.days).toBe(996);
    expect(result.headline).toBe('996 days ago');
  });

  it('AC-002: uses the singular form for one day ago', () => {
    const result = computeCountdown('2026-09-22', now(9, 23));
    expect(result.mode).toBe('anniversary');
    expect(result.days).toBe(1);
    expect(result.headline).toBe('1 day ago');
  });

  it('AC-003: reports today when the target date is today', () => {
    const result = computeCountdown('2026-09-23', now(9, 23));
    expect(result.mode).toBe('today');
    expect(result.headline).toBe('Today is the day!');
  });

  it('AC-014: gives the same day count at 00:01 and 23:59 of the same day', () => {
    const early = computeCountdown('2027-06-15', now(9, 23, 0, 1));
    const late = computeCountdown('2027-06-15', now(9, 23, 23, 59));
    expect(early.days).toBe(late.days);
    expect(early.mode).toBe(late.mode);
  });
});

describe('formatTargetDate', () => {
  it('formats an ISO date as "Month D, YYYY" in English', () => {
    expect(formatTargetDate('2027-06-15')).toBe('June 15, 2027');
  });

  it('does not shift across months or years', () => {
    expect(formatTargetDate('2026-01-01')).toBe('January 1, 2026');
    expect(formatTargetDate('2026-12-31')).toBe('December 31, 2026');
  });
});

describe('encodeState / decodeState', () => {
  it('AC-006: round-trips a full state through URL params', () => {
    const state = {
      title: 'Graduation',
      date: '2027-06-15',
      theme: 'midnight',
      note: 'Ceremony starts at 10:00.',
    } as const;
    const params = encodeState(state);
    expect(decodeState(params)).toEqual({
      title: 'Graduation',
      date: '2027-06-15',
      theme: 'midnight',
      note: 'Ceremony starts at 10:00.',
    });
  });

  it('AC-009: round-trips a state with empty title and note', () => {
    const state = { title: '', date: '2027-06-15', theme: 'light', note: '' } as const;
    expect(decodeState(encodeState(state))).toEqual(state);
  });

  it('AC-015: returns null when the date param is missing entirely', () => {
    const params = new URLSearchParams('title=Graduation');
    expect(decodeState(params)).toBeNull();
  });

  it('AC-015: returns null when the date param is invalid', () => {
    const params = new URLSearchParams('date=2027-02-30&theme=light');
    expect(decodeState(params)).toBeNull();
  });

  it('AC-015: returns null when the theme param is tampered', () => {
    const params = new URLSearchParams('date=2027-06-15&theme=hacked');
    expect(decodeState(params)).toBeNull();
  });

  it('AC-015: returns null when the note param exceeds the limit', () => {
    const params = new URLSearchParams(`date=2027-06-15&theme=light&note=${'x'.repeat(81)}`);
    expect(decodeState(params)).toBeNull();
  });
});
