/**
 * 打字测试：逐字符比对、成绩统计、评级与文案（s10 T1）。
 *
 * 测试名以 `AC-xxx:` 开头，与 specs/features/typing-test.md 一一对应。
 */
import { describe, expect, it } from 'vitest';

import {
  computeStats,
  diffTyping,
  formatResultLabels,
  ratingFor,
  buildTargetBuffer,
  needsMoreTarget,
  decodeResult,
  encodeResult,
  normalizeCustomText,
} from './index';

describe('diffTyping', () => {
  it('AC-003: marks typed correct characters and leaves the rest pending', () => {
    const diff = diffTyping('the quick', 'the q');
    expect(diff.states.slice(0, 5)).toEqual([
      'correct',
      'correct',
      'correct',
      'correct',
      'correct',
    ]);
    expect(diff.states.slice(5)).toEqual(['pending', 'pending', 'pending', 'pending']);
    expect(diff.correct).toBe(5);
  });

  it('AC-004: keeps comparing position by position after a wrong character', () => {
    const diff = diffTyping('the quick', 'the xq');
    expect(diff.states[4]).toBe('wrong');
    // 自由前进：后续字符照常按位置比对（'q' 对目标 'u'，仍为错），不被阻塞
    expect(diff.states[5]).toBe('wrong');
    expect(diff.correct).toBe(4);
  });

  it('AC-024: a full match counts every character as correct', () => {
    const diff = diffTyping('ab', 'ab');
    expect(diff.states).toEqual(['correct', 'correct']);
    expect(diff.correct).toBe(2);
  });

  it('AC-025: recomputing after a backspace drops the error from the count', () => {
    const before = diffTyping('the quick', 'the x');
    expect(before.correct).toBe(4);

    const after = diffTyping('the quick', 'the q');
    expect(after.states[4]).toBe('correct');
    expect(after.correct).toBe(5);
  });

  it('AC-003: spaces take part in the comparison', () => {
    expect(diffTyping('a b', 'a b').correct).toBe(3);
    expect(diffTyping('a b', 'a-b').states[1]).toBe('wrong');
  });

  it('BR-006: typed characters beyond the target count as wrong', () => {
    const diff = diffTyping('ab', 'abc');
    expect(diff.states[2]).toBe('wrong');
    expect(diff.correct).toBe(2);
  });
});

describe('computeStats', () => {
  it('AC-027: 60 s, 310 correct of 320 typed → 62 WPM at 97%', () => {
    const target = 'x'.repeat(320);
    const typed = 'x'.repeat(310) + 'y'.repeat(10);
    const stats = computeStats(target, typed, 60000);
    if (!stats.ok) throw new Error(stats.message);
    expect(stats.value.wpm).toBe(62);
    expect(stats.value.accuracy).toBe(97);
    expect(stats.value.seconds).toBe(60);
    expect(stats.value.correct).toBe(310);
    expect(stats.value.typed).toBe(320);
  });

  it('AC-010: 30 s, 155 correct → 62 WPM from the actual elapsed time', () => {
    const stats = computeStats('x'.repeat(155), 'x'.repeat(155), 30000);
    if (!stats.ok) throw new Error(stats.message);
    expect(stats.value.wpm).toBe(62);
    expect(stats.value.seconds).toBe(30);
  });

  it('AC-014: under 15 seconds does not settle', () => {
    const stats = computeStats('hello world', 'hello', 8000);
    expect(stats.ok).toBe(false);
    if (!stats.ok) expect(stats.message).toContain('15');
  });

  it('AC-015: zero input after a full minute does not settle', () => {
    const stats = computeStats('hello world', '', 60000);
    expect(stats.ok).toBe(false);
    if (stats.ok) throw new Error('must not settle without input');
  });

  it('AC-016: ending early with zero input does not settle', () => {
    const stats = computeStats('hello world', '', 20000);
    expect(stats.ok).toBe(false);
  });

  it('AC-024: a perfect run reports 100% accuracy', () => {
    const stats = computeStats('hello', 'hello', 60000);
    if (!stats.ok) throw new Error(stats.message);
    expect(stats.value.accuracy).toBe(100);
  });
});

describe('ratingFor', () => {
  it.each([
    [0, 'Getting started'],
    [24, 'Getting started'],
    [25, 'Steady'],
    [39, 'Steady'],
    [40, 'Comfortable'],
    [54, 'Comfortable'],
    [55, 'Fast'],
    [69, 'Fast'],
    [70, 'Very fast'],
    [140, 'Very fast'],
  ])('AC-008 / BR-008: %i WPM → %s', (wpm, rating) => {
    expect(ratingFor(wpm)).toBe(rating);
  });
});

describe('buildTargetBuffer', () => {
  const passages = ['aaa', 'bbb', 'ccc'];

  it('AC-013 / AC-034: joins passages in fixed order until long enough', () => {
    expect(buildTargetBuffer(passages, 0, 6)).toEqual({ text: 'aaabbb', nextIndex: 2 });
  });

  it('AC-013 / AC-034: wraps around to the first passage after the last one', () => {
    const buffer = buildTargetBuffer(passages, 2, 6);
    expect(buffer.text.startsWith('cccaaa')).toBe(true);
    expect(buffer.nextIndex).toBe(1);
  });

  it('BR-005: includes the whole passage that crosses the minimum', () => {
    // 最小长度 5，但下一段是整段拼入的：结果 6 字符，不截半段
    expect(buildTargetBuffer(passages, 0, 5).text).toBe('aaabbb');
  });

  it('BR-005: tolerates an out-of-range start index by wrapping', () => {
    expect(buildTargetBuffer(passages, 5, 3).text.startsWith('ccc')).toBe(true);
  });
});

describe('needsMoreTarget', () => {
  it('AC-018: asks for more when the typed input approaches the end', () => {
    expect(needsMoreTarget(400, 340)).toBe(true);
    expect(needsMoreTarget(400, 200)).toBe(false);
  });
});

describe('encodeResult / decodeResult', () => {
  it('AC-012: round-trips a shared result', () => {
    const params = encodeResult({ textIndex: 2, wpm: 62, accuracy: 97, seconds: 60 });
    expect(decodeResult(params)).toEqual({ textIndex: 2, wpm: 62, accuracy: 97, seconds: 60 });
  });

  it('AC-012: rejects out-of-range or missing values instead of rendering them', () => {
    const make = (
      overrides: Partial<Record<'t' | 'w' | 'a' | 's', string | undefined>>,
    ): URLSearchParams => {
      const params = encodeResult({ textIndex: 0, wpm: 62, accuracy: 97, seconds: 60 });
      for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined) params.delete(key);
        else params.set(key, value);
      }
      return params;
    };

    expect(decodeResult(make({ w: '9999' }))).toBeNull();
    expect(decodeResult(make({ a: '-5' }))).toBeNull();
    expect(decodeResult(make({ s: '3' }))).toBeNull();
    expect(decodeResult(make({ t: 'abc' }))).toBeNull();
    expect(decodeResult(make({ w: undefined }))).toBeNull();
  });
});

describe('formatResultLabels', () => {
  it('AC-030 / AC-036: builds the readout, note and detail from one stats value', () => {
    const target = 'x'.repeat(320);
    const typed = 'x'.repeat(310) + 'y'.repeat(10);
    const stats = computeStats(target, typed, 60000);
    if (!stats.ok) throw new Error(stats.message);

    const labels = formatResultLabels(stats.value);
    expect(labels.readout).toBe('62 WPM');
    expect(labels.note).toBe('97% accuracy · Fast');
    expect(labels.detail).toBe('97% accuracy · in 60 seconds');
  });

  it('AC-030: the shortest valid run (15 s) still reads naturally', () => {
    const stats = computeStats('hello', 'hello', 15000);
    if (!stats.ok) throw new Error(stats.message);
    expect(formatResultLabels(stats.value).detail).toBe('100% accuracy · in 15 seconds');
  });

  it('AC-048: the detail line follows the actual duration (120 s tier)', () => {
    const stats = computeStats('x'.repeat(620), 'x'.repeat(620), 120000);
    if (!stats.ok) throw new Error(stats.message);
    expect(formatResultLabels(stats.value).detail).toBe('100% accuracy · in 120 seconds');
  });
});

describe('normalizeCustomText (CR-002)', () => {
  it('AC-041: collapses newlines, tabs and runs of spaces into single spaces', () => {
    const result = normalizeCustomText('hello\n\n  world\t\ttabbed   text');
    expect(result).toEqual({ status: 'ok', text: 'hello world tabbed text' });
  });

  it('AC-041: trims leading and trailing whitespace', () => {
    expect(normalizeCustomText('  \n padded \n ')).toEqual({ status: 'ok', text: 'padded' });
  });

  it('AC-050: accepts text of exactly 1000 characters', () => {
    const result = normalizeCustomText('a'.repeat(1000));
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.text.length).toBe(1000);
  });

  it('AC-050: rejects text longer than 1000 characters after collapsing', () => {
    // 600 个双字符词 + 600 个空格 → 清洗后 1199 字符
    const result = normalizeCustomText(Array.from({ length: 600 }, () => 'ab').join('  '));
    expect(result.status).toBe('too-long');
    expect('text' in result).toBe(false);
  });

  it('AC-051: treats whitespace-only input as empty', () => {
    expect(normalizeCustomText('   \n\t  ').status).toBe('empty');
    expect(normalizeCustomText('').status).toBe('empty');
  });

  it('AC-052: preserves non-ASCII characters verbatim', () => {
    const result = normalizeCustomText('Grüße aus Köln — schönes Wetter, nicht wahr?');
    expect(result).toEqual({
      status: 'ok',
      text: 'Grüße aus Köln — schönes Wetter, nicht wahr?',
    });
  });
});

describe('CR-002: single-passage buffer (custom text loop)', () => {
  it('AC-043: a single-item passage list repeats the same passage forever', () => {
    const buffer = buildTargetBuffer(['abc'], 0, 8);
    expect(buffer.text).toBe('abcabcabc');
    expect(buffer.nextIndex).toBe(0);
  });
});

describe('CR-002: encodeResult / decodeResult extensions', () => {
  it('AC-046: an old v0.4 link decodes to exactly the v1 shape (no new keys)', () => {
    const params = new URLSearchParams('t=3&w=62&a=97&s=60');
    expect(decodeResult(params)).toEqual({ textIndex: 3, wpm: 62, accuracy: 97, seconds: 60 });
  });

  it('AC-046: a built-in result round-trips with tier and duration', () => {
    const params = encodeResult({
      textIndex: 7,
      wpm: 70,
      accuracy: 98,
      seconds: 30,
      tier: 'advanced',
      duration: 30,
    });
    expect(decodeResult(params)).toEqual({
      textIndex: 7,
      wpm: 70,
      accuracy: 98,
      seconds: 30,
      tier: 'advanced',
      duration: 30,
    });
  });

  it('AC-045: a custom-text result round-trips with the full text', () => {
    const params = encodeResult({
      customText: 'Grüße aus Köln, schön hässlich vocab list: qui, que, quand',
      wpm: 55,
      accuracy: 96,
      seconds: 120,
      duration: 120,
    });
    expect(decodeResult(params)).toEqual({
      customText: 'Grüße aus Köln, schön hässlich vocab list: qui, que, quand',
      wpm: 55,
      accuracy: 96,
      seconds: 120,
      duration: 120,
    });
  });

  it('AC-056: an illegal duration is dropped, not fatal — the link still decodes', () => {
    const params = encodeResult({ textIndex: 0, wpm: 50, accuracy: 90, seconds: 60, duration: 47 });
    expect(decodeResult(params)).toEqual({ textIndex: 0, wpm: 50, accuracy: 90, seconds: 60 });
  });

  it('AC-056: duration accepts exactly the four preset values', () => {
    for (const duration of [15, 30, 60, 120]) {
      const params = encodeResult({
        textIndex: 0,
        wpm: 50,
        accuracy: 90,
        seconds: duration,
        duration,
      });
      expect(decodeResult(params)?.duration).toBe(duration);
    }
  });

  it('AC-053: a 120-second run is a valid shared sample (maxSeconds raised)', () => {
    const params = encodeResult({ textIndex: 0, wpm: 50, accuracy: 90, seconds: 120 });
    expect(decodeResult(params)).toEqual({ textIndex: 0, wpm: 50, accuracy: 90, seconds: 120 });
  });

  it('AC-050: a custom text beyond the 1000-character limit makes the link invalid', () => {
    const params = encodeResult({
      customText: 'a'.repeat(1001),
      wpm: 50,
      accuracy: 90,
      seconds: 60,
    });
    expect(decodeResult(params)).toBeNull();
  });

  it('AC-051: an empty custom text makes the link invalid', () => {
    const params = encodeResult({ customText: '', wpm: 50, accuracy: 90, seconds: 60 });
    expect(decodeResult(params)).toBeNull();
  });

  it('AC-046: an unknown tier is dropped, not fatal', () => {
    const params = encodeResult({ textIndex: 0, wpm: 50, accuracy: 90, seconds: 60 });
    params.set('r', 'expert');
    expect(decodeResult(params)).toEqual({ textIndex: 0, wpm: 50, accuracy: 90, seconds: 60 });
  });
});
