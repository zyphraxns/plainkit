/**
 * 图表绘制。
 *
 * 预览与 PNG 导出调用**同一个** drawChart——只有 width 不同（技术方案的
 * 判断 1：不维护两套绘制代码）。所有尺寸都按 `width / 1080` 缩放，画布
 * 坐标系以 1080 宽为基准。
 *
 * 颜色是常量而不是 CSS 变量——canvas 取不到 token；`tokens.css` 的
 * `--chart-1…6` 与 `CHART_SHADES` 必须逐项一致。本文件不碰 document /
 * window（DESIGN.md 红线 1），ctx 由页面层创建后传入。
 */
import type { ChartType, DataPoint } from './index';
import { CHART_SHADES } from './index';
import {
  computeAxisScale,
  computeBarLayout,
  computeLineLayout,
  computePieLayout,
  formatChartNumber,
  type PlotBox,
} from './layout';

export interface ChartContent {
  title: string;
  type: ChartType;
  points: DataPoint[];
}

export interface ChartDrawOptions {
  width: number;
  height: number;
}

/** 画布基准宽；所有字号与间距按 width/1080 缩放。 */
const BASE = 1080;

/* 与 tokens.css 逐项一致的全局色（DESIGN.md §6-bis.2）。 */
const INK = '#16191A';
const MUTED = '#5A6360';
const LINE = '#E2E5E4';
const LINE_STRONG = '#C8CECC';
const BG = '#FFFFFF';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const font = (px: number, weight = 400): string => `${weight} ${px}px ${FONT_STACK}`;

/**
 * 绘制一张完整图表：背景、可选标题、坐标轴、图形、数据标签、PlainKit 标识。
 *
 * 调用方负责创建画布（预览按 devicePixelRatio 放大；导出用 1080 宽离屏
 * canvas）与下载。图形本身的合法性由 validateForType 保证，这里只画。
 */
export function drawChart(
  ctx: CanvasRenderingContext2D,
  content: ChartContent,
  opts: ChartDrawOptions,
): void {
  const s = opts.width / BASE;
  const measure = (text: string, px: number): number => {
    ctx.font = font(px);
    return ctx.measureText(text).width;
  };

  ctx.save();
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, opts.width, opts.height);
  ctx.textBaseline = 'alphabetic';

  const leftPad = 64 * s;
  const rightPad = 24 * s;
  const titleSpace = content.title === '' ? 0 : 56 * s;
  const box: PlotBox = {
    left: leftPad,
    top: 24 * s + titleSpace,
    width: opts.width - leftPad - rightPad,
    height: opts.height - (24 * s + titleSpace) - 56 * s,
  };

  if (content.title !== '') {
    ctx.font = font(28 * s, 500);
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.fillText(content.title, box.left, 28 * s);
  }

  if (content.type === 'pie') {
    drawPie(ctx, content, box, s, measure);
  } else {
    drawAxisChart(ctx, content, box, s, measure);
  }

  // 站点标识：右下角（可分享产物强制带标识，产品概述 §6.1；2026-09-25 裁定不带域名）。
  ctx.font = font(22 * s, 500);
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'right';
  ctx.fillText('PlainKit', opts.width - rightPad, opts.height - 20 * s);

  ctx.restore();
}

/** 画 Y 轴网格线与刻度值（柱状 / 折线共用）。 */
function drawAxis(
  ctx: CanvasRenderingContext2D,
  ticks: { value: number; y: number }[],
  box: PlotBox,
  s: number,
): void {
  ctx.font = font(12 * s);
  ctx.textAlign = 'right';
  for (const tick of ticks) {
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(box.left, tick.y);
    ctx.lineTo(box.left + box.width, tick.y);
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.fillText(formatChartNumber(tick.value), box.left - 10 * s, tick.y + 4 * s);
  }
}

/** 画轴下方的分类标签（已由布局层隔位、截断）。 */
function drawLabels(
  ctx: CanvasRenderingContext2D,
  labels: { text: string; x: number; y: number; show: boolean }[],
  s: number,
): void {
  ctx.font = font(14 * s);
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'center';
  for (const label of labels) {
    if (label.show) ctx.fillText(label.text, label.x, label.y);
  }
}

function drawAxisChart(
  ctx: CanvasRenderingContext2D,
  content: ChartContent,
  box: PlotBox,
  s: number,
  measure: (text: string, px: number) => number,
): void {
  const values = content.points.map((point) => point.value);
  const scale = computeAxisScale(values, { zeroBased: content.type === 'bar' });

  if (content.type === 'bar') {
    const layout = computeBarLayout(content.points, scale, box, measure, 14 * s);

    drawAxis(ctx, layout.ticks, box, s);

    // 0 基准线要画得比网格线重——它是正负值的分界（BR-005）。
    ctx.strokeStyle = LINE_STRONG;
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(box.left, layout.zeroY);
    ctx.lineTo(box.left + box.width, layout.zeroY);
    ctx.stroke();

    ctx.fillStyle = CHART_SHADES[0];
    for (const bar of layout.bars) {
      ctx.fillRect(bar.x, bar.y, bar.width, bar.height);
    }

    if (layout.bars[0]?.showValue) {
      ctx.font = font(12 * s);
      ctx.fillStyle = MUTED;
      ctx.textAlign = 'center';
      for (const bar of layout.bars) {
        const above = bar.value >= 0;
        ctx.fillText(
          formatChartNumber(bar.value),
          bar.x + bar.width / 2,
          above ? bar.y - 8 * s : bar.y + bar.height + 14 * s,
        );
      }
    }

    drawLabels(ctx, layout.labels, s);
    return;
  }

  const layout = computeLineLayout(content.points, scale, box);
  drawAxis(ctx, layout.ticks, box, s);

  ctx.strokeStyle = CHART_SHADES[0];
  ctx.lineWidth = 3 * s;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  layout.points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  for (const point of layout.points) {
    ctx.fillStyle = BG;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CHART_SHADES[0];
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.font = font(14 * s);
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'center';
  const stride = Math.max(Math.ceil(content.points.length / 12), 1);
  layout.points.forEach((point, index) => {
    if (index % stride === 0)
      ctx.fillText(content.points[index]?.label ?? '', point.x, box.top + box.height + 22 * s);
  });
}

function drawPie(
  ctx: CanvasRenderingContext2D,
  content: ChartContent,
  box: PlotBox,
  s: number,
  measure: (text: string, px: number) => number,
): void {
  const layout = computePieLayout(content.points, box, measure);

  // 先画标签再画扇区，标签被扇区压住时能看出来（扇区之间有白色分隔线兜底）。
  ctx.font = font(14 * s);
  for (const slice of layout.slices) {
    const text = slice.showPercent ? `${slice.text} ${slice.percent}%` : slice.text;
    ctx.fillStyle = MUTED;
    ctx.textAlign = slice.align;
    ctx.fillText(text, slice.labelX, slice.labelY);
  }

  for (const slice of layout.slices) {
    ctx.beginPath();
    ctx.moveTo(layout.centerX, layout.centerY);
    ctx.arc(layout.centerX, layout.centerY, layout.radius, slice.startAngle, slice.endAngle);
    ctx.closePath();
    ctx.fillStyle = CHART_SHADES[slice.shadeIndex] ?? CHART_SHADES[0];
    ctx.fill();
    // 白色描边就是扇区分隔线——单色系在亮端相邻对比度不足，靠它划清边界。
    ctx.strokeStyle = BG;
    ctx.lineWidth = 2 * s;
    ctx.stroke();
  }
}
