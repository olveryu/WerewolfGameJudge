import { colors } from './colors';
import { withAlpha } from './colorUtils';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const [red, green, blue] = channels;
  if (red === undefined || green === undefined || blue === undefined) {
    throw new Error(`Invalid color: ${hex}`);
  }
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

describe('shared color contrast', () => {
  it('keeps text and primary actions readable on shared surfaces', () => {
    for (const background of [colors.background, colors.surface]) {
      for (const foreground of [
        colors.text,
        colors.textSecondary,
        colors.textMuted,
        colors.primary,
      ]) {
        expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(colors.textInverse, colors.primary)).toBeGreaterThanOrEqual(4.5);
  });
});

/** Flattens an `rgb(r g b / a%)` tint over an opaque hex background into a hex colour. */
function flatten(tint: string, background: string): string {
  const match = /^rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)$/.exec(tint);
  if (match === null) throw new Error(`Unexpected tint: ${tint}`);
  const alpha = Number(match[4]) / 100;
  return `#${[1, 2, 3]
    .map((index) => {
      const top = Number(match[index]);
      const bottom = Number.parseInt(background.slice(index * 2 - 1, index * 2 + 1), 16);
      return Math.round(top * alpha + bottom * (1 - alpha))
        .toString(16)
        .padStart(2, '0');
    })
    .join('')}`;
}

describe('tinted chip text contrast', () => {
  it('reads at AA on its own 12% tint over both shared surfaces, locked hues unchanged', () => {
    expect(colors.villager).toBe('#1A9A4A');
    expect(colors.third).toBe('#B87D08');
    for (const [text, hue] of [
      [colors.villagerText, colors.villager],
      [colors.thirdText, colors.third],
      [colors.warningText, colors.warning],
    ] as const) {
      for (const background of [colors.background, colors.surface]) {
        const chip = flatten(withAlpha(hue, 0.12), background);
        expect(contrast(text, chip)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
