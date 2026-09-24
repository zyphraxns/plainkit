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
