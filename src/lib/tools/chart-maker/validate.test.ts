import { describe, expect, it } from 'vitest';

import { combineSeries, decodeState, encodeState, summarize, validateForType } from './validate';

const points = [
  { label: 'Jan', value: 120 },
  { label: 'Feb', value: 180 },
  { label: 'Mar', value: 150 },
];

describe('validateForType', () => {
  it('AC-015: needs at least two points for every chart type', () => {
    const single = [{ label: 'Jan', value: 120 }];
    for (const type of ['bar', 'line', 'pie'] as const) {
      const result = validateForType(type, single);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.message).toContain('2');
    }
  });

  it('AC-001: accepts two or more points for bar and line', () => {
    expect(validateForType('bar', points).ok).toBe(true);
    expect(validateForType('line', points).ok).toBe(true);
    expect(validateForType('pie', points).ok).toBe(true);
  });

  it('AC-016: rejects a pie chart with more than 12 slices', () => {
    const many = Array.from({ length: 13 }, (_unused, index) => ({
      label: `R${index}`,
      value: index + 1,
    }));
    const result = validateForType('pie', many);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('12');
  });

  it('AC-016: allows 12 slices exactly', () => {
    const twelve = Array.from({ length: 12 }, (_unused, index) => ({
      label: `R${index}`,
      value: index + 1,
    }));
    expect(validateForType('pie', twelve).ok).toBe(true);
  });

  it('AC-017: rejects negative values in a pie chart and points at bar', () => {
    const result = validateForType('pie', [
      { label: 'Jan', value: 120 },
      { label: 'Feb', value: -30 },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.toLowerCase()).toContain('bar');
  });

  it('AC-019: allows negative values in a bar chart', () => {
    expect(
      validateForType('bar', [
        { label: 'Jan', value: 120 },
        { label: 'Feb', value: -30 },
      ]).ok,
    ).toBe(true);
  });

  it('AC-018: rejects a pie chart where every value is zero', () => {
    const result = validateForType('pie', [
      { label: 'Jan', value: 0 },
      { label: 'Feb', value: 0 },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.toLowerCase()).toContain('bar');
  });

  it('AC-024: accepts identical values without crashing', () => {
    const same = [
      { label: 'A', value: 50 },
      { label: 'B', value: 50 },
      { label: 'C', value: 50 },
    ];
    expect(validateForType('bar', same).ok).toBe(true);
    expect(validateForType('pie', same).ok).toBe(true);
  });
});

describe('summarize', () => {
  it('AC-007: reports the point count and the highest value', () => {
    const summary = summarize(points);
    expect(summary).toEqual({ count: 3, max: { label: 'Feb', value: 180 } });
  });

  it('AC-007: returns null when there is nothing to report', () => {
    expect(summarize([])).toBeNull();
  });

  it('AC-019: reports the highest value even when others are negative', () => {
    const summary = summarize([
      { label: 'Jan', value: -30 },
      { label: 'Feb', value: -5 },
    ]);
    expect(summary?.max).toEqual({ label: 'Feb', value: -5 });
  });

  it('AC-007: takes the first of equal maxima', () => {
    const summary = summarize([
      { label: 'A', value: 10 },
      { label: 'B', value: 10 },
    ]);
    expect(summary?.max.label).toBe('A');
  });
});

describe('encodeState / decodeState', () => {
  it('AC-009: round-trips a chart', () => {
    const state = { title: 'Monthly signups', type: 'pie' as const, points };
    const decoded = decodeState(encodeState(state));
    expect(decoded).toEqual(state);
  });

  it('AC-009: round-trips an untitled bar chart', () => {
    const state = { title: '', type: 'bar' as const, points };
    expect(decodeState(encodeState(state))).toEqual(state);
  });

  it('AC-009: returns null when there are no parameters', () => {
    expect(decodeState(new URLSearchParams())).toBeNull();
  });

  it('AC-009: refuses data that would not pass the parser', () => {
    const params = new URLSearchParams({ title: '', type: 'bar', data: 'Jan\tnot-a-number' });
    expect(decodeState(params)).toBeNull();
  });

  it('AC-009: keeps the encoded string short enough for a link', () => {
    const encoded = encodeState({ title: '', type: 'bar', points }).toString();
    expect(encoded.length).toBeLessThan(200);
  });
});

describe('combineSeries (CR-001)', () => {
  const points2 = [
    { label: 'Jan', value: 90 },
    { label: 'Feb', value: 160 },
    { label: 'Mar', value: 210 },
  ];

  it('AC-037: passes a single series through untouched when the second box is empty', () => {
    const first = { points, notice: '' };
    const result = combineSeries(first, null);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.points).toEqual(points);
    expect(result.value.points2).toBeNull();
  });

  it('AC-037: treats an empty second box the same as no second series', () => {
    const first = { points, notice: '' };
    const result = combineSeries(first, { points: [], notice: '' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.points2).toBeNull();
  });

  it('AC-041: rejects series with different row counts, naming both counts', () => {
    const first = { points, notice: '' };
    const short = { points: points2.slice(0, 2), notice: '' };
    const result = combineSeries(first, short);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('3');
    expect(result.message).toContain('2');
  });

  it('AC-042: rejects a mismatching label and names the row', () => {
    const first = { points, notice: '' };
    const mismatched = {
      points: [
        { label: 'Jan', value: 90 },
        { label: 'March', value: 160 },
        { label: 'Mar', value: 210 },
      ],
      notice: '',
    };
    const result = combineSeries(first, mismatched);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('Row 2');
  });

  it('AC-038: pairs matching series and keeps both notices', () => {
    const first = { points, notice: 'Only the first 50 rows are charted.' };
    const result = combineSeries(first, { points: points2, notice: '' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.points).toEqual(points);
    expect(result.value.points2).toEqual(points2);
    expect(result.value.notice).toContain('50');
  });
});

describe('validateForType with a second series (CR-001)', () => {
  const points2 = [
    { label: 'Jan', value: 90 },
    { label: 'Feb', value: 160 },
    { label: 'Mar', value: 210 },
  ];

  it('AC-040: rejects a pie chart with two series', () => {
    const result = validateForType('pie', points, points2);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.toLowerCase()).toContain('single');
  });

  it('AC-040: still accepts a single-series pie', () => {
    expect(validateForType('pie', points, null).ok).toBe(true);
  });

  it('AC-038: accepts grouped bars with two series', () => {
    expect(validateForType('bar', points, points2).ok).toBe(true);
  });

  it('AC-039: accepts two lines with two series', () => {
    expect(validateForType('line', points, points2).ok).toBe(true);
  });
});

describe('summarize with two series (CR-001)', () => {
  it('AC-046: merges the point counts and picks the global maximum', () => {
    const series2 = [
      { label: 'Jan', value: 90 },
      { label: 'Feb', value: 160 },
      { label: 'Mar', value: 210 },
    ];
    const summary = summarize(points, series2);
    expect(summary).not.toBeNull();
    expect(summary?.count).toBe(6);
    expect(summary?.max.value).toBe(210);
    expect(summary?.max.label).toBe('Mar');
  });

  it('AC-046: keeps the single-series behaviour when the second series is absent', () => {
    const summary = summarize(points, null);
    expect(summary?.count).toBe(3);
    expect(summary?.max.value).toBe(180);
  });
});

describe('encodeState / decodeState with a second series (CR-001)', () => {
  const points2 = [
    { label: 'Jan', value: 90 },
    { label: 'Feb', value: 160 },
    { label: 'Mar', value: 210 },
  ];

  it('AC-045: round-trips two series', () => {
    const state = { title: 'A vs B', type: 'bar' as const, points, points2 };
    expect(decodeState(encodeState(state))).toEqual(state);
  });

  it('AC-045: decodes an old single-series link without growing a second series', () => {
    const decoded = decodeState(encodeState({ title: '', type: 'bar', points }));
    expect(decoded).toEqual({ title: '', type: 'bar', points });
  });

  it('AC-045: treats an empty second series as absent', () => {
    const decoded = decodeState(encodeState({ title: '', type: 'bar', points, points2: [] }));
    expect(decoded).toEqual({ title: '', type: 'bar', points });
  });

  it('AC-045: refuses a second series that would not pass the parser', () => {
    const params = new URLSearchParams({
      title: '',
      type: 'bar',
      data: 'Jan\t120\nFeb\t180',
      data2: 'Jan\tnot-a-number',
    });
    expect(decodeState(params)).toBeNull();
  });
});
