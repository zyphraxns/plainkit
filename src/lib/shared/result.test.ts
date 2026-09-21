import { describe, expect, it } from 'vitest';

import { MAX_ERROR_MESSAGE_LENGTH, err, ok } from './result';

describe('ok', () => {
  it('wraps the value with an ok flag', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it('preserves falsy values', () => {
    expect(ok(0)).toEqual({ ok: true, value: 0 });
    expect(ok('')).toEqual({ ok: true, value: '' });
  });
});

describe('err', () => {
  it('wraps the message with a not-ok flag', () => {
    expect(err('Enter a number.')).toEqual({ ok: false, message: 'Enter a number.' });
  });

  it('produces a message short enough for the interface', () => {
    // 界面上的错误提示必须是一句话；超长文案会撑破字段下方的空间。
    expect(MAX_ERROR_MESSAGE_LENGTH).toBeLessThanOrEqual(200);
  });
});
