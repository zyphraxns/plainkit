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
} from './index';

/** 结果读数的内容（AC-007）。 */
export interface ChartSummary {
  count: number;
  max: DataPoint;
}

/**
 * 校验「这份数据能不能画成这种图」。
 *
 * 失败信息必须说清哪里错、怎么改（DESIGN.md §6-bis.8），并且指向替代方案——
 * 「饼图放不下负数」是数据模型的限制，不是用户的错。
 */
export function validateForType(type: ChartType, points: DataPoint[]): Result<void> {
  if (points.length < MIN_POINTS) {
    return { ok: false, message: `Add at least ${MIN_POINTS} rows of data.` };
  }

  if (type === 'pie') {
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

/** 读数统计：点数与最大值。数据为空时返回 null（页面显示引导态）。 */
export function summarize(points: DataPoint[]): ChartSummary | null {
  const max = points.reduce<DataPoint | null>((best, point) => {
    if (best === null || point.value > best.value) return point;
    return best;
  }, null);
  if (max === null) return null;
  return { count: points.length, max };
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
  return params;
}

/** 解码分享链接；任何一步不合法都返回 null（页面退回空白编辑态，不报错）。 */
export function decodeState(params: URLSearchParams): ChartState | null {
  const title = parseTitle(params.get('title') ?? '');
  const type = parseChartType(params.get('type') ?? '');
  const data = parseChartData(params.get('data') ?? '');
  if (!title.ok || !type.ok || !data.ok || data.value.points.length === 0) return null;
  return { title: title.value, type: type.value, points: data.value.points };
}
