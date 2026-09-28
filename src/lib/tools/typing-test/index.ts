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
  while (text.length < minChars && appended < count * 2) {
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

/** 分享链接携带的成绩（BR-009）：只编 4 个数，文本由序号在本机页面里还原。 */
export interface SharedResult {
  textIndex: number;
  wpm: number;
  accuracy: number;
  seconds: number;
}

/** decodeResult 的合法性范围：越界一律当无效分享链接处理（URL 参数不可信）。 */
const SHARED_LIMITS = {
  maxWpm: 300,
  maxAccuracy: 100,
  minSeconds: MIN_RESULT_SECONDS,
  maxSeconds: 60,
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

/** 编码分享参数（BR-009）。 */
export function encodeResult(result: SharedResult): URLSearchParams {
  const params = new URLSearchParams();
  params.set('t', String(result.textIndex));
  params.set('w', String(result.wpm));
  params.set('a', String(result.accuracy));
  params.set('s', String(result.seconds));
  return params;
}

/** 解码分享参数；任何一步不合法都返回 null（页面退回正常测试态，不报错）。 */
export function decodeResult(params: URLSearchParams): SharedResult | null {
  const textIndex = parseSharedInt(params, 't', 0, SHARED_LIMITS.maxTextIndex);
  const wpm = parseSharedInt(params, 'w', 0, SHARED_LIMITS.maxWpm);
  const accuracy = parseSharedInt(params, 'a', 0, SHARED_LIMITS.maxAccuracy);
  const seconds = parseSharedInt(params, 's', SHARED_LIMITS.minSeconds, SHARED_LIMITS.maxSeconds);
  if (textIndex === null || wpm === null || accuracy === null || seconds === null) return null;
  return { textIndex, wpm, accuracy, seconds };
}
