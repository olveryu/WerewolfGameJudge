/**
 * Contract test: one avatar shape.
 *
 * `Avatar` owns its corners (`AVATAR_CORNER_RATIO`, at every size; `Avatar.test.tsx` pins the
 * value), and a square box around an avatar takes concentric corners from the one shared rule.
 * Who may shape an avatar, its hosts and boxes, and who may name the ratio, is checked by
 * Stylelint and ESLint (`stylelint.config.mjs`, `eslint.config.mjs`, UI drift lock plan §3 P9);
 * the rendered result by the screenshot gate (`e2e/visual`). This file pins the values.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  applyAvatarShapeTokens,
  AVATAR_CORNER_RATIO,
  AVATAR_CORNER_RATIO_PROPERTY,
} from '@/config/avatarShape';

const SRC_DIR = join(import.meta.dirname, '..');

describe('Avatar shape', () => {
  it('is a rounded square, not a circle or a sharp square', () => {
    expect(AVATAR_CORNER_RATIO).toBeGreaterThan(0);
    expect(AVATAR_CORNER_RATIO).toBeLessThan(0.5);
  });

  it('is published on the document root at start-up', () => {
    const root = document.createElement('div');
    applyAvatarShapeTokens(root);
    expect(root.style.getPropertyValue(AVATAR_CORNER_RATIO_PROPERTY)).toBe(
      String(AVATAR_CORNER_RATIO),
    );
    expect(readFileSync(join(SRC_DIR, 'main.tsx'), 'utf8')).toMatch(
      /applyAvatarShapeTokens\(document\.documentElement\)/,
    );
  });

  it('gives concentric boxes corners derived from the published ratio alone', () => {
    const sheet = readFileSync(join(SRC_DIR, 'components/avatar/avatarConcentric.css'), 'utf8');
    const radius = /border-radius\s*:([^;]*);/.exec(sheet)?.[1] ?? '';
    expect(radius).toContain(`var(${AVATAR_CORNER_RATIO_PROPERTY})`);
    expect(radius).toContain('var(--avatar-inset');
    // Only the formula's own constants: no second copy of the ratio, no fixed corner.
    expect(radius.match(/\d+(?:\.\d+)?(?:px|%)?/g)).toEqual(['100%', '1', '2', '0px']);
  });
});
