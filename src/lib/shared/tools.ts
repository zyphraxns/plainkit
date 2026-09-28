/**
 * 工具登记表。
 *
 * 这里是「已上线工具」的唯一事实来源：首页索引读它生成列表，新增工具时在此登记。
 * 见 specs/项目结构.md §3.4「新增一个工具要动的地方」。
 *
 * 只登记【已上线】的工具。在建的工具不要写进来，否则会把还没做好的链接
 * 暴露给用户。
 */
import { href } from './paths';

/**
 * 首页分类词表。
 *
 * 按「使用者在什么场景下需要它」分，不按技术类型分。锁成字面量联合类型是为了让
 * 「新增第 5 个分类」变成一次需要人工决定的改动（类型检查会拦住），而不是每周加
 * 工具时顺手编一个、最后长出 8 个分类和一个 Other 抽屉。
 *
 * 原分类里的 Utility 已被废除：它从来不是分类，是「不知道放哪」的抽屉。
 * 见 specs/DESIGN.md §6-bis.10。
 */
export const TOOL_CATEGORIES = ['School', 'Dates', 'Pictures', 'Fun'] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export interface ToolEntry {
  /** 与 URL 路径、目录名、specs/features/<slug>.md 文件名必须完全一致 */
  slug: string;
  /** 界面上的英文标题 */
  title: string;
  /**
   * 一句话英文说明。硬上限 60 字符（目标 ≤ 45，即首页卡片里只占一行）。
   * 由 src/lib/shared/tools.test.ts 机械校验。
   */
  summary: string;
  /** 分类标签，必须是 TOOL_CATEGORIES 之一 */
  category: ToolCategory;
}

/**
 * 登记顺序 = 首页展示顺序，且**按分类相邻排列**。
 * 这样工具数达到 12 个、启用分组标题时（DESIGN.md §6-bis.10）不需要重新洗牌。
 */
export const TOOLS: readonly ToolEntry[] = [
  {
    slug: 'grade-calculator',
    title: 'Final grade calculator',
    summary: 'What you need on the final to reach your target grade.',
    category: 'School',
  },
  {
    slug: 'random-picker',
    title: 'Random group & name picker',
    summary: 'Split a list into teams, draw names, shuffle the order.',
    category: 'School',
  },
  {
    slug: 'countdown-card',
    title: 'Countdown card maker',
    summary: 'Turn a date into a countdown or anniversary card.',
    category: 'Dates',
  },
  {
    slug: 'date-duration',
    title: 'Date duration calculator',
    summary: 'Days, weeks and weekdays between two dates.',
    category: 'Dates',
  },
  {
    slug: 'ascii-art',
    title: 'Image to ASCII art',
    summary: 'Turn a picture into text art you can copy or download.',
    category: 'Pictures',
  },
  {
    slug: 'qr-code',
    title: 'QR code generator',
    summary: 'Turn a link, Wi-Fi password or contact into a QR code.',
    category: 'Pictures',
  },
  {
    slug: 'chart-maker',
    title: 'Chart maker',
    summary: 'Turn pasted numbers into a bar, line or pie chart image.',
    category: 'Pictures',
  },
  {
    slug: 'typing-test',
    title: 'Typing speed test',
    summary: 'Measure your typing speed and get a result card.',
    category: 'Fun',
  },
];

/** 生成工具页的站内路径（目录式，带尾斜杠，已带部署基路径）。 */
export function toolHref(slug: string): string {
  return href(`tools/${slug}/`);
}
