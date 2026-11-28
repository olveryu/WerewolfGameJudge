/**
 * The admin accent IS the theme primary: a mock palette must not re-point `--admin-accent` at
 * another color, so a re-point is the drift this test exists to catch. (Raw style values outside
 * this stylesheet are rejected by Stylelint: `pnpm run lint:css`, `stylelint.config.mjs`.)
 *
 * Corners are named by purpose (UI drift lock plan §4 P3): components read `--radius-control`,
 * `--radius-card` …; the raw scale (`--radius-12` …) is read by this stylesheet alone, which the
 * Stylelint config enforces and the last case pins.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import stylelint from 'stylelint';

const tokens = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8');
const REPO_ROOT = join(import.meta.dirname, '../../../..');

async function rulesBrokenBy(file: string, code: string): Promise<string[]> {
  const { results } = await stylelint.lint({
    code,
    codeFilename: join(REPO_ROOT, file),
    configFile: join(REPO_ROOT, 'stylelint.config.mjs'),
  });
  return results.flatMap((result) => result.warnings.map((warning) => warning.rule));
}

describe('theme tokens', () => {
  it('pins the admin accent to the theme primary', () => {
    expect(tokens).toMatch(/--admin-accent:\s*var\(--color-primary\);/);
    expect(tokens).toMatch(/--admin-accent-soft:\s*var\(--color-primary-a10\);/);
  });

  it('gives every corner purpose one step of the raw scale', () => {
    const purposes = {
      control: 12,
      card: 16,
      'card-nested': 12,
      inset: 8,
      tight: 4,
      pill: 9999,
      round: 9999,
    };
    for (const [purpose, px] of Object.entries(purposes)) {
      expect(tokens).toMatch(new RegExp(`--radius-${purpose}:\\s*var\\(--radius-${px}\\);`));
    }
  });

  it('pins the raw radius scale and the ellipse to their values', () => {
    for (const px of [4, 8, 12, 16, 9999]) {
      expect(tokens).toMatch(new RegExp(`--radius-${px}:\\s*${px}px;`));
    }
    expect(tokens).toMatch(/--radius-ellipse:\s*50%;/);
  });

  it(
    'keeps raw units out of custom properties outside tokens.css',
    { timeout: 60_000 },
    async () => {
      const component = 'packages/web/src/components/Probe.css';
      expect(await rulesBrokenBy(component, '.probe { --r: 13px; }\n')).toEqual([
        'declaration-property-unit-allowed-list',
      ]);
      expect(await rulesBrokenBy(component, '.probe { --r: var(--radius-control); }\n')).toEqual(
        [],
      );
      expect(await rulesBrokenBy(component, '.probe { --scale: 0.96; }\n')).toEqual([]);
      expect(
        await rulesBrokenBy('packages/web/src/theme/tokens.css', ':root { --size-probe: 13px; }\n'),
      ).toEqual([]);
    },
  );

  it('lets only a shared component sheet style its classes', { timeout: 60_000 }, async () => {
    const game = 'packages/web/src/games/probe/Probe.css';
    expect(await rulesBrokenBy(game, '.probe-row > .button { width: 100%; }\n')).toEqual([
      'selector-disallowed-list',
    ]);
    expect(
      await rulesBrokenBy(game, '.probe .icon-button[data-active] { color: red; }\n'),
    ).toContain('selector-disallowed-list');
    // Excluding a shared component from a page-wide rule is allowed.
    expect(await rulesBrokenBy(game, '.probe button:not(.icon-button) { padding: 0; }\n')).toEqual(
      [],
    );
    expect(
      await rulesBrokenBy(
        'packages/web/src/components/Button.css',
        ".button[data-size='sm'] { padding: 0; }\n",
      ),
    ).toEqual([]);
  });

  it('lets only tokens.css read the raw radius scale', { timeout: 60_000 }, async () => {
    const component = 'packages/web/src/components/Probe.css';
    expect(await rulesBrokenBy(component, '.probe { border-radius: var(--radius-12); }\n')).toEqual(
      ['declaration-property-value-disallowed-list'],
    );
    expect(
      await rulesBrokenBy(component, '.probe { border-radius: var(--radius-control); }\n'),
    ).toEqual([]);
    expect(
      await rulesBrokenBy(
        'packages/web/src/theme/tokens.css',
        ':root { --radius-probe: var(--radius-12); }\n',
      ),
    ).toEqual([]);
  });
});
