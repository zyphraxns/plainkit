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

describe('drawChart with two series (CR-001)', () => {
  const points2 = [
    { label: 'Jan', value: 90 },
    { label: 'Feb', value: 160 },
    { label: 'Mar', value: 210 },
  ];

  /** 记录颜色序列的 ctx，用于断言两个系列真的用了两种颜色。 */
  function createRecordingContext(): {
    ctx: CanvasRenderingContext2D;
    texts: string[];
    fills: string[];
    strokes: string[];
  } {
    const base = createStubContext();
    const fills: string[] = [];
    const strokes: string[] = [];
    const ctx = base.ctx;
    const original = ctx as unknown as Record<string, unknown>;
    // fillStyle / strokeStyle 是普通属性赋值，用 getter/setter 包装记录。
    let fill = '';
    let stroke = '';
    Object.defineProperty(ctx, 'fillStyle', {
      get: () => fill,
      set: (value: string) => {
        fill = value;
        fills.push(value);
      },
    });
    Object.defineProperty(ctx, 'strokeStyle', {
      get: () => stroke,
      set: (value: string) => {
        stroke = value;
        strokes.push(value);
      },
    });
    original.__fills = fills;
    original.__strokes = strokes;
    return { ctx, texts: base.texts, fills, strokes };
  }

  it('AC-038: draws a legend with two entries for a two-series bar chart', () => {
    const { ctx, texts } = createRecordingContext();
    drawChart(ctx, { title: '', type: 'bar', points, points2 }, { width: 1080, height: 680 });
    expect(texts).toContain('Series 1');
    expect(texts).toContain('Series 2');
  });

  it('AC-038: uses the accent green and the neutral gray for the two bar series', () => {
    const { ctx, fills } = createRecordingContext();
    drawChart(ctx, { title: '', type: 'bar', points, points2 }, { width: 1080, height: 680 });
    expect(fills).toContain('#0F6E56');
    expect(fills).toContain('#6B7280');
  });

  it('AC-037: draws no legend and no gray for a single-series chart', () => {
    const { ctx, texts, fills } = createRecordingContext();
    drawChart(ctx, { title: '', type: 'bar', points }, { width: 1080, height: 680 });
    expect(texts).not.toContain('Series 1');
    expect(fills).not.toContain('#6B7280');
  });

  it('AC-039: strokes both colors for a two-series line chart', () => {
    const { ctx, strokes } = createRecordingContext();
    drawChart(ctx, { title: '', type: 'line', points, points2 }, { width: 1080, height: 680 });
    expect(strokes).toContain('#0F6E56');
    expect(strokes).toContain('#6B7280');
  });

  it('AC-044: legend text never contains broken numbers', () => {
    const { ctx, texts } = createRecordingContext();
    drawChart(
      ctx,
      { title: 'A vs B', type: 'line', points, points2 },
      { width: 1080, height: 680 },
    );
    for (const text of texts) {
      expect(text).not.toContain('NaN');
    }
  });
});
