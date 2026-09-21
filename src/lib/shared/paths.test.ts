import { describe, expect, it } from 'vitest';

import { href } from './paths';

describe('href', () => {
  it('joins the path onto the deploy base path', () => {
    // 测试环境的 BASE_URL 是 '/'，所以结果应与输入一致（只是去掉了前导斜杠再拼回）
    expect(href('about/')).toBe('/about/');
    expect(href('/about/')).toBe('/about/');
  });

  it('preserves a trailing slash so directory-style URLs keep working', () => {
    expect(href('tools/grade-calculator/')).toBe('/tools/grade-calculator/');
  });

  it('does not double up slashes when the base path is a subdirectory', () => {
    // 镜像站基路径形如 '/plainkit/'；这里直接验证拼接规则的纯函数部分：
    // 无论输入带不带前导斜杠，都不应产生 '//'
    expect(href('/about/')).not.toContain('//');
    expect(href('about/')).not.toContain('//');
  });

  it('handles the bare root path', () => {
    expect(href('/')).toBe('/');
    expect(href('')).toBe('/');
  });
});
