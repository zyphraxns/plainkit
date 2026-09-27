import { describe, expect, it } from 'vitest';

import { drawChart } from './draw';

/**
 * 绘制冒烟测试。
 *
 * Node 里没有真实 canvas，所以用一个记录调用的假 ctx：断言三种图都画得
 * 出来、不出现 NaN 文本（AC-024 / AC-025 的机械兜底）。视觉正确性靠
 * agent-browser 浏览器验收（DESIGN.md §10.6）。
 */
function createStubContext(): { ctx: CanvasRenderingContext2D; texts: string[] } {
  const texts: string[] = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    lineJoin: 'miter',
    save(): void {
      /* 记录不必 */
    },
    restore(): void {
      /* 记录不必 */
    },
    fillRect(): void {
      /* 记录不必 */
    },
    fillText(text: string): void {
      if (text.includes('NaN') || text.includes('Infinity')) {
        throw new Error(`drew a broken number: ${text}`);
      }
      texts.push(text);
    },
    strokeRect(): void {
      /* 记录不必 */
    },
    beginPath(): void {
      /* 记录不必 */
    },
    closePath(): void {
      /* 记录不必 */
    },
    arc(): void {
      /* 记录不必 */
    },
    moveTo(): void {
      /* 记录不必 */
    },
    lineTo(): void {
      /* 记录不必 */
    },
    fill(): void {
      /* 记录不必 */
    },
    stroke(): void {
      /* 记录不必 */
    },
    measureText(text: string): { width: number } {
      return { width: text.length * 7 };
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, texts };
}

const points = [
  { label: 'Jan', value: 120 },
  { label: 'Feb', value: 180 },
  { label: 'Mar', value: 150 },
];

describe('drawChart', () => {
  for (const type of ['bar', 'line', 'pie'] as const) {
    it(`AC-001: draws a ${type} chart without broken numbers`, () => {
      const { ctx, texts } = createStubContext();
      drawChart(ctx, { title: 'Monthly signups', type, points }, { width: 1080, height: 680 });
      expect(texts).toContain('PlainKit');
      expect(texts).toContain('Monthly signups');
    });
  }

  it('AC-006: leaves the title out when it is empty', () => {
    const { ctx, texts } = createStubContext();
    drawChart(ctx, { title: '', type: 'bar', points }, { width: 1080, height: 680 });
    expect(texts).toContain('PlainKit');
    expect(texts).not.toContain('');
  });

  it('AC-024: survives identical values', () => {
    const { ctx } = createStubContext();
    drawChart(
      ctx,
      {
        title: '',
        type: 'pie',
        points: [
          { label: 'A', value: 50 },
          { label: 'B', value: 50 },
        ],
      },
      { width: 1080, height: 680 },
    );
  });

  it('AC-025: survives extreme magnitudes', () => {
    const { ctx } = createStubContext();
    drawChart(
      ctx,
      {
        title: '',
        type: 'bar',
        points: [
          { label: 'A', value: 0.005 },
          { label: 'B', value: 9800000 },
        ],
      },
      { width: 1080, height: 680 },
    );
  });

  it('AC-010: prints grouped thousands on the value labels', () => {
    const { ctx, texts } = createStubContext();
    drawChart(
      ctx,
      {
        title: '',
        type: 'bar',
        points: [
          { label: '2023', value: 1240000 },
          { label: '2024', value: 2480000 },
        ],
      },
      { width: 1080, height: 680 },
    );
    expect(texts).toContain('1,240,000');
    expect(texts).toContain('2,480,000');
  });
});
