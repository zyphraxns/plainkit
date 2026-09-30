/**
 * 图表制作器：类型校验、读数统计与分享状态编解码。
 *
 * 校验与解析分开，是因为同一份数据在不同图表类型下的合法性不同——饼图放不下
 * 负数和全零，柱状图可以（BR-005）。
 */
import type { Result } from '@/lib/shared/result';

import {
  MAX_PIE_SLICES,
  MIN_POINTS,
  parseChartData,
  parseChartType,
  parseTitle,
  type ChartState,
  type ChartType,
  type DataPoint,
  type ParsedData,
} from './index';

/** 结果读数的内容（AC-007）。 */
export interface ChartSummary {
  count: number;
  max: DataPoint;
}

/** 合并后的双系列数据（CR-001）。系列 2 不存在时 `points2` 为 null。 */
export interface CombinedSeries {
  points: DataPoint[];
  points2: DataPoint[] | null;
  notice: string;
}

/**
 * 把两个系列配成一对（CR-001，BR-006）。
 *
 * 系列 2 为 null 或空 = 用户没填第二框，行为必须与 v1 完全一致。填了就要
 * 对齐：行数一致、标签逐行一致——不猜、不自动对齐，不一致就指出第几行。
 */
export function combineSeries(
  first: ParsedData,
  second: ParsedData | null,
): Result<CombinedSeries> {
  const empty = second === null || second.points.length === 0;
  if (empty) {
    return { ok: true, value: { points: first.points, points2: null, notice: first.notice } };
  }

  const secondPoints = second?.points ?? [];
  if (secondPoints.length !== first.points.length) {
    return {
      ok: false,
      message: `Series 1 has ${first.points.length} rows but Series 2 has ${secondPoints.length}. Both series need the same number of rows.`,
    };
  }

  for (let index = 0; index < first.points.length; index += 1) {
    const expected = first.points[index]?.label ?? '';
    const actual = secondPoints[index]?.label ?? '';
    if (actual !== expected) {
      return {
        ok: false,
        message: `Row ${index + 1}: "${actual}" does not match the label "${expected}" in Series 1.`,
      };
    }
  }

  return {
    ok: true,
    value: {
      points: first.points,
      points2: secondPoints,
      notice: first.notice || second?.notice || '',
    },
  };
}

/**
 * 校验「这份数据能不能画成这种图」。
 *
 * 失败信息必须说清哪里错、怎么改（DESIGN.md §6-bis.8），并且指向替代方案——
 * 「饼图放不下负数」是数据模型的限制，不是用户的错。
 */
export function validateForType(
  type: ChartType,
  points: DataPoint[],
  points2: DataPoint[] | null = null,
): Result<void> {
  if (points.length < MIN_POINTS) {
    return { ok: false, message: `Add at least ${MIN_POINTS} rows of data.` };
  }

  if (type === 'pie') {
    // 饼图没有双系列语义；静默只用系列 1 等于替用户丢数据（BR-006）。
    if (points2 !== null && points2.length > 0) {
      return {
        ok: false,
        message: 'A pie chart supports a single series. Use a bar or line chart instead.',
      };
    }
    if (points.length > MAX_PIE_SLICES) {
      return {
        ok: false,
        message: `A pie chart holds up to ${MAX_PIE_SLICES} slices. You have ${points.length}.`,
      };
    }
    if (points.some((point) => point.value < 0)) {
      return {
        ok: false,
        message: 'A pie chart cannot show negative numbers. Use a bar chart instead.',
      };
    }
    if (points.every((point) => point.value === 0)) {
      return {
        ok: false,
        message: 'A pie chart needs values above zero. Use a bar chart instead.',
      };
    }
  }

  return { ok: true, value: undefined };
}

/** 读数统计：点数与最大值（CR-001：双系列取并集口径）。数据为空时返回 null。 */
export function summarize(
  points: DataPoint[],
  points2: DataPoint[] | null = null,
): ChartSummary | null {
  const all = points2 === null ? points : [...points, ...points2];
  const max = all.reduce<DataPoint | null>((best, point) => {
    if (best === null || point.value > best.value) return point;
    return best;
  }, null);
  if (max === null) return null;
  return { count: all.length, max };
}

/**
 * 把图表状态编进链接参数。
 *
 * 数据用「标签⇥数值」按行拼接，与粘贴框里的原始格式完全同构——这样解码时
 * 可以直接复用 parseChartData，URL 里的值必然走与手输相同的校验路径
 * （DESIGN.md §16：URL 参数不可信）。
 */
export function encodeState(state: ChartState): URLSearchParams {
  const params = new URLSearchParams();
  params.set('title', state.title);
  params.set('type', state.type);
  params.set('data', state.points.map((point) => `${point.label}\t${point.value}`).join('\n'));
  // 第二系列只在真实存在时编码：旧链接保持旧形态（CR-001）。
  if (state.points2 !== undefined && state.points2 !== null && state.points2.length > 0) {
    params.set('data2', state.points2.map((point) => `${point.label}\t${point.value}`).join('\n'));
  }
  return params;
}

/** 解码分享链接；任何一步不合法都返回 null（页面退回空白编辑态，不报错）。 */
export function decodeState(params: URLSearchParams): ChartState | null {
  const title = parseTitle(params.get('title') ?? '');
  const type = parseChartType(params.get('type') ?? '');
  const data = parseChartData(params.get('data') ?? '');
  if (!title.ok || !type.ok || !data.ok || data.value.points.length === 0) return null;

  // 旧链接没有 data2 → 不长出第二系列字段，行为与 v1 完全一致（CR-001）。
  const data2Raw = params.get('data2');
  if (data2Raw === null) {
    return { title: title.value, type: type.value, points: data.value.points };
  }
  const data2 = parseChartData(data2Raw);
  if (!data2.ok || data2.value.points.length === 0) return null;
  return {
    title: title.value,
    type: type.value,
    points: data.value.points,
    points2: data2.value.points,
  };
}
