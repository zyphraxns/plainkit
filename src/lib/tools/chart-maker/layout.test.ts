import { describe, expect, it } from 'vitest';

import type { DataPoint } from './index';
import {
  computeAxisScale,
  computeBarLayout,
  computeLineLayout,
  computePieLayout,
  formatChartNumber,
} from './layout';

/** 假测量器：每字符半个字号宽，够用来验证截断与隔位逻辑。 */
const measure = (text: string, px: number): number => text.length * px * 0.5;

const box = { left: 0, top: 0, width: 600, height: 300 };

const points = (...pairs: [string, number][]): DataPoint[] =>
  pairs.map(([label, value]) => ({ label, value }));

describe('computeAxisScale', () => {
  it('AC-030: starts a bar chart axis at zero', () => {
    const scale = computeAxisScale([100, 105], { zeroBased: true });
    expect(scale.min).toBe(0);
    expect(scale.max).toBeGreaterThanOrEqual(105);
  });

  it('AC-031: lets a line chart axis start near the data', () => {
    const scale = computeAxisScale([92, 95, 99], { zeroBased: false });
    expect(scale.min).toBeGreaterThan(0);
    expect(scale.min).toBeLessThanOrEqual(92);
    expect(scale.max).toBeGreaterThanOrEqual(99);
  });

  it('AC-019: keeps zero on the axis when values are negative', () => {
    const scale = computeAxisScale([-30, 120], { zeroBased: true });
    expect(scale.min).toBeLessThan(0);
    expect(scale.ticks.some((tick) => tick.value === 0)).toBe(true);
  });

  it('AC-024: does not collapse when every value is identical', () => {
    const scale = computeAxisScale([50, 50, 50], { zeroBased: true });
    expect(scale.max).toBeGreaterThan(scale.min);
  });

  it('AC-024: does not collapse a line chart of identical values', () => {
    const scale = computeAxisScale([50, 50, 50], { zeroBased: false });
    expect(scale.max).toBeGreaterThan(scale.min);
  });

  it('AC-025: handles a tiny value next to a huge one', () => {
    const scale = computeAxisScale([0.005, 9800000], { zeroBased: true });
    expect(scale.min).toBe(0);
    expect(scale.max).toBeGreaterThanOrEqual(9800000);
    expect(scale.ticks.length).toBeGreaterThan(1);
  });
});

describe('computeBarLayout', () => {
  it('AC-030: keeps a 5-point gap looking like a 5-point gap', () => {
    const scale = computeAxisScale([100, 105], { zeroBased: true });
    const layout = computeBarLayout(points(['A', 100], ['B', 105]), scale, box, measure);
    const [first, second] = layout.bars;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) return;
    expect(second.height).toBeGreaterThan(first.height);
    expect((second.height - first.height) / second.height).toBeLessThan(0.05);
  });

  it('AC-019: draws negative bars below the zero line', () => {
    const scale = computeAxisScale([-30, 120], { zeroBased: true });
    const layout = computeBarLayout(points(['Jan', 120], ['Feb', -30]), scale, box, measure);
    const negative = layout.bars[1];
    expect(negative).toBeDefined();
    if (!negative) return;
    expect(negative.y).toBeGreaterThanOrEqual(layout.zeroY - 0.001);
  });

  it('AC-001: shows the value on top of every bar when there are few bars', () => {
    const scale = computeAxisScale([120, 180, 150], { zeroBased: true });
    const layout = computeBarLayout(points(['Jan', 120], ['Feb', 180]), scale, box, measure);
    expect(layout.bars.every((bar) => bar.showValue)).toBe(true);
  });

  it('AC-022: does not crowd the axis labels when there are 50 bars', () => {
    const many = Array.from({ length: 50 }, (_unused, index) => ({
      label: `R${index}`,
      value: index + 1,
    }));
    const scale = computeAxisScale(
      many.map((point) => point.value),
      { zeroBased: true },
    );
    const layout = computeBarLayout(many, scale, box, measure);
    const shown = layout.labels.filter((label) => label.show);
    expect(shown.length).toBeLessThan(50);
    expect(shown.length).toBeGreaterThan(1);
    const indices = shown.map((label) => label.index);
    const gaps = indices.slice(1).map((index, i) => index - (indices[i] ?? 0));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(2);
  });

  it('AC-022: truncates a label that will not fit but leaves the data alone', () => {
    const data = points(['A very long category name that will not fit', 120], ['B', 180]);
    const scale = computeAxisScale([120, 180], { zeroBased: true });
    const layout = computeBarLayout(data, scale, box, measure);
    const label = layout.labels[0];
    expect(label).toBeDefined();
    if (!label) return;
    expect(label.text.endsWith('…')).toBe(true);
    expect(data[0]?.label).toBe('A very long category name that will not fit');
  });
});

describe('computeLineLayout', () => {
  it('AC-031: spreads the points across the plot and scales them', () => {
    const scale = computeAxisScale([92, 95, 99], { zeroBased: false });
    const layout = computeLineLayout(points(['A', 92], ['B', 95], ['C', 99]), scale, box);
    expect(layout.points).toHaveLength(3);
    const [first, , last] = layout.points;
    expect(first?.x).toBeCloseTo(0, 5);
    expect(last?.x).toBeCloseTo(box.width, 5);
    // 值越大 y 越小（屏幕坐标向下增长）
    expect((last?.y ?? 0) < (first?.y ?? 0)).toBe(true);
  });
});

describe('computePieLayout', () => {
  it('AC-005: shares out the circle and sorts slices by size', () => {
    const layout = computePieLayout(points(['Jan', 120], ['Feb', 180], ['Mar', 150]), box, measure);
    expect(layout.slices.map((slice) => slice.value)).toEqual([180, 150, 120]);
    const total = layout.slices.reduce((sum, slice) => sum + slice.percent, 0);
    expect(total).toBeCloseTo(100, 5);
    expect(layout.slices[0]?.percent).toBeCloseTo(40, 5);
  });

  it('AC-005: labels every slice above five percent', () => {
    const layout = computePieLayout(points(['Jan', 120], ['Feb', 180], ['Mar', 150]), box, measure);
    expect(layout.slices.every((slice) => slice.showPercent)).toBe(true);
  });

  it('AC-005: leaves tiny slices unlabelled', () => {
    const layout = computePieLayout(points(['Big', 97], ['Tiny', 3]), box, measure);
    const tiny = layout.slices.find((slice) => slice.label === 'Tiny');
    expect(tiny).toBeDefined();
    expect(tiny?.showPercent).toBe(false);
  });

  it('AC-032: gives each slice one of six shades, cycling past six', () => {
    const eight = Array.from({ length: 8 }, (_unused, index) => ({
      label: `R${index}`,
      value: index + 1,
    }));
    const layout = computePieLayout(eight, box, measure);
    expect(layout.slices.map((slice) => slice.shadeIndex)).toEqual([0, 1, 2, 3, 4, 5, 0, 1]);
  });

  it('AC-024: shares the circle evenly for identical values', () => {
    const layout = computePieLayout(points(['A', 50], ['B', 50]), box, measure);
    expect(layout.slices[0]?.percent).toBeCloseTo(50, 5);
    expect(layout.slices[1]?.percent).toBeCloseTo(50, 5);
  });
});

describe('formatChartNumber', () => {
  it('AC-010: groups thousands', () => {
    expect(formatChartNumber(1240000)).toBe('1,240,000');
    expect(formatChartNumber(9800000)).toBe('9,800,000');
  });

  it('AC-033: keeps at most two decimals and drops trailing zeros', () => {
    expect(formatChartNumber(12.5)).toBe('12.5');
    expect(formatChartNumber(12.567)).toBe('12.57');
    expect(formatChartNumber(12)).toBe('12');
  });

  it('AC-019: keeps the minus sign', () => {
    expect(formatChartNumber(-30)).toBe('-30');
  });

  it('AC-025: never prints exponential notation', () => {
    expect(formatChartNumber(0.005)).not.toContain('e');
    expect(formatChartNumber(1e21)).not.toContain('e');
  });
});
