import { describe, expect, it } from 'vitest';

import { decodeState, encodeState, parseCurrentGrade } from './index';

describe('encodeState / decodeState', () => {
  it('AC-005: round-trips a valid state back to the same values', () => {
    const state = { currentGrade: 84, finalWeight: 30, targetGrade: 90 };
    const decoded = decodeState(encodeState(state));
    expect(decoded).toEqual({
      currentGrade: '84',
      finalWeight: '30',
      targetGrade: '90',
    });
  });

  it('uses camelCase parameter names in the shareable query string', () => {
    const query = encodeState({ currentGrade: 75, finalWeight: 40, targetGrade: 80 });
    expect(query).toBe('currentGrade=75&finalWeight=40&targetGrade=80');
  });

  it('AC-011: returns raw strings for tampered values without throwing', () => {
    const decoded = decodeState('?currentGrade=abc&finalWeight=30&targetGrade=90');
    expect(decoded.currentGrade).toBe('abc');
    // 原始字符串必须走与手输相同的校验路径并被拒绝
    expect(parseCurrentGrade(decoded.currentGrade).ok).toBe(false);
  });

  it('returns empty strings for missing parameters', () => {
    expect(decodeState('')).toEqual({
      currentGrade: '',
      finalWeight: '',
      targetGrade: '',
    });
    expect(decodeState('?currentGrade=84')).toEqual({
      currentGrade: '84',
      finalWeight: '',
      targetGrade: '',
    });
  });
});
