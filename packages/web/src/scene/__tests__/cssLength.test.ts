import { describe, expect, it } from 'vitest';

import { resolveCssLength } from '../cssLength';

describe('resolveCssLength', () => {
  it('resolves px, percentages and the calc sums concentric corners compute to', () => {
    expect(resolveCssLength('16px', 80)).toBe(16);
    expect(resolveCssLength('25%', 80)).toBe(20);
    expect(resolveCssLength('0px', 80)).toBe(0);
    expect(resolveCssLength('calc(25% + 1px)', 48)).toBe(13);
    expect(resolveCssLength('calc(2px + 25%)', 80)).toBe(22);
    expect(resolveCssLength('calc(25% - 1.5px)', 80)).toBe(18.5);
  });

  it('fails loudly on anything it cannot resolve', () => {
    expect(() => resolveCssLength('', 80)).toThrow();
    expect(() => resolveCssLength('1em', 80)).toThrow();
    expect(() => resolveCssLength('calc(25% * 2)', 80)).toThrow();
    expect(() => resolveCssLength('16px 8px', 80)).toThrow();
  });
});
