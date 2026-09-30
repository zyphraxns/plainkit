/**
 * 倒计时 / 纪念日卡片——纯逻辑层。
 *
 * 本目录下的文件禁止出现 document / window / navigator / localStorage
 * （DESIGN.md 红线 1）。所有可能因用户输入而失败的函数返回 Result<T>，
 * 不抛异常（DESIGN.md §9.2）。
 *
 * 对应验收标准：specs/features/countdown-card.md
 */
import type { Result } from '@/lib/shared/result';
import { err, ok } from '@/lib/shared/result';

export const THEMES = ['light', 'midnight', 'warm'] as const;
export type CardTheme = (typeof THEMES)[number];

/** 卡片的完整状态，也是 URL 参数的编解码对象。 */
export interface CountdownCardState {
  /** 可为空串：空 = 卡片不渲染标题行（AC-009） */
  title: string;
  /** 规范化的 YYYY-MM-DD */
  date: string;
  theme: CardTheme;
  /** 可为空串（AC-008 上限 80 字符） */
  note: string;
}

/** decodeState 返回的原始字符串形态。 */
export interface CountdownStateInput {
  title: string;
  date: string;
  theme: string;
  note: string;
}

/** 卡片读数的三种状态：未来倒计时 / 过去纪念日 / 就是今天。 */
export type CountdownMode = 'countdown' | 'anniversary' | 'today';

export interface CountdownResult {
  mode: CountdownMode;
  /** 天数恒为非负；方向由 mode 表达 */
  days: number;
  /** 卡片主文案，如 "265 days to go" */
  headline: string;
}

const MAX_TITLE_LENGTH = 60;
const MAX_NOTE_LENGTH = 80;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * 解析目标日期。
 *
 * 必须是真实日历日期（2027-02-30、平年的 02-29 都算无效）。
 */
export function parseDate(input: string): Result<string> {
  const trimmed = input.trim();
  if (trimmed === '') return err('Enter a date.');
  if (!ISO_DATE_PATTERN.test(trimmed)) return err('Enter a valid date.');

  const year = Number(trimmed.slice(0, 4));
  const month = Number(trimmed.slice(5, 7));
  const day = Number(trimmed.slice(8, 10));
  const probe = new Date(year, month - 1, day);
  // 构造后回读各分量：越界的日/月会被 Date 进位，回读不一致即为无效日期。
  // （用本地时区构造，避免 new Date("YYYY-MM-DD") 的 UTC 解析偏差，AC-014）
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return err('Enter a valid date.');
  }

  return ok(trimmed);
}

/** 解析标题。空串合法（AC-009），上限 60 字符。 */
export function parseTitle(input: string): Result<string> {
  const value = input.trim();
  if (value.length > MAX_TITLE_LENGTH) {
    return err('Title must be 60 characters or fewer.');
  }
  return ok(value);
}

/** 解析附言。空串合法，上限 80 字符（AC-008）。 */
export function parseNote(input: string): Result<string> {
  const value = input.trim();
  if (value.length > MAX_NOTE_LENGTH) {
    return err('Note must be 80 characters or fewer.');
  }
  return ok(value);
}

/** 解析主题名，必须是 THEMES 之一。 */
export function parseTheme(input: string): Result<CardTheme> {
  const trimmed = input.trim();
  const match = THEMES.find((theme) => theme === trimmed);
  if (match === undefined) {
    return err('Pick one of the available themes.');
  }
  return ok(match);
}

/** 目标日期在本地时区的零点。 */
function localMidnight(iso: string): Date {
  return new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

/**
 * 计算卡片读数。
 *
 * 天数按本地时区零点对齐（BR-004 / AC-014）：两边都取零点后相差恒为整天数，
 * 用 round 吸收 DST 造成的 23/25 小时日。
 */
export function computeCountdown(target: string, now: Date): CountdownResult {
  const targetMidnight = localMidnight(target).getTime();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((targetMidnight - todayMidnight) / 86_400_000);

  if (diffDays === 0) {
    return { mode: 'today', days: 0, headline: 'Today is the day!' };
  }
  if (diffDays > 0) {
    const unit = diffDays === 1 ? 'day' : 'days';
    return {
      mode: 'countdown',
      days: diffDays,
      headline: `${diffDays} ${unit} to go`,
    };
  }
  const days = -diffDays;
  const unit = days === 1 ? 'day' : 'days';
  return { mode: 'anniversary', days, headline: `${days} ${unit} ago` };
}

/** 把 YYYY-MM-DD 格式化为 "June 15, 2027"（en-US，确定性输出）。 */
export function formatTargetDate(iso: string): string {
  const month = MONTHS[Number(iso.slice(5, 7)) - 1];
  const day = Number(iso.slice(8, 10));
  return `${month} ${day}, ${iso.slice(0, 4)}`;
}

/** 把状态编码进 URL 参数。date 与 theme 恒写入，title / note 为空则省略。 */
export function encodeState(state: CountdownCardState): URLSearchParams {
  const params = new URLSearchParams();
  params.set('date', state.date);
  params.set('theme', state.theme);
  if (state.title !== '') params.set('title', state.title);
  if (state.note !== '') params.set('note', state.note);
  return params;
}

/**
 * 从 URL 参数解码状态。
 *
 * 链接会被转发、参数可能被篡改（DESIGN §16：URL 里的值不可信），所以每个
 * 参数都走与手输完全相同的 parse 路径。任何一步失败——包括 date 参数整体
 * 缺失——都返回 null，调用方据此回退到默认空状态（AC-015），绝不崩溃。
 */
export function decodeState(params: URLSearchParams): CountdownCardState | null {
  const rawDate = params.get('date');
  if (rawDate === null) return null;

  const date = parseDate(rawDate);
  if (!date.ok) return null;

  const theme = parseTheme(params.get('theme') ?? '');
  if (!theme.ok) return null;

  const title = parseTitle(params.get('title') ?? '');
  if (!title.ok) return null;

  const note = parseNote(params.get('note') ?? '');
  if (!note.ok) return null;

  return { title: title.value, date: date.value, theme: theme.value, note: note.value };
}

/** 本地草稿的存储键（BR-005）：页面脚本层单点读写，改名会丢掉用户已存的草稿。 */
export const DRAFT_STORAGE_KEY = 'plainkit:countdown-card:draft';

/**
 * 本地草稿的四个**原始**字段值（BR-005）。
 *
 * 与 URL 里的 `CountdownCardState` 关键区别：`date` 允许空串——草稿要能保存
 * 「填了一半」的进度，而分享链接缺了 date 就没有卡片可言。
 */
export interface CardDraft {
  title: string;
  /** 空串 = 还没选日期；非空时必须是合法 ISO（浏览器 date 输入只会给这两种） */
  date: string;
  theme: CardTheme;
  note: string;
}

/**
 * 把草稿序列化成待写入 localStorage 的字符串。
 *
 * 校验与 `readDraft` 完全对称：写不出将来读不回来的内容。
 * 三项文本（title / date / note）全空时返回 null——调用方据此删键，
 * 页面上等价于「清空表单即丢掉草稿」（AC-024）。
 */
export function writeDraft(draft: CardDraft): string | null {
  if (draft.title === '' && draft.date === '' && draft.note === '') return null;
  if (draft.title.length > MAX_TITLE_LENGTH) return null;
  if (draft.note.length > MAX_NOTE_LENGTH) return null;
  if (!THEMES.some((theme) => theme === draft.theme)) return null;
  if (draft.date !== '' && !parseDate(draft.date).ok) return null;
  return JSON.stringify({
    title: draft.title,
    date: draft.date,
    theme: draft.theme,
    note: draft.note,
  });
}

/**
 * 反序列化本地草稿。
 *
 * localStorage 里的值一律视为不可信（用户手改、扩展注入、旧版本残留），所以
 * 每一步都用 abort 而不是兜底修正：任何一处不对都返回 null，页面当作「没有
 * 草稿」处理，绝不回填半截数据（AC-027）。
 */
export function readDraft(raw: string | null): CardDraft | null {
  if (raw === null || raw === '') return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

  const record: Record<string, unknown> = { ...parsed };
  const title = record['title'];
  const date = record['date'];
  const theme = record['theme'];
  const note = record['note'];
  if (typeof title !== 'string') return null;
  if (typeof date !== 'string') return null;
  if (typeof theme !== 'string') return null;
  if (typeof note !== 'string') return null;

  if (title.length > MAX_TITLE_LENGTH) return null;
  if (note.length > MAX_NOTE_LENGTH) return null;
  if (date !== '' && !parseDate(date).ok) return null;

  const parsedTheme = parseTheme(theme);
  if (!parsedTheme.ok) return null;

  return { title, date, theme: parsedTheme.value, note };
}
