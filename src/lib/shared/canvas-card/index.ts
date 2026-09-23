/**
 * Canvas 卡片绘制内核——工具 2（倒计时卡片）与工具 5（随机分组）共用。
 *
 * 本目录下的文件禁止出现 document / window / navigator / localStorage
 * （DESIGN.md 红线 1）：绘图上下文由页面层创建后作为参数传入，本模块
 * 只接收 `CanvasRenderingContext2D` 并往上画。
 *
 * 硬性要求（技术栈.md §3.4）：必须基于 measureText 自适应排版，不能按
 * 固定像素绝对定位——系统字体栈在不同机器上宽度不同。
 */

/** 给定字号返回文本像素宽的测量回调（页面层传 ctx.measureText 的包装）。 */
export type MeasureAtSize = (px: number) => number;

/**
 * 在 [minPx, startPx] 区间内找出「宽度不超过 maxWidth」的最大字号。
 *
 * 假定文本宽度随字号单调递增，用二分查找；连 minPx 都放不下时返回 minPx
 * （由调用方决定溢出后怎么办，这里不做截断）。
 */
export function fitTextSize(
  maxWidth: number,
  startPx: number,
  minPx: number,
  measure: MeasureAtSize,
): number {
  if (measure(startPx) <= maxWidth) return startPx;
  let low = minPx;
  let high = startPx;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measure(mid) <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

/** 卡片主题的色板。页面预览用 CSS 呈现同一套值，两边必须保持一致。 */
export interface CardThemeColors {
  background: string;
  ink: string;
  muted: string;
  accent: string;
}

export const CARD_THEMES: Record<'light' | 'midnight' | 'warm', CardThemeColors> = {
  light: { background: '#FFFFFF', ink: '#16191A', muted: '#5A6360', accent: '#0F6E56' },
  midnight: { background: '#101614', ink: '#F2F5F4', muted: '#93A39D', accent: '#7ED9B8' },
  warm: { background: '#FBF0DE', ink: '#3A2C1B', muted: '#8A530B', accent: '#8A530B' },
};

/** drawCountdownCard 需要的、已由逻辑层算好的内容。 */
export interface CardContent {
  /** 卡片标题；空串 = 不渲染标题行 */
  title: string;
  /** 主读数文案，如 "265 days to go" */
  headline: string;
  /** 目标日期文本，如 "June 15, 2027" */
  dateLabel: string;
  /** 附言；空串 = 不渲染 */
  note: string;
  theme: 'light' | 'midnight' | 'warm';
}

/** 按空格折行，返回不超过 maxWidth 的行列表（单行 ≤ maxWidth）。 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (ctx.measureText(candidate).width <= maxWidth || current === '') {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== '') lines.push(current);
  return lines;
}

/**
 * 在 1080×1080 画布上绘制倒计时/纪念日卡片，右下角带 plainkit.app 站点标识。
 *
 * 调用方负责创建画布（含 2 倍分辨率处理）与下载/展示。
 */
export function drawCountdownCard(ctx: CanvasRenderingContext2D, content: CardContent): void {
  const size = 1080;
  const colors = CARD_THEMES[content.theme];
  const margin = 80;

  ctx.save();
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, size, size);
  ctx.textBaseline = 'alphabetic';

  // 标题：顶部居中，自适应字号。
  let cursorY = 150;
  if (content.title !== '') {
    ctx.font = '500 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = colors.muted;
    const titleSize = fitTextSize(size - margin * 2, 52, 32, (px) => {
      ctx.font = `500 ${px}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      return ctx.measureText(content.title).width;
    });
    ctx.font = `500 ${titleSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(content.title, size / 2, cursorY);
  }

  // 主读数：视觉中心，负字距的大数字文案。
  ctx.textAlign = 'center';
  ctx.font = '600 240px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const headlineSize = fitTextSize(size - margin * 2, 240, 88, (px) => {
    ctx.font = `600 ${px}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    return ctx.measureText(content.headline).width;
  });
  ctx.font = `600 ${headlineSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = colors.accent;
  ctx.fillText(content.headline, size / 2, 560);

  // 目标日期文本。
  ctx.font = '400 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = colors.muted;
  ctx.fillText(content.dateLabel, size / 2, 650);

  // 附言：折行，最多三行，位于卡片下部。
  if (content.note !== '') {
    ctx.font = '400 40px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = colors.ink;
    const lines = wrapText(ctx, content.note, size - margin * 2).slice(0, 3);
    let noteY = 800;
    for (const line of lines) {
      ctx.fillText(line, size / 2, noteY);
      noteY += 56;
    }
  }

  // 站点标识：右下角（可分享产物强制带标识，产品概述 §6.1）。
  ctx.font = '500 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = colors.muted;
  ctx.textAlign = 'right';
  ctx.fillText('plainkit.app', size - margin, size - margin + 10);

  ctx.restore();
}
