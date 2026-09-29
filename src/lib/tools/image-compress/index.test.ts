import { describe, expect, it } from 'vitest';

import {
  MAX_FILE_SIZE,
  MAX_FILES,
  effectiveSettings,
  formatBytes,
  formatSummary,
  isQualityApplicable,
  resolveOutputFilename,
  resolveOutputMime,
  targetSize,
  validateFiles,
  type FileDesc,
  type ImageSettings,
} from './index';

const GLOBAL: ImageSettings = { format: 'jpeg', quality: 80, maxEdge: null };

const file = (name: string, type: string, size: number): FileDesc => ({ name, type, size });

describe('validateFiles', () => {
  it('AC-001: accepts regular image files', () => {
    const result = validateFiles([file('a.jpg', 'image/jpeg', 1000)]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
    expect(result.truncated).toBe(false);
  });

  it('AC-010: rejects a non-image file by mime type', () => {
    const result = validateFiles([file('doc.pdf', 'application/pdf', 100)]);
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected[0]!.reason).toBe('not-image');
  });

  it('AC-010: rejects an unknown extension without an image mime type', () => {
    const result = validateFiles([file('notes.txt', '', 100)]);
    expect(result.rejected[0]!.reason).toBe('not-image');
  });

  it('AC-009: accepts HEIC files (decodability is probed in the page layer)', () => {
    const result = validateFiles([file('IMG_0001.heic', 'image/heic', 2000)]);
    expect(result.accepted).toHaveLength(1);
  });

  it('AC-009: accepts HEIC with an empty mime type via extension', () => {
    const result = validateFiles([file('IMG_0001.heic', '', 2000)]);
    expect(result.accepted).toHaveLength(1);
  });

  it('AC-012: keeps only the first 20 files and flags truncation', () => {
    const items = Array.from({ length: MAX_FILES + 5 }, (_, i) =>
      file(`p${i}.jpg`, 'image/jpeg', 100),
    );
    const result = validateFiles(items);
    expect(result.accepted).toHaveLength(MAX_FILES);
    expect(result.truncated).toBe(true);
  });

  it('AC-013: rejects a single file above the size limit', () => {
    const result = validateFiles([file('big.jpg', 'image/jpeg', MAX_FILE_SIZE + 1)]);
    expect(result.rejected[0]!.reason).toBe('too-large');
  });

  it('AC-013: rejects a file exactly one byte over the limit but accepts the limit itself', () => {
    expect(validateFiles([file('ok.jpg', 'image/jpeg', MAX_FILE_SIZE)]).accepted).toHaveLength(1);
    expect(validateFiles([file('no.jpg', 'image/jpeg', MAX_FILE_SIZE + 1)]).rejected).toHaveLength(
      1,
    );
  });

  it('AC-010/013: keeps valid files when mixed with invalid ones', () => {
    const result = validateFiles([
      file('good.jpg', 'image/jpeg', 100),
      file('doc.pdf', 'application/pdf', 100),
      file('huge.jpg', 'image/jpeg', MAX_FILE_SIZE + 1),
    ]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(2);
  });

  it('AC-014: accepts GIF (first frame handled by the decoder)', () => {
    expect(validateFiles([file('anim.gif', 'image/gif', 500)]).accepted).toHaveLength(1);
  });
});

describe('effectiveSettings', () => {
  it('AC-003: applies the override on top of the global settings', () => {
    const result = effectiveSettings(GLOBAL, { quality: 60 });
    expect(result).toEqual({ format: 'jpeg', quality: 60, maxEdge: null });
  });

  it('AC-003: inherits everything when the override is null', () => {
    expect(effectiveSettings(GLOBAL, null)).toEqual(GLOBAL);
  });

  it('AC-003: does not mutate the global settings object', () => {
    const snapshot = { ...GLOBAL };
    effectiveSettings(GLOBAL, { format: 'png', maxEdge: 1920 });
    expect(GLOBAL).toEqual(snapshot);
  });
});

describe('isQualityApplicable', () => {
  it('AC-015: is false for lossless PNG', () => {
    expect(isQualityApplicable('image/png')).toBe(false);
  });

  it('AC-015: is true for JPEG and WebP', () => {
    expect(isQualityApplicable('image/jpeg')).toBe(true);
    expect(isQualityApplicable('image/webp')).toBe(true);
  });
});

describe('targetSize', () => {
  it('AC-002: scales the long edge down and keeps the aspect ratio', () => {
    expect(targetSize(4000, 3000, 1500)).toEqual({ w: 1500, h: 1125 });
    expect(targetSize(3000, 4000, 1500)).toEqual({ w: 1125, h: 1500 });
  });

  it('AC-002: never upscales when the image is already within the limit', () => {
    expect(targetSize(800, 600, 1920)).toEqual({ w: 800, h: 600 });
  });

  it('AC-002: rounds the short edge and clamps it to 1px', () => {
    expect(targetSize(3, 2, 2)).toEqual({ w: 2, h: 1 });
  });

  it('AC-002: keeps the size when the limit is null (unlimited)', () => {
    expect(targetSize(4000, 3000, null)).toEqual({ w: 4000, h: 3000 });
  });
});

describe('resolveOutputFilename', () => {
  it('AC-004: appends -compressed and the new extension', () => {
    expect(resolveOutputFilename('photo.JPG', 'image/png')).toBe('photo-compressed.png');
  });

  it('AC-004: maps jpeg output to the .jpg extension', () => {
    expect(resolveOutputFilename('photo.png', 'image/jpeg')).toBe('photo-compressed.jpg');
  });

  it('AC-004: handles names without an extension', () => {
    expect(resolveOutputFilename('photo', 'image/webp')).toBe('photo-compressed.webp');
  });
});

describe('formatBytes', () => {
  it('AC-007: formats bytes without decimals', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(300)).toBe('300 B');
  });

  it('AC-007: formats KB and MB with one decimal (decimal units, same as Finder)', () => {
    expect(formatBytes(524_288)).toBe('524.3 KB');
    expect(formatBytes(50_600_000)).toBe('50.6 MB');
    expect(formatBytes(12_100_000)).toBe('12.1 MB');
  });
});

describe('formatSummary', () => {
  it('AC-007: shows before → after with a negative percentage', () => {
    expect(formatSummary(50_600_000, 12_100_000)).toBe('50.6 MB → 12.1 MB (-76%)');
  });

  it('AC-007: shows a positive percentage when the output is larger', () => {
    expect(formatSummary(1000, 2000)).toBe('1.0 KB → 2.0 KB (+100%)');
  });

  it('AC-007: never produces NaN for zero-byte input', () => {
    expect(formatSummary(0, 0)).toBe('0 B → 0 B (0%)');
  });
});

describe('resolveOutputMime', () => {
  it('AC-002: keeps the requested format when the browser can encode it', () => {
    expect(resolveOutputMime('webp', ['jpeg', 'webp'])).toBe('webp');
  });

  it('AC-002: falls back to JPEG when the requested format is unsupported', () => {
    expect(resolveOutputMime('webp', ['jpeg', 'png'])).toBe('jpeg');
  });

  it('AC-002: falls back to JPEG even with an empty supported list', () => {
    expect(resolveOutputMime('png', [])).toBe('jpeg');
  });
});
