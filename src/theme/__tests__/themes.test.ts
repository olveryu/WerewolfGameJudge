/**
 * themes.test — Theme completeness & contrast validation
 *
 * Ensures all 8 themes implement ThemeColors correctly and meet
 * minimum contrast ratios for key color pairs.
 */
import { type ThemeColors, type ThemeKey, themes } from '../themes';

// ============================================================================
// Helpers
// ============================================================================

/** Parse hex (#RRGGBB or #RGB) to sRGB [r,g,b] in 0-255 */
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Relative luminance per WCAG 2.1 */
function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio between two hex colors */
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ============================================================================
// Tests
// ============================================================================

const themeKeys = Object.keys(themes) as ThemeKey[];

describe('themes registry', () => {
  it('contains exactly 8 themes', () => {
    expect(themeKeys).toHaveLength(8);
  });

  it.each(themeKeys)('%s has matching key property', (key) => {
    expect(themes[key].key).toBe(key);
  });

  it.each(themeKeys)('%s has a non-empty name', (key) => {
    expect(themes[key].name.length).toBeGreaterThan(0);
  });

  it.each(themeKeys)('%s has isDark boolean', (key) => {
    expect(typeof themes[key].isDark).toBe('boolean');
  });
});

describe('ThemeColors completeness', () => {
  // Canonical field list — add new fields here when extending ThemeColors
  const requiredFields: (keyof ThemeColors)[] = [
    'primary',
    'primaryLight',
    'primaryDark',
    'background',
    'surface',
    'surfaceHover',
    'card',
    'text',
    'textSecondary',
    'textMuted',
    'textInverse',
    'border',
    'borderLight',
    'success',
    'warning',
    'error',
    'info',
    'wolf',
    'villager',
    'god',
    'third',
    'overlay',
    'overlayLight',
  ];

  it.each(themeKeys)('%s has all required color fields', (key) => {
    const colors = themes[key].colors;
    for (const field of requiredFields) {
      expect(colors).toHaveProperty(field);
      expect(typeof colors[field]).toBe('string');
      expect(colors[field].length).toBeGreaterThan(0);
    }
  });
});

describe('contrast ratios (WCAG 2.1)', () => {
  // Only check hex-based colors (skip rgba overlays)
  const isHex = (c: string) => c.startsWith('#');

  describe.each(themeKeys)('%s', (key) => {
    const c = themes[key].colors;

    it('text on background ≥ 4.5:1 (AA normal)', () => {
      if (!isHex(c.text) || !isHex(c.background)) return;
      expect(contrastRatio(c.text, c.background)).toBeGreaterThanOrEqual(4.5);
    });

    it('text on surface ≥ 4.5:1 (AA normal)', () => {
      if (!isHex(c.text) || !isHex(c.surface)) return;
      expect(contrastRatio(c.text, c.surface)).toBeGreaterThanOrEqual(4.5);
    });

    it('textSecondary on surface ≥ 3:1 (AA large)', () => {
      if (!isHex(c.textSecondary) || !isHex(c.surface)) return;
      expect(contrastRatio(c.textSecondary, c.surface)).toBeGreaterThanOrEqual(3);
    });

    it('primary on background ≥ 3:1 (interactive)', () => {
      if (!isHex(c.primary) || !isHex(c.background)) return;
      expect(contrastRatio(c.primary, c.background)).toBeGreaterThanOrEqual(3);
    });
  });
});
