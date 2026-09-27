/**
 * 随机分组 / 抽签器——纯逻辑层。
 *
 * 本目录下的文件禁止出现 document / window / navigator / localStorage
 * （DESIGN.md 红线 1）。所有可能因用户输入而失败的函数返回 Result<T>，
 * 不抛异常（DESIGN.md §9.2）。
 *
 * 对应验收标准：specs/features/random-picker.md
 */
import type { Result } from '@/lib/shared/result';
import { err, ok } from '@/lib/shared/result';

/** 用户可见的随机源签名；页面层传 crypto.getRandomValues 的包装。 */
export type RandomSource = () => number;

/** splitNames 的返回：解析出的名单 + 重复出现的名字（只报告，不删除）。 */
export interface SplitResult {
  names: string[];
  duplicates: string[];
}

/**
 * 把原始输入切分成名单。
 *
 * 兼容换行、逗号、分号三种分隔（AC-008），忽略空项与首尾空白。
 * 重复名字原样保留在 names 里，并在 duplicates 中按第二次出现的顺序
 * 报告（每个名字只报告一次，AC-009）——去不删由用户决定。
 */
export function splitNames(input: string): SplitResult {
  const parts = input
    .split(/[\n,;]/)
    .map((part) => part.trim())
    .filter((part) => part !== '');

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const name of parts) {
    if (seen.has(name)) {
      duplicates.add(name);
    } else {
      seen.add(name);
    }
  }

  return { names: parts, duplicates: [...duplicates] };
}

/** 一键去重：保留每个名字的首次出现（AC-009）。 */
export function dedupeNames(names: string[]): string[] {
  return [...new Set(names)];
}

/**
 * 解析「组数 / 每组人数 / 抽几个人」这类 1–max 的整数。
 *
 * `label` 是用户可见的字段名（如 "Number of groups"），必须出现在
 * 错误消息里（AC-011 / 012）。
 */
export function parseCount(input: string, max: number, label: string): Result<number> {
  const trimmed = input.trim();
  if (trimmed === '') {
    return err(`Enter the ${label.toLowerCase()} (between 1 and ${max}).`);
  }
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 1 || value > max) {
    return err(`${label} must be a whole number between 1 and ${max}.`);
  }
  return ok(value);
}

/**
 * Fisher-Yates 洗牌，返回新数组、不修改原数组。
 *
 * 随机源通过参数注入：页面层传 crypto.getRandomValues 的包装（BR-003），
 * 测试传确定性随机源。`Math.random` 一律不用。
 */
export function shuffle<T>(items: T[], random: RandomSource): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const picked = result[j]!;
    result[j] = result[i]!;
    result[i] = picked;
  }
  return result;
}

/**
 * 把名单随机分成 groupCount 组，均衡分配。
 *
 * 先洗牌再连续切片：前 `n mod k` 组各多 1 人（BR-005），组间人数差 ≤ 1
 * （AC-001 / 002）。前置条件：2 ≤ groupCount ≤ names.length（页面层用
 * parseCount 保证）。
 */
export function assignGroups(
  names: string[],
  groupCount: number,
  random: RandomSource,
): string[][] {
  const shuffled = shuffle(names, random);
  const base = Math.floor(names.length / groupCount);
  const remainder = names.length % groupCount;

  const groups: string[][] = [];
  let cursor = 0;
  for (let i = 0; i < groupCount; i += 1) {
    const size = base + (i < remainder ? 1 : 0);
    groups.push(shuffled.slice(cursor, cursor + size));
    cursor += size;
  }
  return groups;
}

/** 不放回抽人：洗牌后取前 count 个，互不相同（AC-003）。 */
export function pickNames(names: string[], count: number, random: RandomSource): string[] {
  return shuffle(names, random).slice(0, count);
}

/** formatGroupsText 的共享部分：头部行 + 各块之间以空行分隔。 */
function textLines(header: string, blocks: string[][]): string {
  const lines: string[] = [header, ''];
  blocks.forEach((block, index) => {
    if (index > 0) lines.push('');
    lines.push(...block);
  });
  return lines.join('\n');
}

/** 分组结果 → 可直接粘贴进聊天软件的纯文本（AC-006）。 */
export function formatGroupsText(groups: string[][], header: string): string {
  return textLines(
    header,
    groups.map((group, index) => [`Group ${index + 1}`, ...group]),
  );
}

/** 抽人 / 随机排序结果 → 带序号的纯文本（AC-006）。 */
export function formatListText(names: string[], header: string): string {
  const lines = [header, '', ...names.map((name, index) => `${index + 1}. ${name}`)];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 团队模式：按能力值平衡分队
// 验收标准：specs/features/random-picker-team-mode.md（AC-019 起）
// ---------------------------------------------------------------------------

/** 名单条目：rating 为 null 表示这个人没写评分。 */
export interface RosterEntry {
  name: string;
  rating: number | null;
}

/** 补齐评分后的条目（fillMissingRatings 的输出）。 */
export interface RatedEntry {
  name: string;
  rating: number;
}

/** 一支队伍：成员、总分、队长在成员数组中的下标。 */
export interface Team {
  members: RatedEntry[];
  total: number;
  captain: number;
}

/** 评分上限（BR-010）。超过这个值的行整体当作名字。 */
const MAX_RATING = 999;

/** 合法评分：非负、最多一位小数。 */
const RATING_RE = /^\d+(?:\.\d+)?$/;

/** 保留一位小数，避免浮点累加把 7.7 变成 7.700000000000001。 */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * 解析带评分的名单。
 *
 * 只有「冒号后是合法数字且不超过上限」才计分，否则整行作为名字并计入
 * `badRatingLines`（BR-010，AC-030）。重复按名字部分判定——`Alice:8`
 * 与 `Alice:9` 是同一个人（AC-034）。
 */
export function parseRoster(input: string): {
  entries: RosterEntry[];
  duplicates: string[];
  badRatingLines: number;
} {
  const entries: RosterEntry[] = [];
  let badRatingLines = 0;

  for (const part of input.split(/[\n,;]/)) {
    const trimmed = part.trim();
    if (trimmed === '') continue;

    const colon = trimmed.indexOf(':');
    if (colon === -1) {
      entries.push({ name: trimmed, rating: null });
      continue;
    }

    const raw = trimmed.slice(colon + 1).trim();
    const value = RATING_RE.test(raw) ? Number(raw) : Number.NaN;
    if (!Number.isNaN(value) && value <= MAX_RATING) {
      entries.push({ name: trimmed.slice(0, colon).trim(), rating: value });
    } else {
      entries.push({ name: trimmed, rating: null });
      badRatingLines += 1;
    }
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.name)) {
      duplicates.add(entry.name);
    } else {
      seen.add(entry.name);
    }
  }

  return { entries, duplicates: [...duplicates], badRatingLines };
}

/**
 * 给没写评分的人补上「已评分者的平均分」。
 *
 * 一个人都没评分时 `rated` 为 false，全员同分——分队退化为纯随机均衡
 * 分队（BR-010，AC-024 / 025）。
 */
export function fillMissingRatings(entries: RosterEntry[]): {
  entries: RatedEntry[];
  average: number;
  unratedCount: number;
  rated: boolean;
} {
  const ratedValues = entries
    .map((entry) => entry.rating)
    .filter((rating): rating is number => rating !== null);
  const rated = ratedValues.length > 0;
  const sum = ratedValues.reduce((total, value) => total + value, 0);
  const average = rated ? round1(sum / ratedValues.length) : 0;

  return {
    entries: entries.map((entry) => ({ name: entry.name, rating: entry.rating ?? average })),
    average,
    unratedCount: entries.length - ratedValues.length,
    rated,
  };
}

/**
 * 按评分把名单分成 teamCount 支队伍，总分尽量接近。
 *
 * 先洗牌（同分者无偏），再按评分从高到低依次分给「当前总分最低且未满员」
 * 的队；总分与人数都相同时给序号小的队。**人数均衡优先于分数均衡**：每队
 * 人数上限 = ceil(人数 / 队数)，因此任意两队人数差 ≤ 1（BR-008 / 009）。
 */
export function balanceTeams(
  entries: RatedEntry[],
  teamCount: number,
  random: RandomSource,
): Team[] {
  const ordered = [...shuffle(entries, random)].sort((a, b) => b.rating - a.rating);
  const capacity = Math.ceil(ordered.length / teamCount);
  const members: RatedEntry[][] = Array.from({ length: teamCount }, () => []);
  const totals = new Array<number>(teamCount).fill(0);

  for (const entry of ordered) {
    let target = -1;
    for (let i = 0; i < teamCount; i += 1) {
      if (members[i]!.length >= capacity) continue;
      if (target === -1 || totals[i]! < totals[target]!) target = i;
    }
    // 理论上不可达：人数上限之和 ≥ 总人数，至少有一队未满员。
    const index = target === -1 ? 0 : target;
    members[index]!.push(entry);
    totals[index] = round1(totals[index]! + entry.rating);
  }

  return members.map((teamMembers) => {
    const team: Team = {
      members: teamMembers,
      total: round1(teamMembers.reduce((sum, member) => sum + member.rating, 0)),
      captain: 0,
    };
    team.captain = pickCaptain(team, random);
    return team;
  });
}

/**
 * 队长下标：评分最高者；出现并列时随机挑一个（BR-011，AC-023）。
 */
export function pickCaptain(team: Team, random: RandomSource): number {
  const top = Math.max(...team.members.map((member) => member.rating));
  const best = team.members
    .map((_, index) => index)
    .filter((index) => team.members[index]!.rating === top);
  if (best.length === 1) return best[0]!;
  const picked = Math.min(Math.floor(random() * best.length), best.length - 1);
  return best[picked]!;
}

/**
 * 纠正队伍数：至少 2、最多 10、不得超过人数，并给出英文说明（AC-031）。
 */
export function clampTeamCount(value: number, max: number): { value: number; note: string | null } {
  if (value < 2) {
    return { value: 2, note: 'Team count set to 2 — at least 2 teams.' };
  }
  const limit = Math.min(10, max);
  if (value > limit) {
    const note =
      limit < 10
        ? `Team count set to ${limit} — no more teams than people.`
        : `Team count set to ${limit} — at most ${limit} teams.`;
    return { value: limit, note };
  }
  return { value, note: null };
}

/** 分队结果 → 可直接粘贴进聊天软件的纯文本，每队一行（AC-028）。 */
export function formatTeamsText(teams: Team[], header: string, rated: boolean): string {
  const lines: string[] = [header, ''];
  teams.forEach((team, index) => {
    const members = team.members
      .map((member, i) => (i === team.captain ? `${member.name} (C)` : member.name))
      .join(', ');
    lines.push(
      rated ? `Team ${index + 1} — ${team.total} pts: ${members}` : `Team ${index + 1}: ${members}`,
    );
  });
  return lines.join('\n');
}

/** 结果读数文案：有评分时比总分，没评分时说队数与每队人数（AC-041）。 */
export function formatTeamsSummary(teams: Team[], rated: boolean): string {
  const teamsWord = teams.length === 1 ? 'team' : 'teams';
  if (rated) {
    const totals = teams.map((team) => String(team.total));
    return teams.length === 2 ? `${totals[0]} vs ${totals[1]}` : totals.join(' / ');
  }
  const sizes = teams.map((team) => team.members.length);
  const min = Math.min(...sizes);
  const max = Math.max(...sizes);
  return `${teams.length} ${teamsWord} of ${min === max ? `${max}` : `${min}–${max}`}`;
}
