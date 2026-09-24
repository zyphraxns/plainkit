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

export interface ToolEntry {
  /** 与 URL 路径、目录名、specs/features/<slug>.md 文件名必须完全一致 */
  slug: string;
  /** 界面上的英文标题 */
  title: string;
  /** 一句话英文说明，≤ 90 字符 */
  summary: string;
  /** 分类的英文短标签，用于首页分组 */
  category: string;
}

export const TOOLS: readonly ToolEntry[] = [
  {
    slug: 'grade-calculator',
    title: 'Final grade calculator',
    summary: 'See what score you need on the final to reach your target grade.',
    category: 'Study',
  },
  {
    slug: 'countdown-card',
    title: 'Countdown card',
    summary: 'Turn a date into a shareable countdown or anniversary card.',
    category: 'Life',
  },
  {
    slug: 'date-duration',
    title: 'Date duration calculator',
    summary: 'Count days, weeks and weekdays between two dates, with milestone reminders.',
    category: 'Life',
  },
  {
    slug: 'random-picker',
    title: 'Random group & name picker',
    summary: 'Split a list into random groups, draw names, or shuffle the order.',
    category: 'Study',
  },
];

/** 生成工具页的站内路径（目录式，带尾斜杠，已带部署基路径）。 */
export function toolHref(slug: string): string {
  return href(`tools/${slug}/`);
}
