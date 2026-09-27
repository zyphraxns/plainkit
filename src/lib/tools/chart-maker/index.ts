/**
 * 图表制作器：解析、校验、读数与分享状态。
 *
 * 本目录下的文件禁止出现 document / window / navigator / localStorage
 * （DESIGN.md 红线 1）。几何布局在 layout.ts，canvas 绘制在 draw.ts。
 */
import type { Result } from '@/lib/shared/result';

export const CHART_TYPES = ['bar', 'line', 'pie'] as const;

export type ChartType = (typeof CHART_TYPES)[number];

/** 输入上限（BR-003）。超限一律拒绝，不静默截断。 */
export const MAX_ROWS = 50;
export const MAX_ROW_CHARS = 60;
export const MAX_TOTAL_CHARS = 5000;
export const MAX_TITLE_CHARS = 60;

/** 饼图切片上限（BR-004）。 */
export const MAX_PIE_SLICES = 12;

/**
 * 图表填充色：主色 --accent 的 6 档明度（BR-007）。
 *
 * Canvas 取不到 CSS 变量，所以颜色必须以常量形式存在；`tokens.css` 里的
 * `--chart-1`…`--chart-6` 必须与这里逐项一致，改一处就要改两处。
 */
export const CHART_SHADES = [
  '#0F6E56',
  '#1A9375',
  '#2BB693',
  '#4AC9A9',
  '#79CDB8',
  '#A4D6C9',
] as const;

/** 最少数据点（BR-004）：1 个点的柱状/饼图没有意义。 */
export const MIN_POINTS = 2;

export interface DataPoint {
  label: string;
  value: number;
}

export interface ParsedData {
  points: DataPoint[];
  /**
   * 非空时页面显示一行说明。用于「取了前 50 行」这类**已处理但必须告知**
   * 的情形——静默截断与这个站的定位冲突。
   */
  notice: string;
}

export interface ChartState {
  title: string;
  type: ChartType;
  points: DataPoint[];
}

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

/** 分隔符优先级：制表符 > 逗号 > 分号（BR-001）。 */
function splitRow(row: string): string[] {
  if (row.includes('\t')) return row.split('\t');
  if (row.includes(',')) return row.split(',');
  if (row.includes(';')) return row.split(';');
  return [row];
}

/** 数值格式（BR-002）：只允许十进制，不接受千分位、货币符号、百分号、科学计数法。 */
function parseValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (!NUMBER_PATTERN.test(trimmed)) return null;
  return Number(trimmed);
}

/**
 * 解析粘贴的数据文本。
 *
 * 每行切成两段 = 标签 + 数值；只有一段 = 数值（标签用 `Row N`）；三段及以上
 * 一律报错并指出行号。**不静默丢弃任何一段数据**（BR-001）。
 */
export function parseChartData(raw: string): Result<ParsedData> {
  // 先看总量：一次超大粘贴不该进入逐行解析（DESIGN.md §16 资源限制）。
  if (raw.length > MAX_TOTAL_CHARS) {
    return {
      ok: false,
      message: `The pasted data is longer than ${MAX_TOTAL_CHARS} characters. Paste fewer rows.`,
    };
  }

  const lines = raw.split(/\r?\n/);
  const points: DataPoint[] = [];
  let labelCounter = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const rowNumber = index + 1;
    if (line.trim() === '') continue;

    if (line.length > MAX_ROW_CHARS) {
      return {
        ok: false,
        message: `Row ${rowNumber} is longer than ${MAX_ROW_CHARS} characters. Shorten it.`,
      };
    }

    const segments = splitRow(line);
    if (segments.length > 2) {
      // 「标签 + 千分位数字」会落成三段（Jan, 1,200）。猜任何一边都会在另一边
      // 静默出错，所以直接报错，并在这种情形下教用户去掉千分位逗号。
      const restAreNumbers = segments.slice(1).every((part) => parseValue(part) !== null);
      return {
        ok: false,
        message: restAreNumbers
          ? `Row ${rowNumber} looks like it has a thousands comma. Write 1200 instead of 1,200.`
          : `Row ${rowNumber} has ${segments.length} columns. Use one label and one number, like "Jan, 120".`,
      };
    }

    const value = parseValue(segments.length === 2 ? (segments[1] ?? '') : (segments[0] ?? ''));
    if (value === null) {
      return {
        ok: false,
        message: `Row ${rowNumber}: "${(segments[segments.length - 1] ?? '').trim()}" is not a number.`,
      };
    }

    labelCounter += 1;
    const label = segments.length === 2 ? (segments[0] ?? '').trim() : `Row ${labelCounter}`;
    points.push({ label, value });
  }

  // 超行上限：取前 50 行出图，但必须告诉用户（AC-020 不允许静默截断）。
  const overflowed = points.length > MAX_ROWS;
  return {
    ok: true,
    value: {
      points: overflowed ? points.slice(0, MAX_ROWS) : points,
      notice: overflowed ? `Only the first ${MAX_ROWS} rows are charted.` : '',
    },
  };
}

/** 图表标题：可留空（BR/ AC-006）。 */
export function parseTitle(input: string): Result<string> {
  const trimmed = input.trim();
  if (trimmed.length > MAX_TITLE_CHARS) {
    return {
      ok: false,
      message: `The title is longer than ${MAX_TITLE_CHARS} characters. Shorten it.`,
    };
  }
  return { ok: true, value: trimmed };
}

/** 图表类型：非三选一时回落 bar，而不是报错（页面上只有三个选项）。 */
export function parseChartType(input: string): Result<ChartType> {
  const match = CHART_TYPES.find((type) => type === input);
  return { ok: true, value: match ?? 'bar' };
}
