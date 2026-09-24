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

// ---------------------------------------------------------------------------
// 工具 5：随机分组 / 抽签结果卡片
// ---------------------------------------------------------------------------

/** 分组卡片的一块内容：一个组（或抽人/排序模式下的无标签整列）。 */
export interface GroupCardGroup {
  /** 组名（如 "Group 1"）；空串 = 不渲染标签行（抽人 / 随机排序模式） */
  label: string;
  /** 截断后的成员名行（布局计算时按列宽截断超长名） */
  memberLines: string[];
  /** 标签行（布局用）；无标签组为空数组 */
  labelLines: string[];
}

/** computeGroupCardLayout 的输出：drawGroupCard 据此机械绘制。 */
export interface GroupCardLayout {
  width: number;
  height: number;
  /** 内容区底边的 y 坐标（页脚在此之下） */
  contentBottom: number;
  /** 按列分好的组；列数 1–3 */
  columns: GroupCardGroup[][];
}

/** 分组卡片需要的内容（逻辑层已算好文案）。 */
export interface GroupCardContent {
  /** 卡片标题；空串 = 不渲染 */
  title: string;
  /** 模式摘要，如 "4 groups" / "5 picked names" */
  modeLabel: string;
  groups: GroupCardGroupInput[];
  /** 日期文本，如 "September 24, 2026" */
  dateLabel: string;
}

interface GroupCardGroupInput {
  label: string;
  members: string[];
}

/** 卡片排版常量（宽固定 1080，高按内容增长）。 */
const CARD_WIDTH = 1080;
const CARD_MARGIN = 80;
const COLUMN_GAP = 48;
const MEMBER_SIZE = 34;
const LABEL_SIZE = 40;
const LINE_HEIGHT = 48;

/** 布局用的假想字体度量回调（页面层传 ctx.measureText 的包装）。 */
export type MeasureTextAt = (text: string, px: number) => number;

const columnCount = (groupCount: number): number =>
  groupCount <= 1 ? 1 : groupCount === 2 ? 2 : 3;

/**
 * 计算分组卡片的排版：列数、每组所在列、成员行截断、画布高度。
 *
 * 纯函数——度量通过 `measure` 注入，测试用假测量器即可覆盖（jsdom 无
 * canvas）。绘制本身由 drawGroupCard 完成。
 */
export function computeGroupCardLayout(
  content: GroupCardContent,
  measure: MeasureTextAt,
): GroupCardLayout {
  const cols = columnCount(content.groups.length);
  const columnWidth = (CARD_WIDTH - CARD_MARGIN * 2 - COLUMN_GAP * (cols - 1)) / cols;
  const maxTextWidth = columnWidth - LINE_HEIGHT; // 组内左右各留一行高的边距

  // 截断放不下的超长名：保底 1 个字符 + 省略号（AC-013 不丢名字，但
  // 单个名字物理放不下时只能截断，否则卡片会被撑破）。
  const fitName = (name: string): string => {
    if (measure(name, MEMBER_SIZE) <= maxTextWidth) return name;
    let cut = name.length;
    while (cut > 1 && measure(`${name.slice(0, cut - 1)}…`, MEMBER_SIZE) > maxTextWidth) {
      cut -= 1;
    }
    return `${name.slice(0, Math.max(cut - 1, 1))}…`;
  };

  const groups: GroupCardGroup[] = content.groups.map((group) => ({
    label: group.label,
    memberLines: group.members.map(fitName),
    labelLines: group.label === '' ? [] : [group.label],
  }));

  // 估算每块高度（标签行 + 成员行），按最矮列贪心分配，保持各栏高度接近。
  const blockHeight = (group: GroupCardGroup): number =>
    (group.labelLines.length + group.memberLines.length) * LINE_HEIGHT;
  const columns: GroupCardGroup[][] = Array.from({ length: cols }, () => []);
  const heights = new Array<number>(cols).fill(0);
  for (const group of groups) {
    let target = 0;
    for (let i = 1; i < cols; i += 1) {
      if ((heights[i] ?? 0) < (heights[target] ?? 0)) target = i;
    }
    columns[target]!.push(group);
    heights[target] = (heights[target] ?? 0) + blockHeight(group) + LINE_HEIGHT; // + 组间空隙
  }

  // 头部：标题（可选）→ 模式摘要 → 日期，基线位置固定偏移。
  const titleBaseline = 150;
  const modeBaseline = content.title === '' ? 170 : titleBaseline + 84;
  const dateBaseline = modeBaseline + 62;
  const contentTop = dateBaseline + 70;
  const contentBottom = contentTop + Math.max(...heights, LINE_HEIGHT);
  const height = contentBottom + 110; // 底部留页脚（站点标识）空间

  return { width: CARD_WIDTH, height, contentBottom, columns };
}

/**
 * 在画布上绘制随机分组 / 抽签结果卡片，右下角带 plainkit.app 站点标识。
 *
 * 画布宽 1080、高由 computeGroupCardLayout 决定；调用方负责创建画布
 * （含 2 倍分辨率处理）与下载/展示。
 */
export function drawGroupCard(ctx: CanvasRenderingContext2D, content: GroupCardContent): void {
  const measure: MeasureTextAt = (text, px) => {
    ctx.font = `400 ${px}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    return ctx.measureText(text).width;
  };
  const layout = computeGroupCardLayout(content, measure);
  const colors = CARD_THEMES.light;
  const FONT = (px: number, weight = 400) =>
    `${weight} ${px}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  ctx.save();
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // 头部三行的基线与布局计算保持同一套偏移。
  const titleBaseline = 150;
  const modeBaseline = content.title === '' ? 170 : titleBaseline + 84;
  const dateBaseline = modeBaseline + 62;

  if (content.title !== '') {
    ctx.font = FONT(64, 500);
    ctx.fillStyle = colors.ink;
    ctx.fillText(content.title, CARD_MARGIN, titleBaseline);
  }

  ctx.font = FONT(44, 600);
  ctx.fillStyle = colors.accent;
  ctx.fillText(content.modeLabel, CARD_MARGIN, modeBaseline);

  ctx.font = FONT(36);
  ctx.fillStyle = colors.muted;
  ctx.fillText(content.dateLabel, CARD_MARGIN, dateBaseline);

  // 内容起始 y 与 computeGroupCardLayout 的 contentTop 同一偏移。
  const contentTop = dateBaseline + 70;
  const columnWidth =
    (layout.width - CARD_MARGIN * 2 - COLUMN_GAP * (layout.columns.length - 1)) /
    layout.columns.length;
  layout.columns.forEach((column, colIndex) => {
    const x = CARD_MARGIN + colIndex * (columnWidth + COLUMN_GAP) + LINE_HEIGHT / 2;
    let cursor = contentTop;
    for (const group of column) {
      if (group.label !== '') {
        ctx.font = FONT(LABEL_SIZE, 600);
        ctx.fillStyle = colors.accent;
        cursor += LABEL_SIZE;
        ctx.fillText(group.labelLines[0] ?? '', x, cursor);
        cursor += LINE_HEIGHT - LABEL_SIZE;
      }
      ctx.font = FONT(MEMBER_SIZE);
      ctx.fillStyle = colors.ink;
      for (const line of group.memberLines) {
        cursor += LINE_HEIGHT;
        ctx.fillText(line, x, cursor);
      }
      cursor += LINE_HEIGHT; // 组间空隙，与布局估算一致
    }
  });

  // 站点标识：右下角（产品概述 §6.1）。
  ctx.font = FONT(30, 500);
  ctx.fillStyle = colors.muted;
  ctx.textAlign = 'right';
  ctx.fillText('plainkit.app', layout.width - CARD_MARGIN, layout.height - 70);

  ctx.restore();
}
