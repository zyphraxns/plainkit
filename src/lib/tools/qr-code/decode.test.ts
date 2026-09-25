import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';

import { buildCodewords, buildMatrix, capacityBytes, chooseVersion, utf8Bytes } from './encoder';
import {
  buildEmailPayload,
  buildLinkPayload,
  buildPhonePayload,
  buildSmsPayload,
  buildTextPayload,
  buildVCardPayload,
  buildWifiPayload,
} from './index';

/**
 * 把矩阵渲染成 RGBA 像素，交给 jsQR 解码。
 *
 * 这是「真的扫得出来」的硬证据：jsQR 是一套完全独立的解码实现（自带
 * 定位、去掩码、纠错），与我们的编码路径没有任何共享代码。
 */
function renderToRgba(
  matrix: { size: number; modules: Uint8Array },
  quietZone = 4,
  scale = 4,
): { data: Uint8ClampedArray; width: number; height: number } {
  const dimension = (matrix.size + quietZone * 2) * scale;
  const data = new Uint8ClampedArray(dimension * dimension * 4).fill(255);
  for (let row = 0; row < matrix.size; row += 1) {
    for (let col = 0; col < matrix.size; col += 1) {
      if (matrix.modules[row * matrix.size + col] !== 1) continue;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const x = (quietZone + col) * scale + dx;
          const y = (quietZone + row) * scale + dy;
          const i = (y * dimension + x) * 4;
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width: dimension, height: dimension };
}

/** 用 jsQR 解一张自研矩阵，返回解出的文本。 */
function decode(text: string, mask?: number): string | null {
  const bytes = utf8Bytes(text);
  const version = chooseVersion(bytes.length);
  expect(version).not.toBeNull();
  const codewords = buildCodewords(bytes, version!);
  const matrix = buildMatrix(codewords, version!, mask);
  const image = renderToRgba(matrix);
  const result = jsQR(image.data, image.width, image.height);
  return result === null ? null : result.data;
}

describe('端到端：jsQR 解码自研生成的码', () => {
  const payloads: Array<[name: string, text: string]> = [
    ['链接', buildLinkPayload('example.com')!],
    ['文本', buildTextPayload('meet me at the library at 6')!],
    [
      'Wi-Fi（含特殊字符）',
      buildWifiPayload({ ssid: 'Cafe;1', password: 'a:b\\c,d"e', encryption: 'wpa' })!,
    ],
    [
      '名片',
      buildVCardPayload({
        name: 'Ada Lovelace',
        phone: '+49 30 123456',
        email: 'ada@example.com',
        org: 'Analytical Engines',
        url: 'https://example.com',
      })!,
    ],
    ['邮件', buildEmailPayload({ to: 'a@b.com', subject: 'Hi there', body: 'Yo' })!],
    ['电话', buildPhonePayload('+49 30 123456')!],
    ['短信', buildSmsPayload({ number: '+49 123', body: 'Hi there' })!],
  ];

  for (const [name, text] of payloads) {
    it(`scans back to the exact payload: ${name}`, () => {
      expect(decode(text)).toBe(text);
    });
  }

  it('AC-020: Chinese and emoji survive the round trip', () => {
    expect(decode('你好，世界')).toBe('你好，世界');
    expect(decode('plainkit 🎉 qr')).toBe('plainkit 🎉 qr');
  });

  it('all eight masks stay scannable', () => {
    const text = 'https://zyphraxns.github.io/plainkit/';
    for (let mask = 0; mask < 8; mask += 1) {
      expect(decode(text, mask)).toBe(text);
    }
  });

  it('holds up across small, medium and large versions', () => {
    for (const version of [1, 7, 15, 32, 40]) {
      const text = 'a'.repeat(Math.max(1, capacityBytes(version) - 4));
      expect(decode(text)).toBe(text);
    }
  });
});
