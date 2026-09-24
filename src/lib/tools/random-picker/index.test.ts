import { describe, expect, it } from 'vitest';

import {
  assignGroups,
  dedupeNames,
  formatGroupsText,
  formatListText,
  parseCount,
  pickNames,
  shuffle,
  splitNames,
} from './index';

/** 种子化的确定性随机源（LCG），让洗牌结果可复现。 */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 生成 ["n01", "n02", …] 形式的名单。 */
function nameList(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `n${String(i + 1).padStart(2, '0')}`);
}

describe('splitNames', () => {
  it('AC-008: splits on newlines, commas and semicolons, ignoring blanks', () => {
    const input = 'Alice\n Bob ,Carol;Dave\n\n  \nEve';
    expect(splitNames(input)).toEqual({
      names: ['Alice', 'Bob', 'Carol', 'Dave', 'Eve'],
      duplicates: [],
    });
  });

  it('AC-009: reports duplicated names once each, without removing them', () => {
    const input = 'Alice\nBob\nAlice\nCarol\nAlice\nBob';
    expect(splitNames(input)).toEqual({
      names: ['Alice', 'Bob', 'Alice', 'Carol', 'Alice', 'Bob'],
      duplicates: ['Alice', 'Bob'],
    });
  });
});

describe('dedupeNames', () => {
  it('AC-009: keeps the first occurrence of each name', () => {
    expect(dedupeNames(['Alice', 'Bob', 'Alice', 'Carol', 'Bob'])).toEqual([
      'Alice',
      'Bob',
      'Carol',
    ]);
  });
});

describe('parseCount', () => {
  it('AC-011: rejects a non-integer below the range with the label in the message', () => {
    expect(parseCount('', 5, 'Number of groups')).toEqual({
      ok: false,
      message: 'Enter the number of groups (between 1 and 5).',
    });
  });

  it('AC-011: rejects values above max', () => {
    expect(parseCount('8', 5, 'Number of groups')).toEqual({
      ok: false,
      message: 'Number of groups must be a whole number between 1 and 5.',
    });
  });

  it('AC-012: rejects non-numeric and fractional input', () => {
    expect(parseCount('abc', 10, 'People to pick')).toEqual({
      ok: false,
      message: 'People to pick must be a whole number between 1 and 10.',
    });
    expect(parseCount('2.5', 10, 'People to pick')).toEqual({
      ok: false,
      message: 'People to pick must be a whole number between 1 and 10.',
    });
  });

  it('accepts boundary values 1 and max', () => {
    expect(parseCount('1', 5, 'Number of groups')).toEqual({ ok: true, value: 1 });
    expect(parseCount(' 5 ', 5, 'Number of groups')).toEqual({ ok: true, value: 5 });
  });
});

describe('shuffle', () => {
  it('AC-004: keeps every element exactly once', () => {
    const items = nameList(50);
    const shuffled = shuffle(items, makeRng(42));
    expect([...shuffled].sort()).toEqual([...items].sort());
  });

  it('does not mutate the input array', () => {
    const items = nameList(10);
    const copy = [...items];
    shuffle(items, makeRng(7));
    expect(items).toEqual(copy);
  });

  it('is deterministic for a given random source', () => {
    const items = nameList(20);
    expect(shuffle(items, makeRng(1))).toEqual(shuffle(items, makeRng(1)));
  });
});

describe('assignGroups', () => {
  it('AC-001: splits 23 names into 4 balanced groups sized [6, 6, 6, 5]', () => {
    const names = nameList(23);
    const groups = assignGroups(names, 4, makeRng(3));
    expect(groups.map((group) => group.length)).toEqual([6, 6, 6, 5]);
  });

  it('AC-001: every name appears exactly once across all groups', () => {
    const names = nameList(23);
    const groups = assignGroups(names, 4, makeRng(3));
    expect(groups.flat().sort()).toEqual([...names].sort());
  });

  it('AC-002: 23 names with a group count of 8 gives seven groups of 3 and one of 2', () => {
    const names = nameList(23);
    const groups = assignGroups(names, 8, makeRng(5));
    expect(groups.map((group) => group.length)).toEqual([3, 3, 3, 3, 3, 3, 3, 2]);
  });

  it('AC-017: is not biased — over many runs each person reaches each group with similar frequency', () => {
    const names = nameList(23);
    let inGroup1 = 0;
    for (let seed = 0; seed < 200; seed += 1) {
      const groups = assignGroups(names, 4, makeRng(seed * 7919));
      if (groups[1]?.includes('n01')) inGroup1 += 1;
    }
    // 期望 200 × 1/4 = 50 次；±15 次（约 ±2.5σ）内视为无固定模式。
    expect(inGroup1).toBeGreaterThanOrEqual(35);
    expect(inGroup1).toBeLessThanOrEqual(65);
  });
});

describe('pickNames', () => {
  it('AC-003: picks 5 unique names out of 30', () => {
    const names = nameList(30);
    const picked = pickNames(names, 5, makeRng(11));
    expect(picked).toHaveLength(5);
    expect(new Set(picked).size).toBe(5);
    for (const name of picked) expect(names).toContain(name);
  });

  it('picking all names returns every name exactly once', () => {
    const names = nameList(6);
    const picked = pickNames(names, 6, makeRng(2));
    expect([...picked].sort()).toEqual([...names].sort());
  });
});

describe('formatGroupsText', () => {
  it('AC-006: renders groups as paste-ready plain text', () => {
    const text = formatGroupsText([['Alice', 'Bob'], ['Carol']], 'Random groups');
    expect(text).toBe(
      ['Random groups', '', 'Group 1', 'Alice', 'Bob', '', 'Group 2', 'Carol'].join('\n'),
    );
  });
});

describe('formatListText', () => {
  it('AC-006: renders a flat list (picks / random order) as paste-ready plain text', () => {
    expect(formatListText(['Alice', 'Bob'], 'Picked names')).toBe(
      ['Picked names', '', '1. Alice', '2. Bob'].join('\n'),
    );
  });
});
