/**
 * sharedStyles.test — Validates shared style presets
 *
 * Ensures createSharedStyles returns all expected keys and
 * each preset references theme-consistent values.
 */
import { createSharedStyles, type SharedStyles } from '../sharedStyles';
import { themes } from '../themes';
import { shadows } from '../tokens';

const darkColors = themes.dark.colors;
const lightColors = themes.light.colors;

describe('createSharedStyles', () => {
  let dark: SharedStyles;
  let light: SharedStyles;

  beforeAll(() => {
    dark = createSharedStyles(darkColors);
    light = createSharedStyles(lightColors);
  });

  const expectedKeys: (keyof SharedStyles)[] = [
    'screenContainer',
    'cardBase',
    'cardElevated',
    'inputBase',
    'modalOverlay',
    'modalBase',
    'sheetOverlay',
    'sheetBase',
    'sheetHandle',
    'listItem',
    'sectionTitle',
    'iconButton',
  ];

  it('returns all expected preset keys', () => {
    for (const key of expectedKeys) {
      expect(dark).toHaveProperty(key);
    }
  });

  // ── Card ──────────────────────────────────────────────────────────────
  it('cardBase uses surface bg, borderRadius, padding, and md shadow', () => {
    expect(dark.cardBase.backgroundColor).toBe(darkColors.surface);
    expect(dark.cardBase.borderRadius).toBeGreaterThan(0);
    expect(dark.cardBase.padding).toBeGreaterThan(0);
    expect(dark.cardBase).toHaveProperty('boxShadow');
  });

  it('cardElevated uses lg shadow (different from cardBase)', () => {
    expect(dark.cardElevated).toHaveProperty('boxShadow', shadows.lg.boxShadow);
  });

  // ── Modal vs Sheet overlay ────────────────────────────────────────────
  it('modalOverlay uses colors.overlay (dark)', () => {
    expect(dark.modalOverlay.backgroundColor).toBe(darkColors.overlay);
  });

  it('sheetOverlay uses colors.overlayLight (lighter)', () => {
    expect(dark.sheetOverlay.backgroundColor).toBe(darkColors.overlayLight);
  });

  // ── Theme adapts ──────────────────────────────────────────────────────
  it('adapts background to theme colors', () => {
    expect(dark.screenContainer.backgroundColor).toBe(darkColors.surface);
    expect(light.screenContainer.backgroundColor).toBe(lightColors.surface);
    expect(dark.screenContainer.backgroundColor).not.toBe(light.screenContainer.backgroundColor);
  });

  // ── iconButton backward compat ────────────────────────────────────────
  it('iconButton matches legacy shape', () => {
    expect(dark.iconButton.width).toBeGreaterThan(0);
    expect(dark.iconButton.height).toBe(dark.iconButton.width);
    expect(dark.iconButton.borderRadius).toBeGreaterThan(0);
  });
});
