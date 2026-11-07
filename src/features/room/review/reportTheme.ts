/**
 * Report theme — the one visual language of every game's review page.
 *
 * Promoted from the werewolf night report (its white "verdict ticket"):
 * flat colors only, because the mini-program capture stitches bands and a
 * gradient would seam. Each semantic tone resolves to exactly one running
 * text color, one swatch (medal / tag) and one accent (rails, dots, stamp
 * borders); the maps are total over `ReviewTone`, so a new tone fails
 * typecheck until it has every color.
 */

import { SEGMENTED_CAPTURE_BAND_HEIGHT_PX } from '@/features/room/services/captureViewSegmentedPngBase64';
import { colors, REPORT_COLORS } from '@/theme';

import type { ReviewTone } from './types';

/** Page surface slots. */
export const REPORT_PALETTE = {
  background: REPORT_COLORS.background,
  cardBorder: REPORT_COLORS.cardBorder,
  divider: REPORT_COLORS.divider,
  text: REPORT_COLORS.text,
  textSecondary: REPORT_COLORS.textSecondary,
  textMuted: REPORT_COLORS.textMuted,
  textFaint: REPORT_COLORS.textFaint,
  danger: REPORT_COLORS.danger,
  /** Top accent bar. */
  accent: colors.primary,
} as const;

interface ReportSwatch {
  readonly bg: string;
  readonly border: string;
  readonly text: string;
}

/** Medal and tag swatches: tinted fill, border, numeral/label color. */
export const REPORT_SWATCHES: Readonly<Record<ReviewTone, ReportSwatch>> = {
  neutral: {
    bg: REPORT_COLORS.neutralMedalBg,
    border: REPORT_COLORS.neutralMedalBorder,
    text: REPORT_COLORS.text,
  },
  good: {
    bg: REPORT_COLORS.goodMedalBg,
    border: REPORT_COLORS.goodMedalBorder,
    text: REPORT_COLORS.goodMedalText,
  },
  evil: {
    bg: REPORT_COLORS.evilMedalBg,
    border: REPORT_COLORS.evilMedalBorder,
    text: REPORT_COLORS.evilMedalText,
  },
  special: {
    bg: REPORT_COLORS.specialMedalBg,
    border: REPORT_COLORS.specialMedalBorder,
    text: REPORT_COLORS.specialMedalText,
  },
  highlight: {
    bg: REPORT_COLORS.highlightMedalBg,
    border: REPORT_COLORS.highlightMedalBorder,
    text: REPORT_COLORS.highlightMedalText,
  },
  out: {
    bg: REPORT_COLORS.outMedalBg,
    border: REPORT_COLORS.outMedalBorder,
    text: REPORT_COLORS.danger,
  },
  muted: {
    bg: REPORT_COLORS.neutralMedalBg,
    border: REPORT_COLORS.neutralMedalBorder,
    text: REPORT_COLORS.textMuted,
  },
};

/** Running-text color per tone: the app's faction hues, the report's own neutrals. */
export const REPORT_TEXT_COLORS: Readonly<Record<ReviewTone, string>> = {
  neutral: REPORT_COLORS.text,
  good: colors.villager,
  evil: colors.wolf,
  special: colors.god,
  highlight: colors.third,
  out: REPORT_COLORS.danger,
  muted: REPORT_COLORS.textMuted,
};

/** Accent per tone: group rails, filled timeline dots, stamp borders and filled stamp medals. */
export const REPORT_ACCENT_COLORS: Readonly<Record<ReviewTone, string>> = {
  neutral: REPORT_COLORS.textMuted,
  good: REPORT_COLORS.goodMedalText,
  evil: REPORT_COLORS.evilMedalText,
  special: REPORT_COLORS.specialMedalText,
  highlight: colors.third,
  out: REPORT_COLORS.danger,
  muted: REPORT_COLORS.textFaint,
};

/** Seat medal diameters by slot. */
export const REPORT_MEDAL_SIZES = {
  stamp: 44,
  roster: 26,
  inline: 22,
} as const;

export type ReportMedalSize = keyof typeof REPORT_MEDAL_SIZES;

/**
 * Tallest page the export accepts, in logical pixels. A game splits long
 * content into pages by meaning (one album per page); a page beyond this
 * is a document construction error, not something the export slices.
 */
export const REVIEW_PAGE_MAX_HEIGHT = SEGMENTED_CAPTURE_BAND_HEIGHT_PX * 8;
