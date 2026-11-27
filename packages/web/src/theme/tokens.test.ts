/**
 * The admin accent IS the theme primary: a mock palette must not re-point `--admin-accent` at
 * another color, so a re-point is the drift this test exists to catch. (Raw style values outside
 * this stylesheet are rejected by Stylelint: `pnpm run lint:css`, `stylelint.config.mjs`.)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const tokens = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8');

describe('theme tokens', () => {
  it('pins the admin accent to the theme primary', () => {
    expect(tokens).toMatch(/--admin-accent:\s*var\(--color-primary\);/);
    expect(tokens).toMatch(/--admin-accent-soft:\s*var\(--color-primary-a10\);/);
  });
});
