/**
 * 打字测试：逐字符比对、成绩统计、评级与文案。
 *
 * 本文件是纯函数，不出现 document / window（DESIGN.md §0.2 红线 1）。
 * 所有函数接收 `target` 参数，不依赖内置文本——测试与页面各自注入。
 *
 * AC 对应 specs/features/typing-test.md；任务拆分见 typing-test_任务规划.md。
 */
import type { Result } from '@/lib/shared/result';

import { roundTo } from '@/lib/shared/format';

/** 一个字符相对目标文本的状态：未打 / 打对 / 打错。 */
export type CharState = 'pending' | 'correct' | 'wrong';

/** 逐字符比对结果。states 覆盖 max(target, typed) 长度。 */
export interface TypingDiff {
  states: CharState[];
  correct: number;
}

/** 结算成绩（BR-003 的口径都在这里）。 */
export interface TypingStats {
  /** 四舍五入到整数（AC-036）。 */
  wpm: number;
  /** 整数百分比（AC-036）。 */
  accuracy: number;
  correct: number;
  typed: number;
  /** 实际用时（秒，整数）。提前结束时小于 60（AC-010）。 */
  seconds: number;
}

/** 客观描述式评级，五档，边界含下不含上（BR-008）。 */
export type Rating = 'Getting started' | 'Steady' | 'Comfortable' | 'Fast' | 'Very fast';

/** 结算后的三处文案（AC-030 / AC-036：文案集中一处，不散落在页面里）。 */
export interface ResultLabels {
  /** 结果读数（全页唯一的 --text-readout，AC-028）。 */
  readout: string;
  /** 读数旁的次级说明。 */
  note: string;
  /** 成就卡上的一行详情。 */
  detail: string;
}

/** 最短有效时长（秒）：不足则样本无效，不结算（BR-004）。 */
export const MIN_RESULT_SECONDS = 15;

/**
 * 逐位比对「当前已输入」与目标文本（BR-002 / BR-003）。
 *
 * 空格参与比对；typed 超出 target 的部分记 wrong（maxlength 挡住了正常路径，
 * 这里只是兜底，不抛错——多打的字符如实标错）。
 */
export function diffTyping(target: string, typed: string): TypingDiff {
  const length = Math.max(target.length, typed.length);
  const states: CharState[] = new Array(length);
  let correct = 0;
  for (let i = 0; i < length; i += 1) {
    if (i >= typed.length) {
      states[i] = 'pending';
    } else if (typed[i] === target[i]) {
      states[i] = 'correct';
      correct += 1;
    } else {
      states[i] = 'wrong';
    }
  }
  return { states, correct };
}

/**
 * 结算成绩；无效样本返回 err，页面显示引导而不是 0 WPM（BR-004）。
 *
 * 无效判据：typed = 0（根本没打，AC-015 / 016）或实际用时不足 15 秒
 * （样本太短，WPM 抖动大，显示出来是误导，AC-014）。
 */
export function computeStats(
  target: string,
  typed: string,
  elapsedMs: number,
): Result<TypingStats> {
  if (typed.length === 0) {
    return { ok: false, message: 'Type a few words to get a result.' };
  }
  const seconds = elapsedMs / 1000;
  if (seconds < MIN_RESULT_SECONDS) {
    return {
      ok: false,
      message: `Type for at least ${MIN_RESULT_SECONDS} seconds to get a result.`,
    };
  }

  const { correct } = diffTyping(target, typed);
  const minutes = seconds / 60;
  return {
    ok: true,
    value: {
      wpm: roundTo(correct / 5 / minutes, 0),
      accuracy: roundTo((correct / typed.length) * 100, 0),
      correct,
      typed: typed.length,
      seconds: roundTo(seconds, 0),
    },
  };
}

/** 五档评级（BR-008）：只描述节奏快慢，不做与他人比较——我们没有统计依据。 */
export function ratingFor(wpm: number): Rating {
  if (wpm < 25) return 'Getting started';
  if (wpm < 40) return 'Steady';
  if (wpm < 55) return 'Comfortable';
  if (wpm < 70) return 'Fast';
  return 'Very fast';
}

/** 三处文案一起生成，保证读数、读数旁注与成就卡永远一致（BR-009）。 */
export function formatResultLabels(stats: TypingStats): ResultLabels {
  return {
    readout: `${stats.wpm} WPM`,
    note: `${stats.accuracy}% accuracy · ${ratingFor(stats.wpm)}`,
    detail: `${stats.accuracy}% accuracy · in ${stats.seconds} seconds`,
  };
}

/** 拼好的目标文本，以及按固定顺序轮换后的下一段序号（供续接追加）。 */
export interface TargetBuffer {
  text: string;
  nextIndex: number;
}

/**
 * 从 `startIndex` 起按固定顺序循环拼接段落，直到不短于 `minChars`（BR-005）。
 *
 * **不用随机**——项目要求核心功能确定性，固定顺序让测试可重现（AC-034）。
 * 整段拼入、不截半段；startIndex 越界时取模兜底（decode 校验挡不住所有值）。
 */
export function buildTargetBuffer(
  passages: readonly string[],
  startIndex: number,
  minChars: number,
): TargetBuffer {
  const count = passages.length;
  let index = ((startIndex % count) + count) % count;
  let text = '';
  let appended = 0;
  // 护栏：每次整段拼入至少增加 1 个字符，minChars 次必达上限——既防死循环
  // （词库被塞进空字符串时），也允许单元素词库（CR-002 自定义循环）反复拼到
  // 任意 minChars。原来的 `count * 2` 上限挡住了单元素词库的循环。
  while (text.length < minChars && appended < minChars) {
    text += passages[index];
    index = (index + 1) % count;
    appended += 1;
  }
  return { text, nextIndex: index };
}

/** typed 距 buffer 末尾不足这个字符数时，提前追加下一段（AC-018）。 */
export const APPEND_THRESHOLD = 80;

/** 「打完自动接下一段」的判据：逼近末尾就续接，不等到打满。 */
export function needsMoreTarget(
  textLength: number,
  typedLength: number,
  threshold: number = APPEND_THRESHOLD,
): boolean {
  return typedLength > textLength - threshold;
}

/** 分享链接携带的成绩（BR-009，CR-002 扩展）。
 *  新增字段全部可选：旧链接（无新字段）decode 后不含新键，行为与 v1 一致。 */
export type SharedTier = 'easy' | 'advanced';

export interface SharedResult {
  /** 内置模式：档内段落序号。自定义模式不设置。 */
  textIndex?: number | undefined;
  /** 内置模式：难度档。缺省 = easy（v1 旧链接回落）。 */
  tier?: SharedTier | undefined;
  /** 自定义模式：清洗后的全文。设置时 textIndex / tier 不参与还原。 */
  customText?: string | undefined;
  /** 所选时长（秒，四档之一）。缺省 = 60（v1 旧链接回落）。 */
  duration?: number | undefined;
  wpm: number;
  accuracy: number;
  seconds: number;
}

/** 自定义文本清洗后的长度上限（AC-050，2026-09-30 用户确认）。 */
export const CUSTOM_TEXT_MAX_CHARS = 1000;

/** 清洗结果状态：ok / 空白（AC-051）/ 超限（AC-050）。 */
export type CustomTextStatus = 'ok' | 'empty' | 'too-long';

/**
 * 自定义文本清洗（CR-002）：换行与连续空白压成单个空格、去首尾（AC-041）。
 * 非拉丁字符原样保留（AC-052）；不校验内容本身，只判空与长度。
 */
export function normalizeCustomText(
  raw: string,
): { status: 'ok'; text: string } | { status: 'empty' | 'too-long' } {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text.length === 0) return { status: 'empty' };
  if (text.length > CUSTOM_TEXT_MAX_CHARS) return { status: 'too-long' };
  return { status: 'ok', text };
}

/** 时长四档（BR-001，CR-002）：唯一的合法时长集合，之外一律回落 60。 */
export const DURATIONS = [15, 30, 60, 120] as const;
export type Duration = (typeof DURATIONS)[number];
export const DEFAULT_DURATION: Duration = 60;

/** decodeResult 的合法性范围：越界一律当无效分享链接处理（URL 参数不可信）。 */
const SHARED_LIMITS = {
  maxWpm: 300,
  maxAccuracy: 100,
  minSeconds: MIN_RESULT_SECONDS,
  /** CR-002：120 秒档上线后，分享链接的用时上限同步放宽（AC-053）。 */
  maxSeconds: 120,
  maxTextIndex: 999,
} as const;

function parseSharedInt(
  params: URLSearchParams,
  key: string,
  min: number,
  max: number,
): number | null {
  const raw = params.get(key);
  if (raw === null) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) return null;
  return value;
}

/** 编码分享参数（BR-009）。新字段只在有值时写入，保证旧编码输出不变。 */
export function encodeResult(result: SharedResult): URLSearchParams {
  const params = new URLSearchParams();
  if (result.customText !== undefined) params.set('x', result.customText);
  else if (result.textIndex !== undefined) params.set('t', String(result.textIndex));
  if (result.tier !== undefined) params.set('r', result.tier);
  if (result.duration !== undefined) params.set('d', String(result.duration));
  params.set('w', String(result.wpm));
  params.set('a', String(result.accuracy));
  params.set('s', String(result.seconds));
  return params;
}

/** 解码分享参数；任何一步不合法都返回 null（页面退回正常测试态，不报错）。
 *  CR-002 的新可选字段例外：存在但非法时**丢弃该字段**而不是整体判废——
 *  旧版本构造的链接不至于因为新字段被机器人改坏而整条失效（AC-056）。 */
export function decodeResult(params: URLSearchParams): SharedResult | null {
  const wpm = parseSharedInt(params, 'w', 0, SHARED_LIMITS.maxWpm);
  const accuracy = parseSharedInt(params, 'a', 0, SHARED_LIMITS.maxAccuracy);
  const seconds = parseSharedInt(params, 's', SHARED_LIMITS.minSeconds, SHARED_LIMITS.maxSeconds);
  if (wpm === null || accuracy === null || seconds === null) return null;

  const customRaw = params.get('x');
  if (customRaw !== null) {
    const custom = normalizeCustomText(customRaw);
    if (custom.status !== 'ok') return null;
    return { customText: custom.text, wpm, accuracy, seconds, duration: parseDuration(params) };
  }

  const textIndex = parseSharedInt(params, 't', 0, SHARED_LIMITS.maxTextIndex);
  if (textIndex === null) return null;

  const tierRaw = params.get('r');
  const tier = tierRaw === 'easy' || tierRaw === 'advanced' ? tierRaw : undefined;
  return { textIndex, wpm, accuracy, seconds, tier, duration: parseDuration(params) };
}

/** 时长只认四档；缺省或非法都返回 undefined（页面回落 60，AC-056）。 */
function parseDuration(params: URLSearchParams): Duration | undefined {
  const value = parseSharedInt(params, 'd', 0, SHARED_LIMITS.maxSeconds);
  if (value === null) return undefined;
  return (DURATIONS as readonly number[]).includes(value) ? (value as Duration) : undefined;
}
