import { describe, expect, it } from 'vitest';

import {
  WHEEL_MAX_NAMES,
  WHEEL_TURNS,
  advanceRotation,
  formatPickText,
  labelTransform,
  pickWinnerIndex,
  removeAt,
  sectorAngles,
  sectorLabel,
  sectorPoint,
  sectorPath,
  spinRotation,
} from './wheel';

/** 假测量器：每个字符宽 0.6 × 字号（与 canvas-card 测试的约定一致）。 */
const fakeMeasure = (text: string, px: number) => text.length * px * 0.6;

/** 确定性线性同余随机源，供均匀性统计使用。 */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

describe('sectorAngles', () => {
  it('splits a full turn into equal sectors', () => {
    const sectors = sectorAngles(8);
    expect(sectors).toHaveLength(8);
    expect(sectors.map((s) => s.start)).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
    expect(sectors.map((s) => s.end)).toEqual([45, 90, 135, 180, 225, 270, 315, 360]);
    expect(sectors.map((s) => s.center)).toEqual([
      22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5,
    ]);
  });

  it('handles two names as two halves', () => {
    expect(sectorAngles(2).map((s) => s.center)).toEqual([90, 270]);
  });

  it('BR-016: exposes the documented maximum', () => {
    expect(WHEEL_MAX_NAMES).toBe(50);
  });
});

describe('pickWinnerIndex', () => {
  it('maps a random value to a sector index deterministically', () => {
    expect(pickWinnerIndex(4, () => 0)).toBe(0);
    expect(pickWinnerIndex(4, () => 0.5)).toBe(2);
    expect(pickWinnerIndex(4, () => 0.999)).toBe(3);
  });

  it('never returns an out-of-range index, even when random() returns 1', () => {
    expect(pickWinnerIndex(4, () => 1)).toBe(3);
  });

  it('AC-044: is uniform across 800 draws (within 4 sigma)', () => {
    const random = lcg(20260929);
    const counts = new Array<number>(8).fill(0);
    for (let i = 0; i < 800; i += 1) {
      const index = pickWinnerIndex(8, random);
      const current = counts[index] ?? 0;
      counts[index] = current + 1;
    }
    // 期望 100，σ = √(800 × 1/8 × 7/8) ≈ 9.35 → 4σ ≈ 37.4
    for (const count of counts) {
      expect(Math.abs(count - 100)).toBeLessThanOrEqual(38);
    }
  });
});

describe('spinRotation', () => {
  it('AC-044: always lands the pointer inside the winning sector (exhaustive)', () => {
    for (const count of [2, 3, 5, 8, 23, 50]) {
      const step = 360 / count;
      for (let index = 0; index < count; index += 1) {
        for (const factor of [-0.4, 0, 0.4]) {
          const rotation = spinRotation(index, count, WHEEL_TURNS, factor * (step / 2));
          // 指针固定在 0°；盘顺时针转 rotation 后，落在指针下的盘内角度是
          // (-rotation) mod 360 —— 它必须落在第 index 个扇区内。
          const local = ((-rotation % 360) + 360) % 360;
          expect(Math.floor(local / step)).toBe(index);
          const center = (index + 0.5) * step;
          expect(Math.abs(local - center)).toBeLessThan(step / 2);
        }
      }
    }
  });

  it('turns forward by the requested number of turns', () => {
    expect(spinRotation(0, 4, WHEEL_TURNS, 0)).toBeGreaterThanOrEqual(360 * WHEEL_TURNS);
  });
});

describe('advanceRotation', () => {
  it('keeps turning forward and preserves the target angle', () => {
    let rotation = 0;
    for (const index of [3, 0, 3, 1]) {
      const next = advanceRotation(rotation, index, 4, WHEEL_TURNS, 0);
      expect(next).toBeGreaterThan(rotation);
      expect(next % 360).toBeCloseTo(spinRotation(index, 4, WHEEL_TURNS, 0) % 360, 6);
      rotation = next;
    }
  });

  it('adds at least one full turn each spin', () => {
    const first = advanceRotation(0, 0, 8, WHEEL_TURNS, 0);
    const second = advanceRotation(first, 0, 8, WHEEL_TURNS, 0);
    expect(second - first).toBeGreaterThanOrEqual(360 * WHEEL_TURNS);
  });
});

describe('removeAt', () => {
  it('removes one entry without touching the original array', () => {
    const names = ['a', 'b', 'c'];
    expect(removeAt(names, 1)).toEqual(['a', 'c']);
    expect(names).toEqual(['a', 'b', 'c']);
  });

  it('ignores an out-of-range index', () => {
    expect(removeAt(['a', 'b'], 9)).toEqual(['a', 'b']);
  });
});

describe('sectorLabel', () => {
  it('AC-052: keeps a short name whole at a wide sector', () => {
    expect(sectorLabel('Alice', 45, fakeMeasure)).toEqual({
      text: 'Alice',
      fontSize: 12,
      visible: true,
    });
  });

  it('AC-052: truncates a long name with an ellipsis', () => {
    const long = 'x'.repeat(40);
    const label = sectorLabel(long, 45, fakeMeasure);
    expect(label.visible).toBe(true);
    expect(label.text.endsWith('…')).toBe(true);
    expect(label.text.length).toBeLessThan(long.length);
  });

  it('AC-052: drops to the small size at 50 names (7.2 degrees per sector)', () => {
    const label = sectorLabel('Alice', 360 / 50, fakeMeasure);
    expect(label.visible).toBe(true);
    expect(label.fontSize).toBe(9);
  });

  it('AC-052: hides the label when the sector is too narrow to read', () => {
    expect(sectorLabel('Alice', 3, fakeMeasure).visible).toBe(false);
  });

  it('never splits a surrogate pair while truncating', () => {
    const label = sectorLabel('😀'.repeat(30), 45, fakeMeasure);
    expect(label.text.endsWith('…')).toBe(true);
    // 截断后不应留下半个字符（U+FFFD）
    expect(label.text.includes('\uFFFD')).toBe(false);
  });
});

describe('geometry helpers', () => {
  it('puts 0 degrees at twelve o’clock and runs clockwise', () => {
    const top = sectorPoint(100, 0);
    expect(top.x).toBeCloseTo(160, 6);
    expect(top.y).toBeCloseTo(60, 6);
    const right = sectorPoint(100, 90);
    expect(right.x).toBeCloseTo(260, 6);
    expect(right.y).toBeCloseTo(160, 6);
  });

  it('builds a closed path with two arcs', () => {
    const path = sectorPath(sectorAngles(8)[0]!);
    expect(path.startsWith('M ')).toBe(true);
    expect(path.endsWith(' Z')).toBe(true);
    expect(path.match(/A /g)).toHaveLength(2);
  });

  it('draws a full ring when only one name is left (zero-width arc rule)', () => {
    // SVG 规范：起点与终点重合的弧不绘制，所以满圆必须拆成两段 180° 弧 × 内外两圈
    const path = sectorPath(sectorAngles(1)[0]!);
    expect(path.match(/A /g)).toHaveLength(4);
    expect(path).toContain('1 1'); // 外圈顺时针
    expect(path).toContain('1 0'); // 内圈反向，挖出中心孔
  });

  it('anchors the label at the outer edge, rotated along the radius', () => {
    const transform = labelTransform(90, 140);
    expect(transform).toContain('translate(300 160)');
    expect(transform).toContain('rotate(0)');
  });
});

describe('formatPickText', () => {
  it('AC-049: puts the winner on its own line under the header', () => {
    expect(formatPickText('Alice', 'Picked from 23 names · PlainKit')).toBe(
      'Picked from 23 names · PlainKit\n\nAlice',
    );
  });
});
