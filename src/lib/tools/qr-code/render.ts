/**
 * 二维码渲染——纯逻辑层。
 *
 * 两条输出路径共用同一套几何：预览与 SVG 导出都走 `matrixToSvg`（所见即所得），
 * 只有 PNG 导出用 canvas（`renderQrCanvas`）。两者的静区、前景色、站点标识
 * 位置必须完全一致（BR-002 / BR-003）。
 *
 * 本目录下的文件禁止出现 document / window / navigator / localStorage
 * （DESIGN.md 红线 1）：画布上下文由页面层创建后作为参数传入。
 *
 * 对应验收标准：AC-012 / AC-014 / AC-015 / AC-017 / AC-028
 */
import type { QrMatrix } from './encoder';

/** 静区宽度（模块数）。静区不足是扫码失败的第一大原因，不给配置。 */
export const QUIET_ZONE = 4;

/**
 * 二维码下方留给站点标识的高度（模块数）。取偶数，这样左右各分一半就能
 * 让码保持居中，画布也仍然是正方形。
 */
export const LABEL_UNITS = 4;

/** 可分享产物自带的站点标识（产品概述 §6.1 回流闭环）。 */
export const SITE_LABEL = 'plainkit.app';

/** 标识的颜色：比前景色浅一档，看得出但不抢戏。 */
const LABEL_COLOR = '#5A6360';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';

/** 正方形画布的边长（模块数）：本体 + 两侧静区 + 底部标识区。 */
export function qrSideUnits(moduleCount: number): number {
  return moduleCount + QUIET_ZONE * 2 + LABEL_UNITS;
}

/** 码本体左上角在画布里的偏移（模块数）。横向多出的一半是居中补偿。 */
export function qrOffsetUnits(): { x: number; y: number } {
  return { x: QUIET_ZONE + LABEL_UNITS / 2, y: QUIET_ZONE };
}

export interface QrCanvasLayout {
  /** 正方形画布的边长（像素） */
  sidePx: number;
  /** 单个模块的像素边长（取整，保证边缘锐利） */
  modulePx: number;
  offsetX: number;
  offsetY: number;
  /** 站点标识的基线 y（像素） */
  labelBaselineY: number;
}

/**
 * 按目标尺寸算出画布布局。模块边长取整数像素——非整数会让模块边缘发灰，
 * 打印出来尤其明显（AC-014 要求锐利无模糊）。
 */
export function qrCanvasLayout(moduleCount: number, targetPx: number): QrCanvasLayout {
  const sideUnits = qrSideUnits(moduleCount);
  const modulePx = Math.max(1, Math.floor(targetPx / sideUnits));
  const offset = qrOffsetUnits();
  return {
    sidePx: modulePx * sideUnits,
    modulePx,
    offsetX: offset.x * modulePx,
    offsetY: offset.y * modulePx,
    labelBaselineY: (moduleCount + QUIET_ZONE * 2 + 2.8) * modulePx,
  };
}

export interface QrSvgOptions {
  /** 前景色（码的深色部分） */
  fg: string;
  /** 背景色，恒为白 */
  bg: string;
  /** 输出的像素边长；默认 512 */
  px?: number;
}

/**
 * 把矩阵序列化成独立的 SVG 文档字符串。
 *
 * 每个深色模块是一段 `M…h1v1h-1z` 路径——矢量，放大到任何尺寸都锐利
 * （AC-015）。字符串形态便于在 Node 里直接测试。
 */
export function matrixToSvg(matrix: QrMatrix, options: QrSvgOptions): string {
  const sideUnits = qrSideUnits(matrix.size);
  const px = options.px ?? 512;
  const offset = qrOffsetUnits();
  const segments: string[] = [];

  for (let row = 0; row < matrix.size; row += 1) {
    for (let col = 0; col < matrix.size; col += 1) {
      if (matrix.modules[row * matrix.size + col] !== 1) continue;
      segments.push(`M${offset.x + col} ${offset.y + row}h1v1h-1z`);
    }
  }

  const labelY = matrix.size + QUIET_ZONE * 2 + 2.8;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${sideUnits} ${sideUnits}" role="img" aria-label="QR code">`,
    `<rect width="${sideUnits}" height="${sideUnits}" fill="${options.bg}"/>`,
    `<path d="${segments.join('')}" fill="${options.fg}"/>`,
    `<text x="${sideUnits / 2}" y="${labelY}" text-anchor="middle" font-family="${FONT_STACK}" font-size="2.2" fill="${LABEL_COLOR}">${SITE_LABEL}</text>`,
    '</svg>',
  ].join('');
}

export interface QrCanvasOptions {
  fg: string;
  bg: string;
  /** 单个模块的像素边长 */
  modulePx: number;
  /** 正方形画布边长（像素） */
  sidePx: number;
  offsetX: number;
  offsetY: number;
  labelBaselineY: number;
}

/** 在画布上绘制二维码 + 站点标识。画布由页面层创建并对齐尺寸。 */
export function renderQrCanvas(
  ctx: CanvasRenderingContext2D,
  matrix: QrMatrix,
  options: QrCanvasOptions,
): void {
  ctx.save();
  ctx.fillStyle = options.bg;
  ctx.fillRect(0, 0, options.sidePx, options.sidePx);

  ctx.fillStyle = options.fg;
  for (let row = 0; row < matrix.size; row += 1) {
    for (let col = 0; col < matrix.size; col += 1) {
      if (matrix.modules[row * matrix.size + col] !== 1) continue;
      ctx.fillRect(
        options.offsetX + col * options.modulePx,
        options.offsetY + row * options.modulePx,
        options.modulePx,
        options.modulePx,
      );
    }
  }

  ctx.fillStyle = LABEL_COLOR;
  ctx.font = `${Math.max(10, Math.round(options.modulePx * 2))}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(SITE_LABEL, options.sidePx / 2, options.labelBaselineY);
  ctx.restore();
}
