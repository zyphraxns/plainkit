import { describe, expect, it } from 'vitest';

import {
  computeRequiredFinal,
  parseCurrentGrade,
  parseFinalWeight,
  parseTargetGrade,
} from './index';

describe('parseCurrentGrade', () => {
  it('AC-006: rejects an empty input with a specific message', () => {
    expect(parseCurrentGrade('')).toEqual({
      ok: false,
      message: 'Enter your current grade.',
    });
  });

  it('AC-006: rejects non-numeric input with a specific message', () => {
    expect(parseCurrentGrade('abc')).toEqual({
      ok: false,
      message: 'Current grade must be a number.',
    });
  });

  it('AC-007: rejects values below 0', () => {
    expect(parseCurrentGrade('-5')).toEqual({
      ok: false,
      message: 'Current grade must be between 0 and 100.',
    });
  });

  it('AC-007: rejects values above 100', () => {
    expect(parseCurrentGrade('120')).toEqual({
      ok: false,
      message: 'Current grade must be between 0 and 100.',
    });
  });

  it('accepts a valid value with surrounding whitespace and decimals', () => {
    expect(parseCurrentGrade(' 84.5 ')).toEqual({ ok: true, value: 84.5 });
  });

  it('accepts 0 and 100 as boundaries', () => {
    expect(parseCurrentGrade('0')).toEqual({ ok: true, value: 0 });
    expect(parseCurrentGrade('100')).toEqual({ ok: true, value: 100 });
  });
});

describe('parseTargetGrade', () => {
  it('AC-006: rejects an empty input', () => {
    expect(parseTargetGrade('')).toEqual({
      ok: false,
      message: 'Enter your target grade.',
    });
  });

  it('AC-007: rejects out-of-range values with the field name in the message', () => {
    expect(parseTargetGrade('101')).toEqual({
      ok: false,
      message: 'Target grade must be between 0 and 100.',
    });
  });
});

describe('parseFinalWeight', () => {
  it('AC-008: rejects a weight of 0 because the calculation becomes meaningless', () => {
    expect(parseFinalWeight('0')).toEqual({
      ok: false,
      message: 'Final exam weight must be between 1 and 100.',
    });
  });

  it('AC-007: rejects out-of-range weights', () => {
    expect(parseFinalWeight('150')).toEqual({
      ok: false,
      message: 'Final exam weight must be between 1 and 100.',
    });
  });

  it('accepts 1 and 100 as boundaries', () => {
    expect(parseFinalWeight('1')).toEqual({ ok: true, value: 1 });
    expect(parseFinalWeight('100')).toEqual({ ok: true, value: 100 });
  });
});

describe('computeRequiredFinal', () => {
  // 前置条件：三个值均已通过 parse 校验（页面与测试都遵守）

  it('AC-002: computes the required final score for 75/40/80', () => {
    expect(computeRequiredFinal(75, 40, 80)).toEqual({
      status: 'reachable',
      required: 87.5,
    });
  });

  it('AC-009: reports unreachable with the best possible grade for 84/30/90', () => {
    const result = computeRequiredFinal(84, 30, 90);
    expect(result.status).toBe('unreachable');
    expect(result).toEqual({ status: 'unreachable', bestPossible: 88.8 });
  });

  it('AC-010: reports secured when the target is already locked in for 90/10/80', () => {
    expect(computeRequiredFinal(90, 10, 80)).toEqual({ status: 'secured' });
  });

  it('treats a required score of exactly 0 as secured', () => {
    // current 80, weight 20, target 80 → (80 - 64) / 0.2 = 80? 手算：
    // current×(100−w)/100 = 80×80/100 = 64；(80−64)/0.2 = 80 → reachable。
    // 构造 required = 0：current×(100−w)/100 = target → current 90, w 10, target 81 → (81−81)/0.1 = 0
    expect(computeRequiredFinal(90, 10, 81)).toEqual({ status: 'secured' });
  });

  it('treats a required score of exactly 100 as reachable', () => {
    // current 84, w 30, target 88.8 → (88.8−58.8)/0.3 = 100
    expect(computeRequiredFinal(84, 30, 88.8)).toEqual({
      status: 'reachable',
      required: 100,
    });
  });

  it('handles a final worth the whole grade (weight 100)', () => {
    expect(computeRequiredFinal(50, 100, 72)).toEqual({
      status: 'reachable',
      required: 72,
    });
  });

  it('AC-013: does not round internally — rounding happens at display time', () => {
    // current 60, w 30, target 80 → (80−42)/0.3 = 126.666… → unreachable
    // bestPossible = 42 + 30 = 72（精确），内部不得提前舍入
    expect(computeRequiredFinal(60, 30, 80)).toEqual({
      status: 'unreachable',
      bestPossible: 72,
    });
  });
});
