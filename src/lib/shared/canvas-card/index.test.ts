import { describe, expect, it } from 'vitest';

import { fitTextSize } from './index';

/** 假测量器：每个字符宽 0.6 × 字号，随字号单调递增。 */
const fakeMeasure = (text: string) => (px: number) => text.length * px * 0.6;

describe('fitTextSize', () => {
  it('keeps the start size when short text already fits', () => {
    // 5 字符 × 0.6 × 100px = 300px ≤ 400px 上限
    expect(fitTextSize(400, 100, 24, fakeMeasure('Hello'))).toBe(100);
  });

  it('shrinks long text until it fits', () => {
    // 50 字符 × 0.6 × px ≤ 900px → px ≤ 30
    expect(fitTextSize(900, 100, 24, fakeMeasure('x'.repeat(50)))).toBe(30);
  });

  it('never goes below the minimum size', () => {
    expect(fitTextSize(100, 100, 24, fakeMeasure('x'.repeat(500)))).toBe(24);
  });
});
