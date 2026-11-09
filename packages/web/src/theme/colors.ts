import { withAlpha } from './colorUtils';

/**
 * App colour palette ("月白" scheme), ported from the RN client's `src/theme/colors.ts`.
 *
 * The single source for colours: `applyColorTokens` publishes it as `--color-*` CSS custom
 * properties for stylesheets, and TypeScript reads it directly where colours are computed
 * (gradients, scene tints).
 */
export const colors = {
  primary: '#4F46E5',
  primaryLight: '#818CF8',
  primaryDark: '#3730A3',

  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceHover: '#E5E5EA',
  card: '#FFFFFF',

  text: '#1A1A2E',
  textSecondary: '#5C5C70',
  textMuted: '#8E8EA0',
  textInverse: '#FFFFFF',

  border: '#D1D1D6',
  borderLight: '#E5E5EA',

  success: '#1A9A4A',
  warning: '#B87D08',
  error: '#D13438',
  info: '#2563EB',

  wolf: '#C82828',
  villager: '#1A9A4A',
  god: '#7B3FBF',
  third: '#B87D08',

  overlay: 'rgba(26, 26, 46, 0.6)',
  overlayLight: 'rgba(26, 26, 46, 0.25)',
} as const;

function toCustomPropertyName(prefix: string, token: string): string {
  return `--${prefix}-${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

/**
 * The review report's own flat palette (white "verdict ticket"): flat colors only, because the
 * mini-program capture stitches bands and a gradient would seam.
 */
const reportColors = {
  background: '#FFFFFF',
  cardBorder: '#E4E4EC',
  divider: '#ECECF2',
  text: '#17171F',
  textSecondary: '#55566B',
  textMuted: '#8A8A99',
  textFaint: '#A5A5B5',
  danger: '#D92D20',
  outMedalBg: '#FDECEA',
  outMedalBorder: '#EFA9A3',
  evilMedalBg: '#FDECEF',
  evilMedalText: '#D92D5D',
  evilMedalBorder: '#F3C2CF',
  specialMedalBg: '#ECEAFE',
  specialMedalText: '#4F46E5',
  specialMedalBorder: '#C9BFF5',
  goodMedalBg: '#E6F4EA',
  goodMedalText: '#067647',
  goodMedalBorder: '#A9D9BC',
  highlightMedalBg: '#FDF3E1',
  highlightMedalText: '#8A5A00',
  highlightMedalBorder: '#EFCF95',
  neutralMedalBg: '#F0F0F5',
  neutralMedalBorder: '#DCDCE6',
} as const;

/**
 * Translucent variants published as `--color-<token>-a<percent>` (e.g. `--color-primary-a25`).
 * CSS cannot derive them: `color-mix()` with variables needs Safari 16.2 and Chrome 111, above
 * the build target.
 */
const ALPHA_VARIANTS: readonly (readonly [keyof typeof colors, number])[] = [
  ['primary', 3],
  ['primary', 8],
  ['primary', 10],
  ['primary', 15],
  ['primary', 25],
  ['primary', 40],
  ['primaryDark', 40],
  ['error', 13],
  ['error', 20],
  ['error', 40],
  ['error', 50],
  ['warning', 13],
  ['warning', 30],
  ['warning', 40],
  ['success', 40],
  ['info', 8],
  ['background', 85],
  ['textMuted', 30],
  ...(['wolf', 'god', 'villager', 'third'] as const).flatMap((faction) =>
    [6, 12, 15, 25, 30].map((percent) => [faction, percent] as const),
  ),
];

/** Publishes the palettes as `--color-*` and `--report-*` custom properties on the document root. */
export function applyColorTokens(root: HTMLElement): void {
  for (const [token, value] of Object.entries(colors)) {
    root.style.setProperty(toCustomPropertyName('color', token), value);
  }
  for (const [token, percent] of ALPHA_VARIANTS) {
    root.style.setProperty(
      `${toCustomPropertyName('color', token)}-a${percent}`,
      withAlpha(colors[token], percent / 100),
    );
  }
  for (const [token, value] of Object.entries(reportColors)) {
    root.style.setProperty(toCustomPropertyName('report', token), value);
  }
}
