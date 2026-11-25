import { withAlpha } from './colorUtils';

/**
 * App colour palette: cool neutrals and a restrained blue for primary actions.
 *
 * The single source for colours: `applyColorTokens` publishes it as `--color-*` CSS custom
 * properties for stylesheets, and TypeScript reads it directly where colours are computed
 * (gradients, scene tints).
 */
export const colors = {
  primary: '#285F86',
  primaryLight: '#3B6D91',
  primaryDark: '#1A405D',

  background: '#EDF2F7',
  surface: '#FFFFFF',
  surfaceHover: '#E0E9F1',
  card: '#FFFFFF',

  text: '#1A3149',
  textSecondary: '#526779',
  textMuted: '#5B6E80',
  textInverse: '#FFFFFF',

  border: '#C4D2DE',
  borderLight: '#DEE7EE',

  success: '#1A9A4A',
  warning: '#B87D08',
  /** Warning-hued text on a warning tint (AA 4.5:1 on --color-warning-a12 over the background). */
  warningText: '#7F5605',
  error: '#D13438',
  info: '#2563EB',

  handResourceInk: '#245D43',
  handResourcePaper: '#E0F1E7',
  handHostInk: '#62488A',
  handHostPaper: '#EEE5F8',
  handDangerInk: '#9A2529',
  handDangerPaper: '#FCE8E8',
  handDisabledVeil: 'rgba(255, 255, 255, 0.4)',
  wolf: '#C82828',
  villager: '#1A9A4A',
  god: '#7B3FBF',
  third: '#B87D08',
  /**
   * Faction text on a faction tint where the locked faction colour misses AA (villager and third
   * reach only ~3.2:1 on their own a12 tint): darker text variants, the locked colours untouched.
   */
  villagerText: '#0F6E34',
  thirdText: '#7F5605',

  overlay: 'rgba(26, 49, 73, 0.6)',
  overlayLight: 'rgba(26, 49, 73, 0.25)',
} as const;

/** Illustration palette for the animated DrawGuess gifts, not UI status colors. */
export const reactionArtColors = {
  tomato: '#DC3C32',
  tomatoLight: '#F35443',
  tomatoHighlight: '#FFB19A',
  tomatoStain: '#E34432',
  tomatoSplatLight: '#F36949',
  leaf: '#30844A',
  stem: '#246A3D',
  flowerStem: '#328657',
  flowerLeaf: '#47A56B',
  petal: '#DF547D',
  petalLight: '#F394AD',
  petalParticle: '#DA4D7B',
  petalParticleLight: '#EE8CAD',
  pollen: '#F8CC55',
  pollenHighlight: '#FFE8A3',
  shell: '#E9D8B7',
  shellLight: '#FFF3DA',
  shellHighlight: '#FFFDF5',
  shellParticle: '#EAD6B0',
  white: '#FFF8DF',
  yolk: '#F5AD22',
  yolkLight: '#FFD96A',
  yolkParticle: '#F5B52F',
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
  ['primary', 6],
  ['primary', 8],
  ['primary', 10],
  ['primary', 12],
  ['primary', 15],
  ['primary', 25],
  ['primary', 40],
  ['primary', 55],
  ['primaryDark', 40],
  ['primaryDark', 50],
  ['error', 10],
  ['error', 13],
  ['error', 15],
  ['error', 20],
  ['error', 40],
  ['error', 50],
  ['warning', 13],
  ['warning', 30],
  ['warning', 40],
  ['warning', 50],
  ['success', 40],
  ['info', 8],
  ['background', 85],
  ['text', 3],
  ['textInverse', 20],
  ['textInverse', 65],
  ['textMuted', 30],
  ...(
    ['info', 'success', 'error', 'warning', 'primaryLight', 'textSecondary', 'textMuted'] as const
  ).map((token) => [token, 12] as const),
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
