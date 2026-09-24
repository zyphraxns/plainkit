/**
 * 二维码编码核心——纯逻辑层。
 *
 * 只实现「字节模式 + 纠错等级 M」，版本自动取能装下内容的最小版本
 * （BR-004：纠错等级不给用户选项，所以这里也只有 M 一条路径）。
 *
 * 本目录下的文件禁止出现 document / window / navigator / localStorage
 * （DESIGN.md 红线 1）。超容量时返回 null，由页面层提示，绝不静默截断
 * （AC-019）。
 *
 * 两张 ISO/IEC 18004 的常量表（RS 分块、校正图形位置）在测试里由
 * qrcode-generator 的成熟实现与 jsqr 的独立解码双向兜住——表里任何
 * 一行错，测试就会红，不靠记忆校对。
 *
 * 对应验收标准：specs/features/qr-code.md AC-019 / AC-029
 */

// ---------------------------------------------------------------------------
// 常量表
// ---------------------------------------------------------------------------

/** 纠错等级 M 在格式信息里的 2 位编码（L=01 M=00 Q=11 H=10）。 */
const ECL_BITS_M = 0b00;

/**
 * RS 分块表（仅 M 级，下标 = 版本 - 1）。
 * 每行是若干 [块数, 每块总码字数, 每块数据码字数] 三元组；
 * 每块的纠错码字数 = 总码字数 − 数据码字数。
 */
const RS_BLOCKS_M: readonly (readonly number[])[] = [
  [1, 26, 16],
  [1, 44, 28],
  [1, 70, 44],
  [2, 50, 32],
  [2, 67, 43],
  [4, 43, 27],
  [4, 49, 31],
  [2, 60, 38, 2, 61, 39],
  [3, 58, 36, 2, 59, 37],
  [4, 69, 43, 1, 70, 44],
  [1, 80, 50, 4, 81, 51],
  [6, 58, 36, 2, 59, 37],
  [8, 59, 37, 1, 60, 38],
  [4, 64, 40, 5, 65, 41],
  [5, 65, 41, 5, 66, 42],
  [7, 73, 45, 3, 74, 46],
  [10, 74, 46, 1, 75, 47],
  [9, 69, 43, 4, 70, 44],
  [3, 70, 44, 11, 71, 45],
  [3, 67, 41, 13, 68, 42],
  [17, 68, 42],
  [17, 74, 46],
  [4, 75, 47, 14, 76, 48],
  [6, 73, 45, 14, 74, 46],
  [8, 75, 47, 13, 76, 48],
  [19, 74, 46, 4, 75, 47],
  [22, 73, 45, 3, 74, 46],
  [3, 73, 45, 23, 74, 46],
  [21, 73, 45, 7, 74, 46],
  [19, 75, 47, 10, 76, 48],
  [2, 74, 46, 29, 75, 47],
  [10, 74, 46, 23, 75, 47],
  [14, 74, 46, 21, 75, 47],
  [14, 74, 46, 23, 75, 47],
  [12, 75, 47, 26, 76, 48],
  [6, 75, 47, 34, 76, 48],
  [29, 74, 46, 14, 75, 47],
  [13, 74, 46, 32, 75, 47],
  [40, 75, 47, 7, 76, 48],
  [18, 75, 47, 31, 76, 48],
];

/** 校正图形的中心坐标（下标 = 版本 - 1）。 */
const ALIGNMENT_POSITIONS: readonly (readonly number[])[] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
];

/** 八种掩码函数：返回 true 表示该模块要翻转。 */
const MASK_FUNCTIONS: readonly ((row: number, col: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

// ---------------------------------------------------------------------------
// GF(256) 与 Reed-Solomon
// ---------------------------------------------------------------------------

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

{
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // 本原多项式 x^8 + x^4 + x^3 + x^2 + 1
  }
  for (let i = 255; i < 512; i += 1) GF_EXP[i] = GF_EXP[i - 255]!;
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a]! + GF_LOG[b]!]!;
}

/** 生成多项式 (x + a^0)(x + a^1)…(x + a^(n-1))，系数从高次到低次。 */
function generatorPolynomial(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] = (next[j] ?? 0) ^ poly[j]!;
      next[j + 1] = (next[j + 1] ?? 0) ^ gfMul(poly[j]!, GF_EXP[i]!);
    }
    poly = next;
  }
  return poly;
}

/** 系统码形式的 Reed-Solomon 编码：返回 n 个纠错码字。 */
export function rsEncode(data: Uint8Array, ecCount: number): Uint8Array {
  const generator = generatorPolynomial(ecCount);
  const remainder = new Uint8Array(ecCount);
  for (const byte of data) {
    const factor = byte ^ remainder[0]!;
    remainder.copyWithin(0, 1);
    remainder[ecCount - 1] = 0;
    if (factor !== 0) {
      for (let i = 0; i < ecCount; i += 1) {
        remainder[i] = (remainder[i] ?? 0) ^ gfMul(generator[i + 1]!, factor);
      }
    }
  }
  return remainder;
}

// ---------------------------------------------------------------------------
// 容量与版本
// ---------------------------------------------------------------------------

export interface QrBlock {
  /** 该块承载的数据码字数 */
  dataCount: number;
  /** 该块承载的纠错码字数 */
  ecCount: number;
}

/** 该版本下所有 RS 块（已按块展开）。 */
export function blocksForVersion(version: number): QrBlock[] {
  const spec = RS_BLOCKS_M[version - 1] ?? [];
  const blocks: QrBlock[] = [];
  for (let i = 0; i < spec.length; i += 3) {
    const count = spec[i]!;
    const total = spec[i + 1]!;
    const data = spec[i + 2]!;
    for (let b = 0; b < count; b += 1) {
      blocks.push({ dataCount: data, ecCount: total - data });
    }
  }
  return blocks;
}

/** 该版本的总码字数（数据 + 纠错）。 */
export function totalCodewords(version: number): number {
  return blocksForVersion(version).reduce((sum, block) => sum + block.dataCount + block.ecCount, 0);
}

function dataCodewordCount(version: number): number {
  return blocksForVersion(version).reduce((sum, block) => sum + block.dataCount, 0);
}

/**
 * 字节模式下该版本能装下的最大字节数。
 * 头部开销 = 4 位模式指示符 + 字符计数（v1–9 用 8 位，v10 起用 16 位）。
 */
export function capacityBytes(version: number): number {
  const headerBits = 4 + (version < 10 ? 8 : 16);
  return Math.floor((dataCodewordCount(version) * 8 - headerBits) / 8);
}

/** 能装下给定字节数的最小版本；装不下返回 null。 */
export function chooseVersion(byteLength: number): number | null {
  for (let version = 1; version <= 40; version += 1) {
    if (byteLength <= capacityBytes(version)) return version;
  }
  return null;
}

/** UTF-8 编码。TextEncoder 在 Node 与浏览器都是全局，测试可直接跑。 */
export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

// ---------------------------------------------------------------------------
// 码字流
// ---------------------------------------------------------------------------

/**
 * 把字节流转成数据码字（位流 + 终止符 + 补齐），**未经 RS 与交织**。
 * 长度恒等于该版本的数据码字数。拆出来是为了让补齐规则可单独测试。
 */
export function buildDataCodewords(bytes: Uint8Array, version: number): Uint8Array {
  const dataCapacityBits = dataCodewordCount(version) * 8;

  const bits: number[] = [];
  const pushBits = (value: number, length: number): void => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };

  pushBits(0b0100, 4); // 字节模式指示符
  pushBits(bytes.length, version < 10 ? 8 : 16); // 字符计数
  for (const byte of bytes) pushBits(byte, 8);

  // 终止符最多 4 位，装不下就不补。
  const terminatorBits = Math.min(4, dataCapacityBits - bits.length);
  for (let i = 0; i < terminatorBits; i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) value = (value << 1) | bits[i + j]!;
    data.push(value);
  }

  // 数据码字不够时用 0xEC / 0x11 交替补齐。
  for (let i = 0; data.length < dataCodewordCount(version); i += 1) {
    data.push(i % 2 === 0 ? 0xec : 0x11);
  }
  return Uint8Array.from(data);
}

/**
 * 把字节流转成完整的码字流（数据码字 → 分块 → RS → 交织）。
 * 长度恒等于 totalCodewords(version)。
 */
export function buildCodewords(bytes: Uint8Array, version: number): Uint8Array {
  const data = Array.from(buildDataCodewords(bytes, version));

  // 分块 → 每块单独算纠错码字。
  const blocks = blocksForVersion(version);
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (const block of blocks) {
    const chunk = Uint8Array.from(data.slice(offset, offset + block.dataCount));
    offset += block.dataCount;
    dataBlocks.push(chunk);
    ecBlocks.push(rsEncode(chunk, block.ecCount));
  }

  // 交织：先按「块内下标」依次取所有块的数据码字，再同样取纠错码字。
  const out: number[] = [];
  const maxData = Math.max(...blocks.map((block) => block.dataCount));
  for (let i = 0; i < maxData; i += 1) {
    for (let b = 0; b < dataBlocks.length; b += 1) {
      const chunk = dataBlocks[b]!;
      if (i < chunk.length) out.push(chunk[i]!);
    }
  }
  const maxEc = blocks[0]?.ecCount ?? 0;
  for (let i = 0; i < maxEc; i += 1) {
    for (let b = 0; b < ecBlocks.length; b += 1) out.push(ecBlocks[b]![i]!);
  }
  return Uint8Array.from(out);
}

// ---------------------------------------------------------------------------
// 矩阵
// ---------------------------------------------------------------------------

export interface QrMatrix {
  version: number;
  /** 单边模块数（含静区之外的本体） */
  size: number;
  /** 逐行的模块，1 = 深色 */
  modules: Uint8Array;
  mask: number;
}

/** 二进制 BCH 的位数（最高位位置）。 */
function bchDigit(value: number): number {
  let digit = 0;
  let rest = value;
  while (rest !== 0) {
    digit += 1;
    rest >>>= 1;
  }
  return digit;
}

/** 格式信息的 BCH(15,5) 编码，最后与 0x5412 异或。 */
function formatBits(mask: number): number {
  const data = (ECL_BITS_M << 3) | mask;
  let remainder = data << 10;
  const g15 = 0b10100110111;
  while (bchDigit(remainder) - bchDigit(g15) >= 0) {
    remainder ^= g15 << (bchDigit(remainder) - bchDigit(g15));
  }
  return ((data << 10) | remainder) ^ 0b101010000010010;
}

/** 版本信息的 BCH(18,6) 编码（v ≥ 7 才有）。 */
function versionBits(version: number): number {
  let remainder = version << 12;
  const g18 = 0b1111100100101;
  while (bchDigit(remainder) - bchDigit(g18) >= 0) {
    remainder ^= g18 << (bchDigit(remainder) - bchDigit(g18));
  }
  return (version << 12) | remainder;
}

/** 按 ISO 四条惩罚规则给矩阵打分，越低越好。 */
function penaltyScore(matrix: QrMatrix): number {
  const size = matrix.size;
  const at = (row: number, col: number): number => matrix.modules[row * size + col]!;
  let score = 0;

  // 规则一：同色连续 5 个以上，3 + (长度 − 5)
  for (let axis = 0; axis < 2; axis += 1) {
    for (let i = 0; i < size; i += 1) {
      let run = 1;
      for (let j = 1; j < size; j += 1) {
        const current = axis === 0 ? at(i, j) : at(j, i);
        const previous = axis === 0 ? at(i, j - 1) : at(j - 1, i);
        if (current === previous) {
          run += 1;
        } else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
  }

  // 规则二：2×2 同色块，每个 +3
  for (let row = 0; row < size - 1; row += 1) {
    for (let col = 0; col < size - 1; col += 1) {
      const value = at(row, col);
      if (
        value === at(row, col + 1) &&
        value === at(row + 1, col) &&
        value === at(row + 1, col + 1)
      ) {
        score += 3;
      }
    }
  }

  // 规则三：出现 1:1:3:1 比例的疑似定位图形，每个 +40
  const forward = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const backward = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  for (let axis = 0; axis < 2; axis += 1) {
    for (let i = 0; i < size; i += 1) {
      for (let j = 0; j + 11 <= size; j += 1) {
        let hitForward = true;
        let hitBackward = true;
        for (let k = 0; k < 11; k += 1) {
          const value = axis === 0 ? at(i, j + k) : at(j + k, i);
          if (value !== forward[k]) hitForward = false;
          if (value !== backward[k]) hitBackward = false;
        }
        if (hitForward) score += 40;
        if (hitBackward) score += 40;
      }
    }
  }

  // 规则四：黑白比例偏离 50%，每 5% +10
  let dark = 0;
  for (let i = 0; i < matrix.modules.length; i += 1) dark += matrix.modules[i]!;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;
  return score;
}

/** 用指定掩码铺一张矩阵（不做掩码优选）。 */
function buildMatrixWithMask(codewords: Uint8Array, version: number, mask: number): QrMatrix {
  const size = version * 4 + 17;
  const modules = new Uint8Array(size * size);
  const reserved = new Uint8Array(size * size);

  const inBounds = (row: number, col: number): boolean =>
    row >= 0 && row < size && col >= 0 && col < size;
  const set = (row: number, col: number, dark: boolean): void => {
    if (inBounds(row, col)) modules[row * size + col] = dark ? 1 : 0;
  };
  const reserve = (row: number, col: number): void => {
    if (inBounds(row, col)) reserved[row * size + col] = 1;
  };

  // 定位图形（含分隔符）：三个角
  const corners: readonly [number, number][] = [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];
  for (const [baseRow, baseCol] of corners) {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const row = baseRow + r;
        const col = baseCol + c;
        if (!inBounds(row, col)) continue;
        reserve(row, col);
        const ring =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(row, col, ring || core);
      }
    }
  }

  // 时序图形：第 6 行与第 6 列
  for (let i = 8; i < size - 8; i += 1) {
    const dark = i % 2 === 0;
    set(6, i, dark);
    reserve(6, i);
    set(i, 6, dark);
    reserve(i, 6);
  }

  // 校正图形：跳过被定位图形占掉的三个角
  const positions = ALIGNMENT_POSITIONS[version - 1] ?? [];
  const first = positions[0];
  const last = positions[positions.length - 1];
  for (const centerRow of positions) {
    for (const centerCol of positions) {
      if (first !== undefined && last !== undefined) {
        const topLeft = centerRow === first && centerCol === first;
        const topRight = centerRow === first && centerCol === last;
        const bottomLeft = centerRow === last && centerCol === first;
        if (topLeft || topRight || bottomLeft) continue;
      }
      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          const row = centerRow + r;
          const col = centerCol + c;
          if (!inBounds(row, col)) continue;
          reserve(row, col);
          set(row, col, Math.max(Math.abs(r), Math.abs(c)) !== 1);
        }
      }
    }
  }

  // 预留格式信息区域（稍后填）
  for (let i = 0; i <= 8; i += 1) {
    reserve(i, 8);
    reserve(8, i);
  }
  for (let i = 0; i < 8; i += 1) {
    reserve(size - 1 - i, 8);
    reserve(8, size - 1 - i);
  }

  // 版本信息（v ≥ 7）：右下与左上的两个 3×6 区域
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i += 1) {
      const dark = ((bits >>> i) & 1) === 1;
      const row = Math.floor(i / 3);
      const col = (i % 3) + size - 11;
      set(row, col, dark);
      reserve(row, col);
      set(col, row, dark);
      reserve(col, row);
    }
  }

  // 固定深色模块
  set(size - 8, 8, true);
  reserve(size - 8, 8);

  // 数据填充：从右下角起，两列一组蛇形向上/向下，跳过第 6 列（时序）
  const maskFn = MASK_FUNCTIONS[mask]!;
  let bitIndex = 7;
  let byteIndex = 0;
  let direction = -1;
  let row = size - 1;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (;;) {
      for (let c = 0; c < 2; c += 1) {
        const target = col - c;
        if (reserved[row * size + target] === 0) {
          let dark = false;
          if (byteIndex < codewords.length) {
            dark = ((codewords[byteIndex]! >>> bitIndex) & 1) === 1;
          }
          if (maskFn(row, target)) dark = !dark;
          set(row, target, dark);
          bitIndex -= 1;
          if (bitIndex === -1) {
            byteIndex += 1;
            bitIndex = 7;
          }
        }
      }
      row += direction;
      if (row < 0 || row >= size) {
        row -= direction;
        direction = -direction;
        break;
      }
    }
  }

  // 格式信息：15 位，绕过时序图形各写两份
  const info = formatBits(mask);
  for (let i = 0; i < 15; i += 1) {
    const dark = ((info >>> i) & 1) === 1;
    if (i < 6) set(i, 8, dark);
    else if (i < 8) set(i + 1, 8, dark);
    else set(size - 15 + i, 8, dark);

    if (i < 8) set(8, size - i - 1, dark);
    else if (i < 9) set(8, 15 - i, dark);
    else set(8, 15 - i - 1, dark);
  }

  return { version, size, modules, mask };
}

/**
 * 铺一张完整矩阵。不传掩码时按 ISO 惩罚规则自动挑最优掩码
 * （掩码编号会写进格式信息，八个掩码都能被正常扫出，所以这一步只影响
 * 可读性优劣，不影响正确性）。
 */
export function buildMatrix(codewords: Uint8Array, version: number, mask?: number): QrMatrix {
  if (mask !== undefined) return buildMatrixWithMask(codewords, version, mask);
  let best = buildMatrixWithMask(codewords, version, 0);
  let bestScore = penaltyScore(best);
  for (let m = 1; m < 8; m += 1) {
    const candidate = buildMatrixWithMask(codewords, version, m);
    const score = penaltyScore(candidate);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

export interface QrSpec {
  version: number;
  /** 单边模块数 */
  moduleCount: number;
  ecl: 'M';
}

/** 供页面显示的码规格（AC-013）。 */
export function describeMatrix(matrix: QrMatrix): QrSpec {
  return { version: matrix.version, moduleCount: matrix.size, ecl: 'M' };
}

export interface QrResult {
  version: number;
  matrix: QrMatrix;
}

/** 一步到位：文本 → 矩阵。装不下返回 null（AC-019 不截断）。 */
export function generateQr(text: string): QrResult | null {
  const bytes = utf8Bytes(text);
  const version = chooseVersion(bytes.length);
  if (version === null) return null;
  const codewords = buildCodewords(bytes, version);
  return { version, matrix: buildMatrix(codewords, version) };
}
