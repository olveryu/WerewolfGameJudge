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

/** Publishes the palettes as `--color-*` and `--report-*` custom properties on the document root. */
export function applyColorTokens(root: HTMLElement): void {
  for (const [token, value] of Object.entries(colors)) {
    root.style.setProperty(toCustomPropertyName('color', token), value);
  }
  for (const [token, value] of Object.entries(reportColors)) {
    root.style.setProperty(toCustomPropertyName('report', token), value);
  }
}
