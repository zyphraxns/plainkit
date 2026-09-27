import { describe, expect, it } from 'vitest';

import { TOOL_CATEGORIES, TOOLS } from './tools';

/**
 * 首页索引的机械护栏。
 *
 * 这些不是功能测试，是把「首页排版规范」里几条肉眼会漂掉的规则变成构建门禁：
 * 摘要长度决定卡片会不会变成三行，分类词表决定会不会长出第 5 个分类。
 * 规范见 specs/DESIGN.md §6-bis.10。
 */
describe('TOOLS', () => {
  it('AC-IDX-001: keeps every summary within the card width limit', () => {
    for (const tool of TOOLS) {
      expect(tool.summary.length, `${tool.slug}: "${tool.summary}"`).toBeLessThanOrEqual(60);
    }
  });

  it('AC-IDX-002: only uses categories from the locked list', () => {
    const allowed: readonly string[] = TOOL_CATEGORIES;
    for (const tool of TOOLS) {
      expect(allowed, `${tool.slug}: "${tool.category}"`).toContain(tool.category);
    }
  });

  it('AC-IDX-003: has no duplicate slugs', () => {
    const slugs = TOOLS.map((tool) => tool.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
