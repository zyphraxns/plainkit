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

// ---------------------------------------------------------------------------
// computeGroupCardLayout（工具 5：随机分组卡片）
// ---------------------------------------------------------------------------

import { computeGroupCardLayout } from './index';

/** 假测量器：每个字符宽 0.6 × 字号（与上面 fakeMeasure 同一约定）。 */
const fakeMeasureText = (text: string, px: number) => text.length * px * 0.6;

describe('computeGroupCardLayout', () => {
  it('uses 1 column for 1 group and 2 columns for 2 groups', () => {
    const one = computeGroupCardLayout(
      {
        title: '',
        modeLabel: '4 groups',
        groups: [{ label: 'Group 1', members: ['a', 'b'] }],
        dateLabel: 'Sep 24, 2026',
      },
      fakeMeasureText,
    );
    expect(one.columns).toHaveLength(1);

    const two = computeGroupCardLayout(
      {
        title: '',
        modeLabel: '2 groups',
        groups: [
          { label: 'Group 1', members: ['a'] },
          { label: 'Group 2', members: ['b'] },
        ],
        dateLabel: 'Sep 24, 2026',
      },
      fakeMeasureText,
    );
    expect(two.columns).toHaveLength(2);
  });

  it('AC-013: caps at 3 columns for many groups and keeps every group', () => {
    const groups = [1, 2, 3, 4, 5, 6].map((n) => ({
      label: `Group ${n}`,
      members: ['a', 'b'],
    }));
    const layout = computeGroupCardLayout(
      { title: '', modeLabel: '6 groups', groups, dateLabel: 'Sep 24, 2026' },
      fakeMeasureText,
    );
    expect(layout.columns).toHaveLength(3);
    // 贪心分配（等高组依次横排）：第一行 Group 1–3，第二行 Group 4–6。
    expect(layout.columns.flat().map((g) => g.label)).toEqual([
      'Group 1',
      'Group 4',
      'Group 2',
      'Group 5',
      'Group 3',
      'Group 6',
    ]);
  });

  it('AC-013: the canvas grows with content instead of truncating names', () => {
    const make = (count: number) =>
      computeGroupCardLayout(
        {
          title: '',
          modeLabel: 'Groups',
          groups: [{ label: 'Group 1', members: Array.from({ length: count }, (_, i) => `n${i}`) }],
          dateLabel: 'Sep 24, 2026',
        },
        fakeMeasureText,
      );
    expect(make(300).height).toBeGreaterThan(make(30).height);
    // 300 个名字一个不少（组内成员行数守恒）
    const bigColumns = make(300).columns;
    expect(bigColumns[0]?.flatMap((g) => g.memberLines)).toHaveLength(300);
  });

  it('truncates a name that cannot fit the column width at the minimum size', () => {
    // 34px 字号下 0.6×34≈20.4px/字符，120 字符的名字必然放不进三栏列宽。
    const longName = 'x'.repeat(120);
    const layout = computeGroupCardLayout(
      {
        title: '',
        modeLabel: 'Groups',
        groups: [{ label: 'G', members: ['ok', longName] }],
        dateLabel: 'Sep 24, 2026',
      },
      fakeMeasureText,
    );
    const firstGroup = layout.columns[0]?.[0];
    expect(firstGroup?.memberLines[0]).toBe('ok');
    const longLine = firstGroup?.memberLines[1] ?? '';
    expect(longLine.endsWith('…')).toBe(true);
    expect(longLine.length).toBeLessThan(longName.length);
  });

  it('omits the label line for labelless groups (pick / random order mode)', () => {
    const layout = computeGroupCardLayout(
      {
        title: '',
        modeLabel: 'Picked names',
        groups: [{ label: '', members: ['a', 'b'] }],
        dateLabel: 'Sep 24, 2026',
      },
      fakeMeasureText,
    );
    expect(layout.columns[0]?.[0]?.labelLines).toEqual([]);
  });

  it('always keeps the width at 1080 and reserves footer space', () => {
    const layout = computeGroupCardLayout(
      {
        title: 'Teams',
        modeLabel: '2 groups',
        groups: [{ label: 'A', members: ['a'] }],
        dateLabel: 'Sep 24, 2026',
      },
      fakeMeasureText,
    );
    expect(layout.width).toBe(1080);
    expect(layout.height).toBeGreaterThan(layout.contentBottom);
  });
});
