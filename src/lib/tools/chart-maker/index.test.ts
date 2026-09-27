import { describe, expect, it } from 'vitest';

import { parseChartData, parseChartType, parseTitle } from './index';

describe('parseChartData', () => {
  it('AC-001: reads two columns separated by tabs', () => {
    const result = parseChartData('Jan\t120\nFeb\t180\nMar\t150');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.points).toEqual([
      { label: 'Jan', value: 120 },
      { label: 'Feb', value: 180 },
      { label: 'Mar', value: 150 },
    ]);
    expect(result.value.notice).toBe('');
  });

  it('AC-002: reads two columns separated by commas', () => {
    const result = parseChartData('Jan,120\nFeb,180');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.points).toEqual([
      { label: 'Jan', value: 120 },
      { label: 'Feb', value: 180 },
    ]);
  });

  it('AC-002: falls back to semicolons when there is no tab or comma', () => {
    const result = parseChartData('Jan;120\nFeb;180');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.points).toEqual([
      { label: 'Jan', value: 120 },
      { label: 'Feb', value: 180 },
    ]);
  });

  it('AC-003: numbers a single column with row labels', () => {
    const result = parseChartData('120\n180\n150');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.points).toEqual([
      { label: 'Row 1', value: 120 },
      { label: 'Row 2', value: 180 },
      { label: 'Row 3', value: 150 },
    ]);
  });

  it('AC-011: rejects a row with more than two columns', () => {
    const result = parseChartData('Jan\t120\textra');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('Row 1');
    expect(result.message).toContain('2');
  });

  it('AC-012: explains the thousands comma instead of silently dropping it', () => {
    const result = parseChartData('Jan, 1,200');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('Row 1');
    expect(result.message.toLowerCase()).toContain('1,200');
  });

  it('AC-013: rejects a value that is not a number, naming the row', () => {
    const result = parseChartData('Jan\tabc\nFeb\t180');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('Row 1');
  });

  it('AC-013: rejects currency signs and percent signs', () => {
    expect(parseChartData('Jan\t$120').ok).toBe(false);
    expect(parseChartData('Jan\t50%').ok).toBe(false);
    expect(parseChartData('Jan\t1e5').ok).toBe(false);
  });

  it('AC-019: accepts negative numbers, decimals and padding spaces', () => {
    const result = parseChartData('Jan\t-30\n Feb , 12.5 ');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.points).toEqual([
      { label: 'Jan', value: -30 },
      { label: 'Feb', value: 12.5 },
    ]);
  });

  it('AC-014: skips blank lines', () => {
    const result = parseChartData('Jan\t120\n\n\nFeb\t180\n');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.points).toHaveLength(2);
  });

  it('AC-014: returns no points for empty input without an error', () => {
    const result = parseChartData('   \n\n  ');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.points).toEqual([]);
    expect(result.value.notice).toBe('');
  });

  it('AC-020: keeps the first 50 rows and says so', () => {
    const rows = Array.from({ length: 60 }, (_unused, index) => `R${index}\t${index}`);
    const result = parseChartData(rows.join('\n'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.points).toHaveLength(50);
    expect(result.value.points[49]?.label).toBe('R49');
    expect(result.value.notice).toContain('50');
  });

  it('AC-020: still reports a broken row beyond the row limit', () => {
    const rows = Array.from({ length: 60 }, (_unused, index) =>
      index === 55 ? 'R55\tnot-a-number' : `R${index}\t${index}`,
    );
    const result = parseChartData(rows.join('\n'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('Row 56');
  });

  it('AC-021: rejects a row longer than 60 characters', () => {
    const longLabel = 'x'.repeat(61);
    const result = parseChartData(`${longLabel}\t120`);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('60');
  });

  it('AC-021: rejects input longer than 5000 characters before parsing it', () => {
    const rows = Array.from({ length: 1000 }, (_unused, index) => `R${index}\t${index}`);
    const raw = rows.join('\n');
    expect(raw.length).toBeGreaterThan(5000);
    const result = parseChartData(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('5000');
  });

  it('AC-022: keeps the original label even when it is long', () => {
    const label = 'A very long category name that will not fit';
    const result = parseChartData(`${label}\t120`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.points[0]?.label).toBe(label);
  });
});

describe('parseTitle', () => {
  it('AC-006: accepts an empty title', () => {
    expect(parseTitle('').ok).toBe(true);
  });

  it('AC-006: rejects a title longer than 60 characters', () => {
    const result = parseTitle('x'.repeat(61));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('60');
  });

  it('AC-006: trims surrounding spaces', () => {
    const result = parseTitle('  Monthly signups  ');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe('Monthly signups');
  });
});

describe('parseChartType', () => {
  it('AC-004: accepts the three chart types', () => {
    expect(parseChartType('bar').ok).toBe(true);
    expect(parseChartType('line').ok).toBe(true);
    expect(parseChartType('pie').ok).toBe(true);
  });

  it('AC-004: falls back to bar for anything else', () => {
    const result = parseChartType('donut');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe('bar');
  });
});
