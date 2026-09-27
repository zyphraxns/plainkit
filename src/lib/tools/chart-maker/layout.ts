/**
 * 图表制作器：几何布局。
 *
 * 全部是纯函数——文本宽度通过 `measure` 回调注入，因此不需要真实 canvas
 * 就能在 Node 里测试（与 `shared/canvas-card` 的 computeXxxLayout 同一套路）。
 * 画笔调用在 draw.ts，本文件不碰 CanvasRenderingContext2D。
 */
import type { MeasureTextAt } from '@/lib/shared/canvas-card';
import { roundTo } from '@/lib/shared/format';

import { CHART_SHADES, type DataPoint } from './index';

/** 绘图区（坐标轴内的矩形，不含轴标签）。 */
export interface PlotBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface AxisScale {
  min: number;
  max: number;
  ticks: { value: number }[];
}

export interface BarBox {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  /** 柱顶是否标数值：柱子太多时会互相压住，索性不标 */
  showValue: boolean;
}

export interface BarLabel {
  index: number;
  text: string;
  x: number;
  y: number;
  /** false = 隔位跳过，避免 50 根柱的标签挤成一团 */
  show: boolean;
}

export interface BarLayout {
  bars: BarBox[];
  labels: BarLabel[];
  zeroY: number;
  ticks: { value: number; y: number }[];
}

export interface LineLayout {
  points: { x: number; y: number; value: number }[];
  ticks: { value: number; y: number }[];
}

export interface PieSlice {
  label: string;
  /** 图上显示的标签（过长时截断，原 label 不被改动） */
  text: string;
  value: number;
  percent: number;
  startAngle: number;
  endAngle: number;
  /** 占比 > 5% 才标百分比，否则标签会互相压住 */
  showPercent: boolean;
  shadeIndex: number;
  labelX: number;
  labelY: number;
  align: 'left' | 'right';
}

export interface PieLayout {
  centerX: number;
  centerY: number;
  radius: number;
  slices: PieSlice[];
}

/** 轴标签字号与偏移（导出卡上按比例放大）。 */
const LABEL_PX = 14;
const LABEL_OFFSET = 22;
/** 超过这个数量的柱子，轴标签开始隔位显示。 */
const DENSE_LABEL_LIMIT = 12;

const NUMBER_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/**
 * 展示前的数字格式化：千分位 + 最多两位小数（BR-008）。
 *
 * 走 Intl 而不是手写，是为了在大数上不退化成 `1e+21` 这种指数记法
 * ——图表里的数字是要被人读的。
 */
export function formatChartNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return NUMBER_FORMAT.format(roundTo(value, 2));
}

/** 把 (0, 1, 2, 2.5, 5, 10) × 10ⁿ 里最接近的一档作为刻度步长。 */
function niceStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const exponent = Math.floor(Math.log10(raw));
  const magnitude = 10 ** exponent;
  const normalized = raw / magnitude;
  const scaled =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return scaled * magnitude;
}

/**
 * 计算 Y 轴范围与刻度。
 *
 * 柱状图 `zeroBased: true`——截断 Y 轴会把 5% 的差距画成数倍，是经典误导
 * 手法（BR-005）。折线图看趋势，允许贴近数据范围。
 */
export function computeAxisScale(values: number[], opts: { zeroBased: boolean }): AxisScale {
  const finite = values.filter((value) => Number.isFinite(value));
  const rawMin = finite.length > 0 ? Math.min(...finite) : 0;
  const rawMax = finite.length > 0 ? Math.max(...finite) : 0;

  let min = opts.zeroBased ? Math.min(0, rawMin) : rawMin;
  let max = opts.zeroBased ? Math.max(0, rawMax) : rawMax;

  // 数据全部相同时轴会退化成零高度，撑开一点（AC-024）。
  if (max === min) {
    if (opts.zeroBased) {
      max = min === 0 ? 1 : min + Math.abs(min) * 0.2;
    } else {
      const pad = Math.abs(min) * 0.1 || 1;
      min -= pad;
      max += pad;
    }
  }

  const step = niceStep((max - min) / 5);
  min = Math.floor(min / step) * step;
  max = Math.ceil(max / step) * step;
  if (max === min) max = min + step;

  const ticks: { value: number }[] = [];
  for (let value = min; value <= max + step * 1e-9; value += step) {
    ticks.push({ value: roundTo(value, 6) });
  }
  return { min, max, ticks };
}

/** 标签放不下时按宽度截断，末尾加省略号（数据本身不动）。 */
function fitLabel(text: string, maxWidth: number, px: number, measure: MeasureTextAt): string {
  if (measure(text, px) <= maxWidth) return text;
  let cut = text.length;
  while (cut > 1 && measure(`${text.slice(0, cut - 1)}…`, px) > maxWidth) {
    cut -= 1;
  }
  return `${text.slice(0, Math.max(cut - 1, 1))}…`;
}

/** 值 → 屏幕 y（屏幕坐标向下增长，值越大越靠上）。 */
function yFor(value: number, scale: AxisScale, box: PlotBox): number {
  const span = scale.max - scale.min || 1;
  return box.top + ((scale.max - value) / span) * box.height;
}

function ticksWithY(scale: AxisScale, box: PlotBox): { value: number; y: number }[] {
  return scale.ticks.map((tick) => ({ value: tick.value, y: yFor(tick.value, scale, box) }));
}

/** 柱状图布局：柱矩形、轴标签（隔位）、0 基准线位置。 */
export function computeBarLayout(
  points: DataPoint[],
  scale: AxisScale,
  box: PlotBox,
  measure: MeasureTextAt,
  labelPx: number = LABEL_PX,
): BarLayout {
  const count = points.length;
  const slot = count > 0 ? box.width / count : box.width;
  const barWidth = Math.max(slot * 0.6, 1);
  const zeroY = yFor(0, scale, box);
  const showValue = count <= DENSE_LABEL_LIMIT;
  const stride = Math.max(Math.ceil(count / DENSE_LABEL_LIMIT), 1);

  const bars = points.map((point, index) => {
    const edge = yFor(point.value, scale, box);
    const top = point.value >= 0 ? edge : zeroY;
    const bottom = point.value >= 0 ? zeroY : edge;
    return {
      x: box.left + index * slot + (slot - barWidth) / 2,
      y: top,
      width: barWidth,
      height: Math.max(bottom - top, 1),
      value: point.value,
      showValue,
    };
  });

  const labels = points.map((point, index) => ({
    index,
    text: fitLabel(point.label, Math.max(slot * 0.9, 24), labelPx, measure),
    x: box.left + index * slot + slot / 2,
    y: box.top + box.height + LABEL_OFFSET,
    show: index % stride === 0,
  }));

  return { bars, labels, zeroY, ticks: ticksWithY(scale, box) };
}

/** 折线图布局：点坐标（首尾贴边）与刻度。 */
export function computeLineLayout(points: DataPoint[], scale: AxisScale, box: PlotBox): LineLayout {
  const stepX = points.length > 1 ? box.width / (points.length - 1) : 0;
  return {
    points: points.map((point, index) => ({
      x: box.left + index * stepX,
      y: yFor(point.value, scale, box),
      value: point.value,
    })),
    ticks: ticksWithY(scale, box),
  };
}

/**
 * 饼图布局：按值降序切分圆，超过 6 片时循环复用 6 档明度。
 *
 * 降序不只是好看——相邻扇区大小不同，配合 2px 白色分隔线，在单色系下
 * 也能一眼分清边界（BR-007 的已知代价，见技术方案）。
 */
export function computePieLayout(
  points: DataPoint[],
  box: PlotBox,
  measure: MeasureTextAt,
): PieLayout {
  const centerX = box.left + box.width / 2;
  const centerY = box.top + box.height / 2;
  const radius = Math.min(box.width, box.height) / 2;
  const total = points.reduce((sum, point) => sum + Math.max(point.value, 0), 0);
  const ordered = [...points].sort((a, b) => b.value - a.value);

  let angle = -Math.PI / 2; // 从 12 点方向开始
  const slices = ordered.map((point, index) => {
    const percent = total > 0 ? roundTo((Math.max(point.value, 0) / total) * 100, 1) : 0;
    const sweep = total > 0 ? (Math.max(point.value, 0) / total) * Math.PI * 2 : 0;
    const startAngle = angle;
    angle += sweep;
    const mid = (startAngle + angle) / 2;
    return {
      label: point.label,
      text: fitLabel(point.label, radius * 0.9, LABEL_PX, measure),
      value: point.value,
      percent,
      startAngle,
      endAngle: angle,
      showPercent: percent > 5,
      shadeIndex: index % CHART_SHADES.length,
      labelX: centerX + Math.cos(mid) * radius * 1.12,
      labelY: centerY + Math.sin(mid) * radius * 1.12,
      align: Math.cos(mid) >= 0 ? ('left' as const) : ('right' as const),
    };
  });

  return { centerX, centerY, radius, slices };
}
