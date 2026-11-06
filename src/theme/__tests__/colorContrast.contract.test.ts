/**
 * colorContrast.contract — the theme's color pairs meet WCAG 2.2 AA and its type scale
 * keeps functional text legible.
 *
 * Text pairs need 4.5:1 (SC 1.4.3). A tint is `withAlpha(fill, ≤ 0.2)` composited over
 * surface or background. textDisabled is absent on purpose: SC 1.4.3 exempts inactive
 * controls. Fill-only tokens never color text; text uses the matching `*Text` token or
 * `toneColors[tone].text`. No font size is below 11px, the functional-text floor.
 */

import fs from 'node:fs';
import path from 'node:path';

// The theme index is mocked in jest.setup.ts; the contract reads the real modules.
import { colors, NIGHT_REPORT_COLORS, PRIMARY_GRADIENT, toneColors } from '../colors';
import { typography } from '../tokens';

const AA_TEXT = 4.5;
const MAX_TINT_ALPHA = 0.2;
const MIN_FONT_SIZE = 11;

function channels(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match === null) throw new Error(`Expected #RRGGBB, got ${hex}`);
  return [
    Number.parseInt(match[1]!, 16),
    Number.parseInt(match[2]!, 16),
    Number.parseInt(match[3]!, 16),
  ];
}

/** WCAG 2.2 relative luminance. */
function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const srgb = value / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  ) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

/** Source-over composite of `fill` at `alpha` on an opaque background, rounded like a screen. */
function composite(fill: string, alpha: number, background: string): string {
  const top = channels(fill);
  const bottom = channels(background);
  return `#${top
    .map((value, index) => Math.round(value * alpha + bottom[index]! * (1 - alpha)))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

interface Pair {
  readonly label: string;
  readonly foreground: string;
  readonly background: string;
}

const OPAQUE_SURFACES = {
  surface: colors.surface,
  card: colors.card,
  background: colors.background,
} as const;

const ALL_SURFACES = { ...OPAQUE_SURFACES, surfaceHover: colors.surfaceHover } as const;

const TEXT_ON_ALL_SURFACES = {
  text: colors.text,
  textSecondary: colors.textSecondary,
  primaryDark: colors.primaryDark,
  ...Object.fromEntries(
    Object.entries(toneColors).map(([tone, { text }]) => [`toneColors.${tone}.text`, text]),
  ),
};

function textPairs(): Pair[] {
  const pairs: Pair[] = [];
  for (const [textName, foreground] of Object.entries(TEXT_ON_ALL_SURFACES)) {
    for (const [surfaceName, background] of Object.entries(ALL_SURFACES)) {
      pairs.push({ label: `${textName} on ${surfaceName}`, foreground, background });
    }
  }
  for (const [surfaceName, background] of Object.entries(OPAQUE_SURFACES)) {
    pairs.push({ label: `textMuted on ${surfaceName}`, foreground: colors.textMuted, background });
  }
  for (const [tone, { fill, text }] of Object.entries(toneColors)) {
    for (const [surfaceName, background] of Object.entries(OPAQUE_SURFACES)) {
      pairs.push({
        label: `toneColors.${tone}.text on its ${MAX_TINT_ALPHA * 100}% tint over ${surfaceName}`,
        foreground: text,
        background: composite(fill, MAX_TINT_ALPHA, background),
      });
    }
    pairs.push({
      label: `textInverse on toneColors.${tone}.fill`,
      foreground: colors.textInverse,
      background: fill,
    });
  }
  PRIMARY_GRADIENT.forEach((stop, index) => {
    pairs.push({
      label: `textInverse on PRIMARY_GRADIENT stop ${index}`,
      foreground: colors.textInverse,
      background: stop,
    });
  });
  return pairs;
}

function nightReportPairs(): Pair[] {
  const report = NIGHT_REPORT_COLORS;
  return [
    ...(['text', 'textSecondary', 'textMuted', 'danger'] as const).map((name) => ({
      label: `night report ${name} on background`,
      foreground: report[name],
      background: report.background,
    })),
    ...(['wolfText', 'villagerText', 'godText', 'thirdText'] as const).map((name) => ({
      label: `night report timeline ${name} on background`,
      foreground: colors[name],
      background: report.background,
    })),
    {
      label: 'night report text on neutral medal',
      foreground: report.text,
      background: report.neutralMedalBg,
    },
    {
      label: 'night report textMuted on neutral medal',
      foreground: report.textMuted,
      background: report.neutralMedalBg,
    },
    {
      label: 'night report wolf medal',
      foreground: report.wolfMedalText,
      background: report.wolfMedalBg,
    },
    {
      label: 'night report god medal',
      foreground: report.godMedalText,
      background: report.godMedalBg,
    },
    {
      label: 'night report good medal',
      foreground: report.goodMedalText,
      background: report.goodMedalBg,
    },
    {
      label: 'night report dead medal',
      foreground: report.dangerText,
      background: report.deadMedalBg,
    },
    {
      label: 'night report stamp numeral',
      foreground: colors.textInverse,
      background: report.danger,
    },
  ];
}

describe('theme color pairs meet WCAG 2.2 AA (4.5:1 text)', () => {
  it.each([...textPairs(), ...nightReportPairs()])('$label', ({ foreground, background }) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

const FILL_ONLY_TOKENS = ['success', 'warning', 'error', 'wolf', 'villager', 'god', 'third'];
const FILL_AS_TEXT = new RegExp(
  `(?<![A-Za-z])color:\\s*colors\\.(${FILL_ONLY_TOKENS.join('|')})\\b`,
);

function productionSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' || entry.name === '__mocks__'
        ? []
        : productionSourceFiles(fullPath);
    }
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [fullPath] : [];
  });
}

describe('fill-only tokens never color text', () => {
  const sourceRoot = path.join(process.cwd(), 'src');
  const offenders = productionSourceFiles(sourceRoot).flatMap((file) =>
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, index) =>
        FILL_AS_TEXT.test(line)
          ? [`${path.relative(process.cwd(), file)}:${index + 1}: ${line.trim()}`]
          : [],
      ),
  );

  it('uses *Text tokens for status and faction text', () => {
    expect(offenders).toEqual([]);
  });
});

describe('type scale keeps functional text legible', () => {
  const sizes = Object.entries(typography).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number',
  );

  it('has font sizes to check', () => {
    expect(sizes.length).toBeGreaterThan(0);
  });

  it.each(sizes)(`typography.%s is at least ${MIN_FONT_SIZE}px`, (_name, size) => {
    expect(size).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
  });
});
