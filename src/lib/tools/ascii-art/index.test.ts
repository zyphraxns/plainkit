import { describe, expect, it } from 'vitest';

import {
  CHARSETS,
  buildPlainText,
  cellsToColorArt,
  cellsToText,
  computeAsciiCanvasLayout,
  poolCells,
  rowsFor,
} from './index';
import type { Cell } from './index';

/** 构造一张纯色 RGBA 像素缓冲（每像素 4 字节）。 */
function solidRgba(count: number, r: number, g: number, b: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i += 1) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return data;
}

/** 左半黑、右半白的 srcWidth×srcHeight 图像。 */
function halfBlackHalfWhite(srcWidth: number, srcHeight: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(srcWidth * srcHeight * 4);
  for (let y = 0; y < srcHeight; y += 1) {
    for (let x = 0; x < srcWidth; x += 1) {
      const i = (y * srcWidth + x) * 4;
      const v = x < srcWidth / 2 ? 0 : 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return data;
}

describe('rowsFor', () => {
  it('AC-017: corrects for the character aspect ratio (≈2:1)', () => {
    // 正方形图：字符高约为宽的 2 倍，行数应是列数的一半左右。
    expect(rowsFor(100, 100, 100)).toBe(50);
  });

  it('AC-013: a 4:3 image at 100 columns yields about 38 rows (±1)', () => {
    const rows = rowsFor(400, 300, 100);
    expect(Math.abs(rows - 37.5)).toBeLessThanOrEqual(1);
  });

  it('never returns less than 1 row', () => {
    expect(rowsFor(100, 1, 200)).toBe(1);
  });
});

describe('poolCells', () => {
  it('AC-006: maps black to luminance 0 and white to luminance 1', () => {
    const black = poolCells(solidRgba(1, 0, 0, 0), 1, 1, 1);
    expect(black[0]?.lum).toBe(0);
    const white = poolCells(solidRgba(1, 255, 255, 255), 1, 1, 1);
    expect(white[0]?.lum).toBe(1);
  });

  it('AC-011: averages a block spanning black and white to mid grey', () => {
    // 2×1 图像池化成 1×1：左黑右白 → 亮度与 RGB 均为一半。
    const [cell] = poolCells(halfBlackHalfWhite(2, 1), 2, 1, 1);
    expect(cell?.lum).toBe(0.5);
    expect(cell?.r).toBeCloseTo(127.5, 5);
  });

  it('AC-011: pools a left-black right-white image into two distinct cells', () => {
    const cells = poolCells(halfBlackHalfWhite(4, 2), 4, 2, 1);
    expect(cells).toHaveLength(2);
    expect(cells[0]?.lum).toBe(0);
    expect(cells[1]?.lum).toBe(1);
  });

  it('keeps the average RGB of each cell for the color mode', () => {
    // 红色块 → r=255, g=b=0。
    const [red] = poolCells(solidRgba(4, 255, 0, 0), 2, 2, 1);
    expect(red?.r).toBe(255);
    expect(red?.g).toBe(0);
    expect(red?.b).toBe(0);
  });
});

describe('cellsToText', () => {
  const classic = CHARSETS.classic;

  it('AC-004: maps dark pixels to the first (darkest) character', () => {
    const cells: Cell[] = [
      { lum: 0, r: 0, g: 0, b: 0 },
      { lum: 0, r: 0, g: 0, b: 0 },
      { lum: 0, r: 0, g: 0, b: 0 },
    ];
    expect(cellsToText(cells, 3, classic, false)).toEqual(['@@@']);
  });

  it('AC-004: maps bright pixels to the last (lightest) character', () => {
    // 亮像素 → 空格；夹在暗像素之间验证不被行尾裁剪吃掉。
    const cells: Cell[] = [solidCell(0), solidCell(1), solidCell(0)];
    expect(cellsToText(cells, 3, classic, false)).toEqual(['@ @']);
  });

  it('AC-004: mid grey picks the middle of the ramp deterministically', () => {
    // classic ramp：@%#*+=-:. （index 0–9），0.5 × 9 = 4.5 → index 5 → '='。
    const cells: Cell[] = [solidCell(0.5)];
    expect(cellsToText(cells, 1, classic, false)).toEqual(['=']);
  });

  it('AC-005: inverting swaps dark and light mappings', () => {
    const dark: Cell[] = [solidCell(0), solidCell(0)];
    const bright: Cell[] = [solidCell(1), solidCell(1)];
    expect(cellsToText(dark, 2, classic, false)).toEqual(['@@']);
    expect(cellsToText(dark, 2, classic, true)).toEqual(['']);
    expect(cellsToText(bright, 2, classic, false)).toEqual(['']);
    expect(cellsToText(bright, 2, classic, true)).toEqual(['@@']);
  });

  it('AC-007: trims trailing spaces so lines copy cleanly', () => {
    // 左黑右白的一行：右侧空白被裁掉。
    const cells: Cell[] = [solidCell(0), solidCell(1), solidCell(1)];
    expect(cellsToText(cells, 3, classic, false)).toEqual(['@']);
  });

  it('AC-004: blocky and minimal presets produce visibly different output', () => {
    const cells: Cell[] = [solidCell(0.25), solidCell(0.75)];
    const a = cellsToText(cells, 2, CHARSETS.blocky, false).join('');
    const b = cellsToText(cells, 2, CHARSETS.minimal, false).join('');
    expect(a).not.toBe(b);
  });
});

describe('cellsToColorArt', () => {
  it('AC-006: carries the average cell color as hex alongside the char', () => {
    const cells: Cell[] = [solidCell(0, 255, 0, 0)];
    const [art] = cellsToColorArt(cells, CHARSETS.classic, false);
    expect(art?.char).toBe('@');
    expect(art?.color).toBe('#ff0000');
  });

  it('AC-006: a mid-grey cell maps to its hex without rounding drift', () => {
    const cells: Cell[] = [solidCell(0.5, 128, 128, 128)];
    const [art] = cellsToColorArt(cells, CHARSETS.classic, false);
    expect(art?.color).toBe('#808080');
  });
});

describe('buildPlainText', () => {
  it('AC-007: joins lines without a trailing newline', () => {
    expect(buildPlainText(['ab', 'cd'])).toBe('ab\ncd');
  });

  it('AC-007: drops leading and trailing blank lines, keeps inner ones', () => {
    expect(buildPlainText(['', 'ab', '', 'cd', ''])).toBe('ab\n\ncd');
  });
});

function solidCell(lum: number, r = 0, g = 0, b = 0): Cell {
  return { lum, r, g, b };
}

describe('computeAsciiCanvasLayout', () => {
  it('AC-008: canvas grows with the art, keeping fixed margins', () => {
    const small = computeAsciiCanvasLayout(40, 20, 12);
    const wide = computeAsciiCanvasLayout(80, 20, 12);
    const tall = computeAsciiCanvasLayout(40, 40, 12);
    expect(wide.width).toBeGreaterThan(small.width);
    expect(wide.height).toBe(small.height);
    expect(tall.height).toBeGreaterThan(small.height);
  });

  it('AC-008: reserves footer space for the PlainKit mark', () => {
    const layout = computeAsciiCanvasLayout(10, 10, 12);
    // 内容区之外必须还有余量（页脚标识），不能贴边。
    expect(layout.height).toBeGreaterThan(10 * 12 + layout.margin * 2);
  });

  it('AC-008: cell size scales the canvas proportionally', () => {
    const base = computeAsciiCanvasLayout(10, 10, 12);
    const twice = computeAsciiCanvasLayout(10, 10, 24);
    expect(twice.width).toBeGreaterThan(base.width);
    expect(twice.height).toBeGreaterThan(base.height);
  });
});
