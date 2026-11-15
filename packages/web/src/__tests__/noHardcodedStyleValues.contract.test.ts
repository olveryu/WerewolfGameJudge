/**
 * Contract test: CSS uses design tokens.
 *
 * Scans production CSS for hardcoded style values that should reference the custom properties
 * published by `theme/colors.ts` (`--color-*`, `--report-*`) and `theme/tokens.css` (sizes,
 * type, radii, shadows).
 *
 * Checked patterns:
 *   - `#hex`, `rgb()`, `rgba()`, `hsl()`, `hsla()` color literals → `var(--color-*)`
 *   - font-size, line-height, border-radius, padding, margin and gap in px ≥ 2 or any rem
 *     → token vars (0 and 1px stay literal: resets and hairlines; unitless line-height stays)
 *   - font-weight as a number or bold-family keyword → `var(--weight-*)`
 *     (`normal`/`inherit`/`initial`/`unset` stay: they reset to the default, they do not pick a weight)
 *
 * The admin accent is pinned to the theme primary (see the `pins the admin accent` test):
 * a mock palette must not re-point `--admin-accent` at another color.
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
const TOKEN_PROPERTY =
  /^\s*(?:font-size|line-height|border-radius|padding(?:-[a-z]+)*|margin(?:-[a-z]+)*|gap|row-gap|column-gap)\s*:[^;]*?(?:\b(?:[2-9]|[1-9]\d+)px|\b\d*\.?\d+rem\b)/gm;
const FONT_WEIGHT_LITERAL = /^\s*font-weight\s*:\s*(?:[1-9]00|bold(?:er)?|lighter)\b/gm;

/**
 * Known exceptions: the night art (boot splash and WeChat login entry) and the game picker paint
 * over full-bleed artwork with fixed scrims, before or apart from the app palette; the scene bench
 * is a developer page outside the product. The capsule machine's 900 is a display face on game
 * art, outside the type scale (which tops out at --weight-bold: 700).
 */
const KNOWN_VIOLATIONS: Readonly<Record<string, number>> = {
  'boot/bootSplash.css': 3,
  'features/gacha/machine/CapsuleMachine.css': 1,
  'routes/bench/SceneBench.css': 7,
  'theme/nightArt.css': 8,
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
    (withoutComments.match(TOKEN_PROPERTY)?.length ?? 0) +
    (withoutComments.match(FONT_WEIGHT_LITERAL)?.length ?? 0)
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

  it('pins the admin accent to the theme primary', () => {
    // A mock palette must not re-point the admin accent at another color: the accent IS
    // the theme primary, so a re-point is the drift this test exists to catch.
    const tokens = readFileSync(join(SRC_DIR, TOKEN_FILE), 'utf8');
    expect(tokens).toMatch(/--admin-accent:\s*var\(--color-primary\);/);
    expect(tokens).toMatch(/--admin-accent-soft:\s*var\(--color-primary-a10\);/);
  });

  it('detects color literals, px/rem token properties and font-weight literals while allowing 0/1px', () => {
    expect(
      countViolations(
        [
          'a {',
          '  color: #fff;',
          '  background: rgb(0 0 0 / 50%);',
          '  padding: 12px;',
          '  font-size: 0.875rem;',
          '  font-weight: 700;',
          '  line-height: 1.6;',
          '  border-radius: 1px;',
          '  margin: 0;',
          '}',
          '/* #abc in a comment */',
        ].join('\n'),
      ),
    ).toBe(5);
  });
});
