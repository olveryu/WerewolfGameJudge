import { colors } from '../colors';

type RGBA = readonly [number, number, number, number];

function parseColor(value: string): RGBA {
  const hexMatch = /^#([0-9a-f]{6})$/i.exec(value);
  if (hexMatch?.[1] !== undefined) {
    const hex = hexMatch[1];
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
      1,
    ];
  }

  const rgbMatch = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgbMatch?.[1] === undefined) throw new Error(`Unsupported color token: ${value}`);

  const channels = rgbMatch[1].split(',').map(Number);
  const [red, green, blue, alpha = 1] = channels;
  if (red === undefined || green === undefined || blue === undefined) {
    throw new Error(`Invalid color token: ${value}`);
  }
  return [red, green, blue, alpha];
}

function composite(foreground: RGBA, background: RGBA): RGBA {
  const alpha = foreground[3];
  return [
    foreground[0] * alpha + background[0] * (1 - alpha),
    foreground[1] * alpha + background[1] * (1 - alpha),
    foreground[2] * alpha + background[2] * (1 - alpha),
    1,
  ];
}

function luminance(color: RGBA): number {
  const linear = color.slice(0, 3).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrastRatio(foreground: RGBA, background: RGBA): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe('theme text contrast', () => {
  it('keeps muted text readable on the app and card surfaces', () => {
    const foreground = parseColor(colors.textMuted);

    expect(contrastRatio(foreground, parseColor(colors.background))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(foreground, parseColor(colors.surface))).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps inverse text readable on success and warning seat badges', () => {
    const foreground = parseColor(colors.textInverse);

    expect(contrastRatio(foreground, parseColor(colors.successBadge))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(foreground, parseColor(colors.warningBadge))).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps inverse text readable across the home hero gradient', () => {
    const overlay = parseColor(colors.overlayMedium);
    const foreground = parseColor(colors.textInverse);

    for (const stop of [colors.primaryLight, colors.primary]) {
      const background = composite(overlay, parseColor(stop));
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
