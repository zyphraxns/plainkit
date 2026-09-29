/**
 * 转盘抽人——纯几何与随机逻辑。
 *
 * 本目录下的文件禁止出现 document / window / navigator / localStorage
 * （DESIGN.md 红线 1）。
 *
 * 角度约定：**0° = 12 点方向，顺时针为正。** 指针固定在 0°，盘转。
 *
 * 核心不变量（BR-015「先算后转」）：中签者先由随机源确定，旋转角度由该结果
 * 反推。盘顺时针转 `rotation` 度后，落在指针下的盘内角度是
 * `(-rotation) mod 360`，它必须落在中签扇区内——`spinRotation` 的测试对此
 * 做了穷举断言，不允许只抽样。
 *
 * 对应验收标准：specs/features/random-picker-wheel.md
 */
import type { RandomSource } from './index';

/** 转盘人数上限（BR-016）：扇区再窄就读不出名字了。 */
export const WHEEL_MAX_NAMES = 50;
/** 每次旋转的整圈数。固定 3 圈，不给旋钮（旋钮是给开发者的，不是给老师的）。 */
export const WHEEL_TURNS = 3;
/** 扇区内随机抖动的幅度（× 半扇区）。±0.4 保证指针不越出中标扇区。 */
export const WHEEL_JITTER = 0.4;

/** SVG 画布尺寸与圆心。 */
export const WHEEL_VIEWBOX = 320;
export const WHEEL_CENTER = 160;
/** 外半径 / 中心留空半径。 */
export const WHEEL_RADIUS = 152;
export const WHEEL_INNER_RADIUS = 34;

/** 扇区文字的内外留白（SVG 单位）。 */
const WHEEL_PAD = 12;
/** 扇区文字的锚点半径：文字从这里开始朝圆心书写。 */
export const WHEEL_LABEL_RADIUS = WHEEL_RADIUS - WHEEL_PAD;
/** 字号两档：扇区够宽用 12，否则 9。 */
const LABEL_SIZE_LARGE = 12;
const LABEL_SIZE_SMALL = 9;
/** 一「行」文字相对字号的高度系数，用于算出文字能延伸到多靠内。 */
const LABEL_LINE = 1.25;
/** 窄于此角度的扇区放不下任何可读文字。 */
const MIN_LABEL_STEP = 4;

export interface WheelSector {
  index: number;
  /** 起始角（度，0 = 12 点，顺时针）。 */
  start: number;
  /** 结束角。 */
  end: number;
  /** 中心角。 */
  center: number;
}

export interface SectorLabel {
  text: string;
  fontSize: number;
  visible: boolean;
}

/** 坐标保留两位小数，避免 SVG 路径里出现长浮点。 */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 把整圈等分成 `count` 个扇区（AC-042）。
 *
 * `count < 1` 时返回空数组——调用方负责保证至少 2 个名字。
 */
export function sectorAngles(count: number): WheelSector[] {
  if (count < 1) return [];
  const step = 360 / count;
  return Array.from({ length: count }, (_, index) => ({
    index,
    start: index * step,
    end: (index + 1) * step,
    center: (index + 0.5) * step,
  }));
}

/**
 * 先算后转的第一步：用注入的随机源定出中签索引（BR-015）。
 *
 * 不用 Math.random()；`random()` 越界（返回 1）时钳到最后一个索引。
 */
export function pickWinnerIndex(count: number, random: RandomSource): number {
  const index = Math.floor(random() * count);
  return Math.min(Math.max(index, 0), count - 1);
}

/**
 * 由中签结果反推旋转角度（BR-015）。
 *
 * 盘转 R 度后指针下的盘内角度是 `(-R) mod 360`；本函数令它落在
 * `[index, index+1)` 扇区内，抖动 `jitter` 只在该扇区内部偏移。
 */
export function spinRotation(index: number, count: number, turns: number, jitter: number): number {
  const step = 360 / count;
  const center = (index + 0.5) * step;
  return 360 * turns + ((360 - center) % 360) + jitter;
}

/**
 * 在既有角度上叠加一次旋转，保证盘只往前转（AC-045）。
 *
 * 返回值的 `mod 360` 与 `spinRotation` 一致，但数值不小于
 * `currentRotation + 360 × turns`，所以视觉上永远向前转满 `turns` 圈。
 */
export function advanceRotation(
  currentRotation: number,
  index: number,
  count: number,
  turns: number,
  jitter: number,
): number {
  const target = spinRotation(index, count, turns, jitter);
  let rotation = ((target % 360) + 360) % 360;
  const minimum = currentRotation + 360 * turns;
  while (rotation < minimum) rotation += 360;
  return rotation;
}

/** 不放回连抽：移除中签者，返回新数组（不改动原数组，AC-046）。 */
export function removeAt(names: string[], index: number): string[] {
  if (index < 0 || index >= names.length) return [...names];
  return [...names.slice(0, index), ...names.slice(index + 1)];
}

/** 极坐标 → SVG 坐标（0° 在 12 点，顺时针）。 */
export function sectorPoint(radius: number, angle: number): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180;
  return {
    x: WHEEL_CENTER + radius * Math.sin(radians),
    y: WHEEL_CENTER - radius * Math.cos(radians),
  };
}

/**
 * 扇区（环形扇）的 SVG path。
 *
 * 满圆（只剩 1 人时）必须特殊处理：SVG 规范规定「起点与终点重合的弧不绘制」，
 * 所以整圈要拆成两段 180° 弧；内圈反向绕行以挖出中心孔（nonzero 填充规则）。
 */
export function sectorPath(sector: WheelSector): string {
  if (sector.end - sector.start >= 360) {
    const mid = sector.start + 180;
    const o1 = sectorPoint(WHEEL_RADIUS, sector.start);
    const o2 = sectorPoint(WHEEL_RADIUS, mid);
    const i1 = sectorPoint(WHEEL_INNER_RADIUS, sector.start);
    const i2 = sectorPoint(WHEEL_INNER_RADIUS, mid);
    return [
      `M ${round(o1.x)} ${round(o1.y)}`,
      `A ${WHEEL_RADIUS} ${WHEEL_RADIUS} 0 1 1 ${round(o2.x)} ${round(o2.y)}`,
      `A ${WHEEL_RADIUS} ${WHEEL_RADIUS} 0 1 1 ${round(o1.x)} ${round(o1.y)}`,
      'Z',
      `M ${round(i1.x)} ${round(i1.y)}`,
      `A ${WHEEL_INNER_RADIUS} ${WHEEL_INNER_RADIUS} 0 1 0 ${round(i2.x)} ${round(i2.y)}`,
      `A ${WHEEL_INNER_RADIUS} ${WHEEL_INNER_RADIUS} 0 1 0 ${round(i1.x)} ${round(i1.y)}`,
      'Z',
    ].join(' ');
  }

  const largeArc = sector.end - sector.start > 180 ? 1 : 0;
  const outerStart = sectorPoint(WHEEL_RADIUS, sector.start);
  const outerEnd = sectorPoint(WHEEL_RADIUS, sector.end);
  const innerEnd = sectorPoint(WHEEL_INNER_RADIUS, sector.end);
  const innerStart = sectorPoint(WHEEL_INNER_RADIUS, sector.start);
  return [
    `M ${round(outerStart.x)} ${round(outerStart.y)}`,
    `A ${WHEEL_RADIUS} ${WHEEL_RADIUS} 0 ${largeArc} 1 ${round(outerEnd.x)} ${round(outerEnd.y)}`,
    `L ${round(innerEnd.x)} ${round(innerEnd.y)}`,
    `A ${WHEEL_INNER_RADIUS} ${WHEEL_INNER_RADIUS} 0 ${largeArc} 0 ${round(innerStart.x)} ${round(innerStart.y)}`,
    'Z',
  ].join(' ');
}

/**
 * 扇区文字的 transform：锚在外缘、沿半径向内排。
 *
 * 文字用 `text-anchor="end"` 配合本 transform，从外缘朝圆心方向书写。
 */
export function labelTransform(angle: number, radius: number): string {
  const point = sectorPoint(radius, angle);
  return `translate(${round(point.x)} ${round(point.y)}) rotate(${round(angle - 90)})`;
}

/**
 * 扇区文字：选字号、按可用长度截断（AC-052）。
 *
 * 可用径向长度 = 外缘留白半径 − max(文字高度要求的最小半径, 中心留空半径)。
 * 越靠圆心，扇区越窄——所以宽度约束由「文字能延伸到多靠内」决定，
 * 而不是简单地用外缘弧长。
 */
export function sectorLabel(
  name: string,
  step: number,
  measure: (text: string, px: number) => number,
): SectorLabel {
  const hidden: SectorLabel = { text: '', fontSize: 0, visible: false };
  if (step < MIN_LABEL_STEP) return hidden;

  const fontSize = step >= 12 ? LABEL_SIZE_LARGE : LABEL_SIZE_SMALL;
  const outerRadius = WHEEL_LABEL_RADIUS;
  const minRadius = (fontSize * LABEL_LINE) / (2 * Math.sin((step * Math.PI) / 360));
  const innerLimit = Math.max(minRadius, WHEEL_INNER_RADIUS + WHEEL_PAD);
  if (innerLimit >= outerRadius) return hidden;

  const maxLength = outerRadius - innerLimit;
  if (measure(name, fontSize) <= maxLength) {
    return { text: name, fontSize, visible: true };
  }

  // 按码点截断，避免把 emoji 的代理对切成两半
  const chars = [...name];
  while (chars.length > 1 && measure(`${chars.join('')}…`, fontSize) > maxLength) {
    chars.pop();
  }
  return { text: `${chars.join('')}…`, fontSize, visible: true };
}

/**
 * 转盘结果的复制文本：首行是带站点标识的抬头，空一行后是中签名字（AC-049）。
 *
 * 与 `formatGroupsText` / `formatTeamsText` 同一套格式——抬头里已经写了
 * 「Picked from N names」，所以这里不需要再带人数。
 */
export function formatPickText(winner: string, header: string): string {
  return `${header}\n\n${winner}`;
}
