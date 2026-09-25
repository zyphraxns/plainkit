import { describe, expect, it } from 'vitest';

import { generateQr } from './encoder';
import {
  LABEL_UNITS,
  QUIET_ZONE,
  SITE_LABEL,
  matrixToSvg,
  qrCanvasLayout,
  renderQrCanvas,
} from './render';

const FG = '#123456';
const BG = '#FFFFFF';

function sampleMatrix() {
  const result = generateQr('https://zyphraxns.github.io/plainkit/');
  expect(result).not.toBeNull();
  return result!.matrix;
}

/** 记录调用的假画布上下文（node 环境没有真 canvas）。 */
function fakeContext() {
  const fills: Array<{ x: number; y: number; w: number; h: number; style: string }> = [];
  const texts: Array<{ text: string; style: string }> = [];
  let style = '';
  const ctx = {
    get fillStyle(): string {
      return style;
    },
    set fillStyle(value: string) {
      style = value;
    },
    textAlign: 'left',
    textBaseline: 'alphabetic',
    font: '',
    save: () => undefined,
    restore: () => undefined,
    fillRect: (x: number, y: number, w: number, h: number) => {
      fills.push({ x, y, w, h, style });
    },
    fillText: (text: string) => {
      texts.push({ text, style });
    },
    measureText: (text: string) => ({ width: text.length * 6 }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills, texts };
}

describe('matrixToSvg', () => {
  const matrix = sampleMatrix();
  const svg = matrixToSvg(matrix, { fg: FG, bg: BG });

  it('AC-015: is a self-contained SVG document with no outside references', () => {
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    const urls = svg.match(/https?:\/\/[^"']+/g) ?? [];
    expect(urls.every((url) => url.startsWith('http://www.w3.org/'))).toBe(true);
  });

  it('AC-028: leaves a 4-module quiet zone around the code', () => {
    const side = matrix.size + QUIET_ZONE * 2 + LABEL_UNITS;
    expect(svg).toContain(`viewBox="0 0 ${side} ${side}"`);
    // 第一个模块必须落在静区之内，不能贴边
    expect(svg).toContain(`M${QUIET_ZONE + LABEL_UNITS / 2} ${QUIET_ZONE}h1`);
  });

  it('AC-012: uses the chosen foreground on white', () => {
    expect(svg).toContain(`fill="${FG}"`);
    expect(svg).toContain(`fill="${BG}"`);
  });

  it('AC-017: carries the PlainKit mark below the code', () => {
    expect(svg).toContain(SITE_LABEL);
  });

  it('draws exactly one segment per dark module', () => {
    const dark = Array.from(matrix.modules).filter((value) => value === 1).length;
    const segments = svg.match(/M\d+ \d+h1v1h-1z/g) ?? [];
    expect(segments.length).toBe(dark);
  });
});

describe('qrCanvasLayout', () => {
  it('AC-014: keeps modules whole pixels so edges stay sharp', () => {
    for (const target of [512, 1024]) {
      const layout = qrCanvasLayout(sampleMatrix().size, target);
      expect(layout.modulePx).toBeGreaterThanOrEqual(1);
      expect(layout.sidePx % layout.modulePx).toBe(0);
      expect(layout.sidePx).toBeLessThanOrEqual(target);
    }
  });
});

describe('renderQrCanvas', () => {
  const matrix = sampleMatrix();
  const layout = qrCanvasLayout(matrix.size, 512);
  const { ctx, fills, texts } = fakeContext();
  renderQrCanvas(ctx, matrix, {
    fg: FG,
    bg: BG,
    modulePx: layout.modulePx,
    sidePx: layout.sidePx,
    offsetX: layout.offsetX,
    offsetY: layout.offsetY,
    labelBaselineY: layout.labelBaselineY,
  });

  it('fills the background first, then one rect per dark module', () => {
    const dark = Array.from(matrix.modules).filter((value) => value === 1).length;
    expect(fills.length).toBe(dark + 1);
    expect(fills[0]!.style).toBe(BG);
    expect(fills[0]!.w).toBe(layout.sidePx);
    expect(fills.slice(1).every((fill) => fill.style === FG)).toBe(true);
  });

  it('AC-028: offsets every module by the quiet zone', () => {
    const first = fills[1]!;
    expect(first.x).toBe(layout.offsetX);
    expect(first.y).toBe(QUIET_ZONE * layout.modulePx);
  });

  it('AC-017: draws the PlainKit mark', () => {
    expect(texts.map((entry) => entry.text)).toContain(SITE_LABEL);
  });
});
