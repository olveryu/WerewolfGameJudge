/**
 * Appearance page stacking: the page's one scene canvas draws every picker cell's frame and
 * flair, so it must stay above any cell, including the lifted (selected) one.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC_DIR = join(import.meta.dirname, '..');

function read(path: string): string {
  return readFileSync(join(SRC_DIR, path), 'utf8');
}

function layer(name: string): number {
  const match = new RegExp(`--${name}:\\s*(\\d+);`).exec(read('theme/tokens.css'));
  if (!match?.[1]) throw new Error(`Missing --${name} in tokens.css`);
  return Number(match[1]);
}

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Missing rule ${selector}`);
  return css.slice(start, css.indexOf('}', start));
}

describe('Appearance page layers', () => {
  it('stacks the scene canvas above a lifted picker cell', () => {
    expect(layer('layer-resident-scene')).toBeGreaterThan(layer('layer-appearance-cell-lifted'));
    expect(
      rule(read('features/product/components/ResidentPreview.css'), '.resident-scene-host'),
    ).toContain('z-index: var(--layer-resident-scene);');
    expect(
      rule(read('routes/appearance/AppearancePage.css'), ".appearance-cell[aria-pressed='true']"),
    ).toContain('z-index: var(--layer-appearance-cell-lifted);');
  });
});
