/**
 * Contract test: CSS uses design tokens.
 *
 * Scans production CSS for hardcoded style values that should reference the custom properties
 * published by `theme/colors.ts` (`--color-*`, `--report-*`) and `theme/tokens.css` (sizes,
 * type, radii, shadows).
 *
 * Checked patterns:
 *   - `#hex`, `rgb()`, `rgba()`, `hsl()`, `hsla()` color literals → `var(--color-*)`
 *   - font-size, line-height, border-radius, padding, margin and gap in px ≥ 2 → token vars
 *     (0 and 1px stay literal: resets and hairlines)
 *
 * `theme/tokens.css` defines the tokens and is exempt. Uses a ratchet allowlist: KNOWN_VIOLATIONS
 * records the exact count per file. New violations fail; fixed violations also fail until the
 * allowlist is lowered.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_DIR = join(import.meta.dirname, '..');
const TOKEN_FILE = 'theme/tokens.css';

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;
const PX_TOKEN_PROPERTY =
  /^\s*(?:font-size|line-height|border-radius|padding(?:-[a-z]+)*|margin(?:-[a-z]+)*|gap|row-gap|column-gap)\s*:[^;]*?\b(?:[2-9]|[1-9]\d+)px/gm;

/**
 * Known exceptions: the WeChat login entry and the game picker paint over full-bleed artwork with
 * fixed scrims; the scene bench is a developer page outside the product.
 */
const KNOWN_VIOLATIONS: Readonly<Record<string, number>> = {
  'features/auth/WechatLoginEntry.css': 7,
  'routes/bench/SceneBenchPage.css': 7,
  'routes/games/GamePickerPage.css': 4,
  'routes/home/HomePage.css': 1,
};

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) return cssFiles(fullPath);
    return entry.endsWith('.css') ? [fullPath] : [];
  });
}

function countViolations(source: string): number {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return (
    (withoutComments.match(COLOR_LITERAL)?.length ?? 0) +
    (withoutComments.match(PX_TOKEN_PROPERTY)?.length ?? 0)
  );
}

describe('No hardcoded style values', () => {
  const actual = Object.fromEntries(
    cssFiles(SRC_DIR)
      .map(
        (file) => [relative(SRC_DIR, file), countViolations(readFileSync(file, 'utf8'))] as const,
      )
      .filter(([file, count]) => file !== TOKEN_FILE && count > 0),
  );

  it('matches the ratchet allowlist exactly', () => {
    expect(actual).toEqual(KNOWN_VIOLATIONS);
  });

  it('detects color literals and px token properties while allowing 0/1px', () => {
    expect(
      countViolations(
        [
          'a {',
          '  color: #fff;',
          '  background: rgb(0 0 0 / 50%);',
          '  padding: 12px;',
          '  border-radius: 1px;',
          '  margin: 0;',
          '}',
          '/* #abc in a comment */',
        ].join('\n'),
      ),
    ).toBe(3);
  });
});
