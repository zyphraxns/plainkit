/**
 * 图片 → ASCII 字符画——纯逻辑层。
 *
 * 本目录下的文件禁止出现 document / window / navigator / localStorage
 * （DESIGN.md 红线 1）。图片解码与 canvas 由页面层完成后，把像素数据
 * 作为普通数组传入本模块。
 *
 * 对应验收标准：specs/features/ascii-art.md
 */

/** 字符集预设。ramp 一律**从暗到亮**排列：暗像素取首字符，亮像素取末字符。 */
export const CHARSETS = {
  classic: '@%#*+=-:. ',
  blocky: '█▓▒░ ',
  minimal: '#*. ',
} as const;

export type CharsetPreset = keyof typeof CHARSETS;

/** 池化后的一个网格单元：平均亮度（0–1）+ 平均 RGB（0–255，供彩色模式）。 */
export interface Cell {
  lum: number;
  r: number;
  g: number;
  b: number;
}

/** 彩色模式下的一个输出单元：字符 + 该格的平均颜色（hex）。 */
export interface AsciiCell {
  char: string;
  color: string;
}

/**
 * 计算网格行数：字符的实际高约为宽的 2 倍，行数取 `高/宽 × 列数 × 0.5`
 * （AC-017），下限 1 行。
 */
export function rowsFor(srcWidth: number, srcHeight: number, cols: number): number {
  if (srcWidth <= 0 || srcHeight <= 0 || cols <= 0) return 1;
  return Math.max(1, Math.round((srcHeight / srcWidth) * cols * 0.5));
}

/**
 * 把 RGBA 像素缓冲（每像素 4 字节）平均池化成 cols×rows 网格。
 *
 * 亮度用 Rec. 709 加权（0.2126R + 0.7152G + 0.0722B），归一化到 0–1。
 * 前置条件：页面层已把透明像素合成到白底（AC-011 由画布完成）。
 */
export function poolCells(
  rgba: Uint8ClampedArray,
  srcWidth: number,
  cols: number,
  rows: number,
): Cell[] {
  const srcHeight = rgba.length / 4 / srcWidth;
  const cells: Cell[] = [];

  for (let row = 0; row < rows; row += 1) {
    const y0 = Math.floor((row * srcHeight) / rows);
    const y1 = Math.max(y0 + 1, Math.floor(((row + 1) * srcHeight) / rows));
    for (let col = 0; col < cols; col += 1) {
      const x0 = Math.floor((col * srcWidth) / cols);
      const x1 = Math.max(x0 + 1, Math.floor(((col + 1) * srcWidth) / cols));

      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let count = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * srcWidth + x) * 4;
          sumR += rgba[i]!;
          sumG += rgba[i + 1]!;
          sumB += rgba[i + 2]!;
          count += 1;
        }
      }
      const r = sumR / count;
      const g = sumG / count;
      const b = sumB / count;
      // Rec. 709 权重的浮点和略小于 1（白像素得 0.9999999999999999），
      // 量化到 8 位精度（与源数据一致）保证纯白映射到整数 1。
      const lum = Math.round((0.2126 * r + 0.7152 * g + 0.0722 * b) / 2.55) / 100;
      cells.push({ lum, r, g, b });
    }
  }
  return cells;
}

/** 亮度 → ramp 字符：inverted 时先取 1-亮度（AC-005）。 */
function lumToChar(lum: number, charset: string, inverted: boolean): string {
  const adjusted = inverted ? 1 - lum : lum;
  const index = Math.min(
    charset.length - 1,
    Math.max(0, Math.round(adjusted * (charset.length - 1))),
  );
  return charset[index]!;
}

/**
 * 网格 → 单色 ASCII 文本行。
 *
 * 行尾空格裁掉（AC-007）：等宽对齐不受影响，粘贴进聊天软件不拖尾巴。
 */
export function cellsToText(
  cells: Cell[],
  cols: number,
  charset: string,
  inverted: boolean,
): string[] {
  const lines: string[] = [];
  for (let row = 0; row < cells.length / cols; row += 1) {
    let line = '';
    for (let col = 0; col < cols; col += 1) {
      line += lumToChar(cells[row * cols + col]!.lum, charset, inverted);
    }
    lines.push(line.replace(/ +$/, ''));
  }
  return lines;
}

/** 0–255 数值 → 两位 hex。 */
function toHex(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0');
}

/** 网格 → 彩色 ASCII 单元（每字符带该格平均颜色，AC-006）。 */
export function cellsToColorArt(cells: Cell[], charset: string, inverted: boolean): AsciiCell[] {
  return cells.map((cell) => ({
    char: lumToChar(cell.lum, charset, inverted),
    color: `#${toHex(cell.r)}${toHex(cell.g)}${toHex(cell.b)}`,
  }));
}

/**
 * 文本行 → 复制用纯文本：`\n` 连接，去首尾空行、保留内部空行（AC-007）。
 */
export function buildPlainText(lines: string[]): string {
  const start = lines.findIndex((line) => line !== '');
  const end = lines.findLastIndex((line) => line !== '');
  if (start === -1 || end === -1) return '';
  return lines.slice(start, end + 1).join('\n');
}

// ---------------------------------------------------------------------------
// PNG 导出（AC-008）
// ---------------------------------------------------------------------------

/** 画布内边距与页脚高度（页脚放 PlainKit 标识）。 */
const CANVAS_MARGIN = 32;
const CANVAS_FOOTER = 64;

/** 字符格高宽比：等宽字体 advance ≈ 0.6em、常规行距 1.2 → 2.0。 */
const CHAR_CELL_ASPECT = 2;

/** ASCII 结果的绘制输入：cols×rows 网格 + 每格字符与颜色。 */
export interface AsciiArt {
  cols: number;
  rows: number;
  cells: AsciiCell[];
}

/** 导出画布尺寸（纯函数，可测；绘制由 renderAsciiCanvas 完成）。 */
export interface AsciiCanvasLayout {
  width: number;
  height: number;
  margin: number;
}

/**
 * 计算导出画布尺寸：内容区四周留边，底部额外留页脚空间放站点标识。
 *
 * 格子是 2:1 的矩形（cellH = 2 × cellPx），与等宽文本在终端 / 聊天里的
 * 真实高宽比一致——canvas、预览、复制文本三者几何完全相同（AC-006 / 017）。
 */
export function computeAsciiCanvasLayout(
  cols: number,
  rows: number,
  cellPx: number,
): AsciiCanvasLayout {
  return {
    width: cols * cellPx + CANVAS_MARGIN * 2,
    height: rows * cellPx * CHAR_CELL_ASPECT + CANVAS_MARGIN * 2 + CANVAS_FOOTER,
    margin: CANVAS_MARGIN,
  };
}

/** renderAsciiCanvas 的选项。 */
export interface AsciiCanvasOptions {
  /** 单个字符格的边长（像素）；页面按 2 倍分辨率传值 */
  cellPx: number;
  /** true = 每字符用网格平均色；false = 统一用 ink 色 */
  colorMode: boolean;
}

/**
 * 在画布上绘制 ASCII 字符画，白底深字、右下角 PlainKit 标识。
 *
 * 颜色值与卡片主题（canvas-card 的 CARD_THEMES.light）保持同一套：
 * ink #16191A、muted #5A6360。调用方负责创建画布（尺寸来自
 * computeAsciiCanvasLayout）与下载。
 */
export function renderAsciiCanvas(
  ctx: CanvasRenderingContext2D,
  art: AsciiArt,
  options: AsciiCanvasOptions,
): void {
  const layout = computeAsciiCanvasLayout(art.cols, art.rows, options.cellPx);
  const MONO = (px: number) =>
    `${px}px ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`;

  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, layout.width, layout.height);
  // 字号按 advance 反推：0.6 × 字号 = 格宽，字符横向精确铺满格子；
  // 行距取 1.2 倍字号 = 2 格宽，与文本渲染的几何一致。
  const fontPx = options.cellPx / 0.6;
  ctx.font = MONO(fontPx);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let row = 0; row < art.rows; row += 1) {
    for (let col = 0; col < art.cols; col += 1) {
      const cell = art.cells[row * art.cols + col];
      if (!cell || cell.char === ' ') continue;
      ctx.fillStyle = options.colorMode ? cell.color : '#16191A';
      ctx.fillText(
        cell.char,
        layout.margin + (col + 0.5) * options.cellPx,
        layout.margin + (row + 0.5) * options.cellPx * CHAR_CELL_ASPECT,
      );
    }
  }

  // 站点标识：右下角（产品概述 §6.1 回流闭环；BR-002）。
  ctx.font = `500 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = '#5A6360';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('PlainKit', layout.width - layout.margin, layout.height - layout.margin + 10);

  ctx.restore();
}
