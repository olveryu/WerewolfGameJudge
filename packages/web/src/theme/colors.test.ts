import { colors } from './colors';

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
