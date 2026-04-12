/**
 * sharedStyles.test — Validates shared style presets
 *
 * Ensures createSharedStyles returns all expected keys and
 * each preset references theme-consistent values.
 */
import { colors } from '../colors';
import { createSharedStyles, type SharedStyles } from '../sharedStyles';
import { shadows } from '../tokens';

describe('createSharedStyles', () => {
  let styles: SharedStyles;

  beforeAll(() => {
    styles = createSharedStyles(colors);
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
      expect(styles).toHaveProperty(key);
    }
  });

  // ── Card ──────────────────────────────────────────────────────────────
  it('cardBase uses surface bg, borderRadius, padding, and md shadow', () => {
    expect(styles.cardBase.backgroundColor).toBe(colors.surface);
    expect(styles.cardBase.borderRadius).toBeGreaterThan(0);
    expect(styles.cardBase.padding).toBeGreaterThan(0);
    expect(styles.cardBase).toHaveProperty('boxShadow');
  });

  it('cardElevated uses lg shadow (different from cardBase)', () => {
    expect(styles.cardElevated).toHaveProperty('boxShadow', shadows.lg.boxShadow);
  });

  // ── Modal vs Sheet overlay ────────────────────────────────────────────
  it('modalOverlay uses colors.overlay (dark)', () => {
    expect(styles.modalOverlay.backgroundColor).toBe(colors.overlay);
  });

  it('sheetOverlay uses colors.overlayLight (lighter)', () => {
    expect(styles.sheetOverlay.backgroundColor).toBe(colors.overlayLight);
  });

  // ── Background uses colors ────────────────────────────────────────────
  it('uses colors.background for screenContainer', () => {
    expect(styles.screenContainer.backgroundColor).toBe(colors.background);
  });

  // ── iconButton backward compat ────────────────────────────────────────
  it('iconButton matches legacy shape', () => {
    expect(styles.iconButton.width).toBeGreaterThan(0);
    expect(styles.iconButton.height).toBe(styles.iconButton.width);
    expect(styles.iconButton.borderRadius).toBeGreaterThan(0);
  });
});
