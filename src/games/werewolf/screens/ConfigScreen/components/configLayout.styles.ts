/**
 * ConfigScreen layout / scaffold styles -- header center, cards, scroll.
 *
 * Used primarily by ConfigScreen.tsx itself.
 */
import type { TextStyle, ViewStyle } from 'react-native';

import {
  borderRadius,
  componentSizes,
  fixed,
  layout,
  shadows,
  spacing,
  type ThemeColors,
  typography,
} from '@/theme';

/** Create ConfigScreen layout styles. */
export const createConfigLayoutStyles = (colors: ThemeColors) => ({
  // ── ScreenHeader center: board pill + player count ──
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  } satisfies ViewStyle,
  templatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    paddingHorizontal: componentSizes.chip.paddingH,
    paddingVertical: componentSizes.chip.paddingV,
    ...shadows.sm,
  } satisfies ViewStyle,
  templatePillText: {
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  } satisfies TextStyle,
  playerCount: {
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  } satisfies TextStyle,

  // ── Card A: faction tabs ──
  cardA: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    marginHorizontal: layout.screenPaddingH,
    marginTop: spacing.small,
    overflow: 'hidden',
    ...shadows.md,
  } satisfies ViewStyle,

  // ── Card B: stepper + role sections ──
  cardB: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    marginHorizontal: layout.screenPaddingH,
    marginTop: spacing.medium,
    paddingBottom: spacing.small + spacing.tight,
    ...shadows.md,
  } satisfies ViewStyle,
  cardBDivider: {
    height: fixed.divider,
    backgroundColor: colors.border,
    marginHorizontal: layout.cardPadding,
  } satisfies ViewStyle,
  cardBFooterHint: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.small,
  } satisfies TextStyle,

  // ── Scroll area ─────────────────────────────
  scrollView: {
    flex: 1,
    backgroundColor: colors.transparent,
  } satisfies ViewStyle,
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.large,
  } satisfies ViewStyle,
});
