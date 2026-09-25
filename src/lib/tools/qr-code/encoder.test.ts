import { describe, expect, it } from 'vitest';

import {
  blocksForVersion,
  buildCodewords,
  buildDataCodewords,
  buildMatrix,
  capacityBytes,
  chooseVersion,
  describeMatrix,
  generateQr,
  rsEncode,
  totalCodewords,
  utf8Bytes,
} from './encoder';

// T2-b 的黄金标准：kazuhikoarase 的经典实现（MIT），只在测试里用。
import qrcodeReference from 'qrcode-generator';

// 这个包默认按 Shift-JIS 取字节（"你好" 会变成 [96,125]），会把中文/emoji 变成
// 另一串字节。我们走 UTF-8，所以换成自己的 UTF-8 取字节函数——否则两边编码的
// 根本不是同一个输入，比对也就没有意义。
qrcodeReference.stringToBytes = (s: string) => Array.from(new TextEncoder().encode(s));

interface ReferenceCode {
  addData(data: string, mode: 'Byte'): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, col: number): boolean;
}
const reference = qrcodeReference as unknown as (typeNumber: number, ecl: 'M') => ReferenceCode;

/** 读参考库在给定版本下生成的矩阵（它内部自选掩码）。 */
function referenceMatrix(text: string, version: number): boolean[][] {
  const q = reference(version, 'M');
  q.addData(text, 'Byte');
  q.make();
  const size = q.getModuleCount();
  const rows: boolean[][] = [];
  for (let r = 0; r < size; r += 1) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c += 1) row.push(q.isDark(r, c));
    rows.push(row);
  }
  return rows;
}

/** 自研矩阵在强制掩码 m 下与参考矩阵逐模块比对。 */
function matchesReference(mine: { size: number; modules: Uint8Array }, ref: boolean[][]): boolean {
  if (mine.size !== ref.length) return false;
  for (let r = 0; r < mine.size; r += 1) {
    for (let c = 0; c < mine.size; c += 1) {
      if ((mine.modules[r * mine.size + c] === 1) !== ref[r]![c]) return false;
    }
  }
  return true;
}

describe('chooseVersion / capacityBytes', () => {
  it('AC-019: v40·M 字节模式的上限是 2331 字节', () => {
    expect(capacityBytes(40)).toBe(2331);
  });

  it('AC-019: 刚好装下用尽最高版本，多一个字节就拒绝', () => {
    expect(chooseVersion(utf8Bytes('a'.repeat(2331)).length)).toBe(40);
    expect(chooseVersion(utf8Bytes('a'.repeat(2332)).length)).toBeNull();
  });

  it('AC-029: 短内容落在小版本', () => {
    expect(chooseVersion(utf8Bytes('https://zyphraxns.github.io/plainkit/').length)).toBeLessThan(
      6,
    );
  });
});

describe('buildCodewords', () => {
  it('produces exactly the codeword count the version can hold', () => {
    for (const version of [1, 5, 10, 25, 40]) {
      const bytes = utf8Bytes('a'.repeat(Math.min(capacityBytes(version), 100)));
      expect(buildCodewords(bytes, version).length).toBe(totalCodewords(version));
    }
  });

  it('starts with the byte-mode indicator 0100', () => {
    const codewords = buildCodewords(utf8Bytes('hi'), 3);
    expect(codewords[0]! >>> 4).toBe(0b0100);
  });

  it('pads the data section with the alternating 0xEC / 0x11 sequence', () => {
    // 补齐只发生在数据码字段；交织后尾部是纠错码字，所以要看 buildDataCodewords。
    const data = buildDataCodewords(utf8Bytes('hi'), 3);
    // 4 位模式 + 8 位计数 + 16 位数据 + 4 位终止符 = 32 位 → 前 4 个码字是真实数据
    const padStart = 4;
    for (let i = padStart; i < data.length; i += 1) {
      expect(data[i]).toBe((i - padStart) % 2 === 0 ? 0xec : 0x11);
    }
  });
});

describe('rsEncode', () => {
  it('emits codewords whose syndromes are all zero (valid RS codeword)', () => {
    // GF(256) 上的校验：把 (数据 || 纠错) 当成多项式，在 a^1..a^n 处取值应全为 0。
    const exp = new Uint8Array(512);
    const log = new Uint8Array(256);
    let x = 1;
    for (let i = 0; i < 255; i += 1) {
      exp[i] = x;
      log[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i += 1) exp[i] = exp[i - 255]!;
    const mul = (a: number, b: number): number =>
      a === 0 || b === 0 ? 0 : exp[log[a]! + log[b]!]!;

    for (const version of [1, 6, 14, 32]) {
      const block = blocksForVersion(version)[0]!;
      const data = new Uint8Array(block.dataCount).map((_, i) => (i * 37 + 11) & 0xff);
      const ec = rsEncode(data, block.ecCount);
      expect(ec.length).toBe(block.ecCount);
      const full = Uint8Array.from([...data, ...ec]);
      // 生成多项式的根是 a^0 … a^(n-1)，所以校验点从 j = 0 开始。
      for (let j = 0; j < block.ecCount; j += 1) {
        let syndrome = 0;
        for (let i = 0; i < full.length; i += 1) {
          syndrome ^= mul(full[full.length - 1 - i]!, exp[(j * i) % 255]!);
        }
        expect(syndrome).toBe(0);
      }
    }
  });
});

describe('buildMatrix — 与成熟实现逐模块比对', () => {
  const payloads: Array<[name: string, text: string]> = [
    ['链接', 'https://zyphraxns.github.io/plainkit/'],
    ['英文', 'HELLO WORLD'],
    ['Wi-Fi', 'WIFI:T:WPA;S:Cafe\\;1;P:a\\:b\\\\c\\,d\\"e;;'],
    ['名片', 'BEGIN:VCARD\nVERSION:3.0\nFN:Ada\nTEL:+49301\nEND:VCARD'],
    ['中文', '你好，世界'],
    ['emoji', 'plainkit 🎉 qr'],
    ['短信', 'sms:+49123?body=Hi%20there'],
  ];

  for (const [name, text] of payloads) {
    it(`matches the reference implementation for: ${name}`, () => {
      const version = chooseVersion(utf8Bytes(text).length);
      expect(version).not.toBeNull();
      const codewords = buildCodewords(utf8Bytes(text), version!);
      const ref = referenceMatrix(text, version!);

      // 参考库自选掩码，我们无法指定它；因此强制自研矩阵跑遍 8 个掩码，
      // 要求至少有一个与参考完全一致——这证明编码、放置、掩码全部正确。
      const hit = [0, 1, 2, 3, 4, 5, 6, 7].some((mask) =>
        matchesReference(buildMatrix(codewords, version!, mask), ref),
      );
      expect(hit).toBe(true);
    });
  }

  it('matches the reference across small, medium and large versions', () => {
    for (const version of [1, 3, 10, 25, 40]) {
      const text = 'a'.repeat(Math.max(1, capacityBytes(version) - 3));
      const codewords = buildCodewords(utf8Bytes(text), version);
      const ref = referenceMatrix(text, version);
      const hit = [0, 1, 2, 3, 4, 5, 6, 7].some((mask) =>
        matchesReference(buildMatrix(codewords, version, mask), ref),
      );
      expect({ version, hit }).toEqual({ version, hit: true });
    }
  });
});

describe('generateQr', () => {
  it('AC-029: is deterministic — the same text always yields the same matrix', () => {
    const first = generateQr('https://zyphraxns.github.io/plainkit/');
    const second = generateQr('https://zyphraxns.github.io/plainkit/');
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(Array.from(second!.matrix.modules)).toEqual(Array.from(first!.matrix.modules));
  });

  it('AC-013: describes version, module count and error correction level', () => {
    const result = generateQr('https://zyphraxns.github.io/plainkit/');
    expect(result).not.toBeNull();
    const info = describeMatrix(result!.matrix);
    expect(info.ecl).toBe('M');
    expect(info.moduleCount).toBe(result!.matrix.size);
    expect(info.version).toBe(result!.version);
  });

  it('AC-019: returns null instead of silently truncating oversized content', () => {
    expect(generateQr('a'.repeat(2400))).toBeNull();
  });
});
