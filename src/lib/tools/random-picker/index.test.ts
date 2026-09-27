import { describe, expect, it } from 'vitest';

import {
  assignGroups,
  balanceTeams,
  clampTeamCount,
  dedupeNames,
  fillMissingRatings,
  formatGroupsText,
  formatListText,
  formatTeamsSummary,
  formatTeamsText,
  parseCount,
  parseRoster,
  pickCaptain,
  pickNames,
  shuffle,
  splitNames,
} from './index';
import type { RatedEntry } from './index';

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

// ---------------------------------------------------------------------------
// 团队模式（specs/features/random-picker-team-mode.md）
// ---------------------------------------------------------------------------

type MaybeRated = { name: string; rating: number | null };

/** 测试用的带评分名单构造器。 */
function roster(entries: Array<[string, number | null]>): MaybeRated[] {
  return entries.map(([name, rating]) => ({ name, rating }));
}

describe('parseRoster', () => {
  it('AC-019: reads ratings after a colon, allowing spaces around the number', () => {
    const result = parseRoster('Alice:8\nBob: 9\nCarol');
    expect(result.entries).toEqual([
      { name: 'Alice', rating: 8 },
      { name: 'Bob', rating: 9 },
      { name: 'Carol', rating: null },
    ]);
    expect(result.badRatingLines).toBe(0);
    expect(result.duplicates).toEqual([]);
  });

  it('AC-030: keeps the whole line as a name when the rating is not a valid number', () => {
    const result = parseRoster('Bob:abc\nCara:\nDan:1200\nEve:8.5');
    expect(result.entries).toEqual([
      { name: 'Bob:abc', rating: null },
      { name: 'Cara:', rating: null },
      { name: 'Dan:1200', rating: null },
      { name: 'Eve', rating: 8.5 },
    ]);
    expect(result.badRatingLines).toBe(3);
  });

  it('AC-034: treats names with different ratings as duplicates', () => {
    expect(parseRoster('Alice:8\nBo\nAlice:9').duplicates).toEqual(['Alice']);
  });
});

describe('fillMissingRatings', () => {
  it('AC-024: fills missing ratings with the average of the rated ones', () => {
    const result = fillMissingRatings(
      roster([
        ['Alice', 8],
        ['Bo', 8],
        ['Cy', 7],
        ['Dee', null],
      ]),
    );
    expect(result.rated).toBe(true);
    expect(result.unratedCount).toBe(1);
    expect(result.average).toBe(7.7);
    expect(result.entries).toEqual([
      { name: 'Alice', rating: 8 },
      { name: 'Bo', rating: 8 },
      { name: 'Cy', rating: 7 },
      { name: 'Dee', rating: 7.7 },
    ]);
  });

  it('AC-025: reports rated = false when nobody has a rating', () => {
    const result = fillMissingRatings(
      roster([
        ['Alice', null],
        ['Bo', null],
      ]),
    );
    expect(result.rated).toBe(false);
    expect(result.average).toBe(0);
    expect(result.unratedCount).toBe(2);
  });
});

describe('balanceTeams', () => {
  it('AC-020: splits ratings 10..5 into two teams of 3 scoring 23 and 22', () => {
    const entries: RatedEntry[] = [
      { name: 'a', rating: 10 },
      { name: 'b', rating: 9 },
      { name: 'c', rating: 8 },
      { name: 'd', rating: 7 },
      { name: 'e', rating: 6 },
      { name: 'f', rating: 5 },
    ];
    const teams = balanceTeams(entries, 2, makeRng(1));
    expect(teams.map((team) => team.members.length)).toEqual([3, 3]);
    expect(teams.map((team) => team.total).sort((x, y) => x - y)).toEqual([22, 23]);
    expect(teams.flatMap((team) => team.members.map((m) => m.name)).sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
    ]);
  });

  it('AC-021: splits ratings 1..12 into two teams of 39 points each, over 50 runs', () => {
    const entries: RatedEntry[] = Array.from({ length: 12 }, (_, i) => ({
      name: `p${i + 1}`,
      rating: i + 1,
    }));
    const ideal = balanceTeams(entries, 2, makeRng(1));
    expect(ideal.map((team) => team.total)).toEqual([39, 39]);
    for (let seed = 0; seed < 50; seed += 1) {
      const [a, b] = balanceTeams(entries, 2, makeRng(seed * 31 + 7)).map((t) => t.total) as [
        number,
        number,
      ];
      expect(Math.abs(a - b)).toBeLessThanOrEqual(2);
    }
  });

  it('AC-022: team sizes never differ by more than one person', () => {
    const entries: RatedEntry[] = Array.from({ length: 23 }, (_, i) => ({
      name: `p${i + 1}`,
      rating: (i % 9) + 1,
    }));
    const teams = balanceTeams(entries, 4, makeRng(5));
    // 哪支队伍少一个人由随机决定，只断言人数分布。
    expect(teams.map((team) => team.members.length).sort((a, b) => a - b)).toEqual([5, 6, 6, 6]);
    expect(teams.flatMap((team) => team.members)).toHaveLength(23);
  });

  it('AC-023: the captain is the highest-rated member of the team', () => {
    const teams = balanceTeams(
      [
        { name: 'weak', rating: 2 },
        { name: 'star', rating: 9 },
        { name: 'mid', rating: 5 },
      ],
      1,
      makeRng(3),
    );
    expect(teams[0]!.members[teams[0]!.captain]!.name).toBe('star');
  });

  it('AC-023: with equal ratings the captain is chosen at random', () => {
    const entries: RatedEntry[] = ['a', 'b', 'c', 'd'].map((name) => ({ name, rating: 5 }));
    const captains = new Set<string>();
    for (let seed = 0; seed < 20; seed += 1) {
      const team = balanceTeams(entries, 1, makeRng(seed * 13 + 1))[0]!;
      captains.add(team.members[team.captain]!.name);
    }
    expect(captains.size).toBeGreaterThan(1);
  });

  it('AC-039: without ratings nobody is systematically favoured', () => {
    const entries: RatedEntry[] = Array.from({ length: 20 }, (_, i) => ({
      name: `p${i + 1}`,
      rating: 5,
    }));
    let inFirstTeam = 0;
    for (let seed = 0; seed < 100; seed += 1) {
      const teams = balanceTeams(entries, 2, makeRng(seed * 7919 + 3));
      if (teams[0]!.members.some((member) => member.name === 'p1')) inFirstTeam += 1;
    }
    expect(inFirstTeam).toBeGreaterThanOrEqual(35);
    expect(inFirstTeam).toBeLessThanOrEqual(65);
  });
});

describe('pickCaptain', () => {
  it('AC-023: returns the index of the top-rated member', () => {
    expect(
      pickCaptain(
        {
          members: [
            { name: 'a', rating: 3 },
            { name: 'b', rating: 8 },
          ],
          total: 11,
          captain: 0,
        },
        makeRng(2),
      ),
    ).toBe(1);
  });
});

describe('clampTeamCount', () => {
  it('AC-031: raises a count below two up to two, with a note', () => {
    expect(clampTeamCount(1, 12)).toEqual({
      value: 2,
      note: 'Team count set to 2 — at least 2 teams.',
    });
  });

  it('AC-031: caps the count at ten, with a note', () => {
    expect(clampTeamCount(15, 12)).toEqual({
      value: 10,
      note: 'Team count set to 10 — at most 10 teams.',
    });
  });

  it('AC-031: caps the count at the number of people when there are fewer than ten', () => {
    expect(clampTeamCount(20, 8)).toEqual({
      value: 8,
      note: 'Team count set to 8 — no more teams than people.',
    });
  });

  it('AC-031: leaves a valid count untouched', () => {
    expect(clampTeamCount(4, 12)).toEqual({ value: 4, note: null });
  });
});

describe('formatTeamsText', () => {
  it('AC-028: renders one line per team with the total and the captain', () => {
    const teams = [
      {
        members: [
          { name: 'Alice', rating: 8 },
          { name: 'Bo', rating: 6 },
        ],
        total: 14,
        captain: 0,
      },
      {
        members: [
          { name: 'Cy', rating: 7 },
          { name: 'Dee', rating: 6 },
        ],
        total: 13,
        captain: 1,
      },
    ];
    expect(formatTeamsText(teams, '2 teams', true)).toBe(
      ['2 teams', '', 'Team 1 — 14 pts: Alice (C), Bo', 'Team 2 — 13 pts: Cy, Dee (C)'].join('\n'),
    );
  });

  it('AC-025: leaves out the total when nobody was rated', () => {
    const teams = [
      {
        members: [
          { name: 'Alice', rating: 0 },
          { name: 'Bo', rating: 0 },
        ],
        total: 0,
        captain: 0,
      },
    ];
    expect(formatTeamsText(teams, '2 teams', false)).toBe(
      ['2 teams', '', 'Team 1: Alice (C), Bo'].join('\n'),
    );
  });
});

describe('formatTeamsSummary', () => {
  it('AC-041: shows the team totals when ratings were used', () => {
    const teams = [
      { total: 23, members: [], captain: 0 },
      { total: 22, members: [], captain: 0 },
    ];
    expect(formatTeamsSummary(teams, true)).toBe('23 vs 22');
  });

  it('AC-041: shows team sizes when nobody was rated', () => {
    const teams = [
      { total: 0, members: new Array(6).fill(null), captain: 0 },
      { total: 0, members: new Array(6).fill(null), captain: 0 },
    ];
    expect(formatTeamsSummary(teams, false)).toBe('2 teams of 6');
  });

  it('AC-041: shows a size range when the teams are not the same size', () => {
    const teams = [
      { total: 0, members: new Array(6).fill(null), captain: 0 },
      { total: 0, members: new Array(5).fill(null), captain: 0 },
    ];
    expect(formatTeamsSummary(teams, false)).toBe('2 teams of 5–6');
  });
});
