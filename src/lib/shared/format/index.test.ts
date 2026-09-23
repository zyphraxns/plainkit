import { describe, expect, it } from 'vitest';

import { formatScore, roundTo } from './index';

describe('roundTo', () => {
  it('AC-013: rounds a display value to 1 decimal place', () => {
    expect(roundTo(87.46, 1)).toBe(87.5);
    expect(roundTo(87.44, 1)).toBe(87.4);
  });

  it('AC-013: keeps an exact value unchanged', () => {
    expect(roundTo(87.5, 1)).toBe(87.5);
    expect(roundTo(0, 1)).toBe(0);
  });

  it('AC-013: handles negative values', () => {
    expect(roundTo(-10.44, 1)).toBe(-10.4);
  });

  it('rounds to 0 decimal places for integer display', () => {
    expect(roundTo(217.6, 0)).toBe(218);
  });
});

describe('formatScore', () => {
  it('AC-013: always shows exactly 1 decimal place', () => {
    expect(formatScore(87.5)).toBe('87.5');
    expect(formatScore(100)).toBe('100.0');
    expect(formatScore(0)).toBe('0.0');
  });

  it('AC-013: rounds before formatting, never mid-calculation', () => {
    expect(formatScore(87.46)).toBe('87.5');
    expect(formatScore(88.84)).toBe('88.8');
  });
});
