/**
 * ConfigScreen layout / scaffold styles — container, headers, cards, scroll, loading.
 *
 * Used primarily by ConfigScreen.tsx itself.
 */
import type { TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import {
  borderRadius,
  componentSizes,
  createSharedStyles,
  fixed,
  layout,
  shadows,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
} from '@/theme';

export const createConfigLayoutStyles = (colors: ThemeColors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden', // Ensures flex children respect height constraints on web
  } satisfies ViewStyle,

  // ── Header row: ← | 预女猎白▾ 12人 | ⋯ ────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: layout.headerPaddingV,
    backgroundColor: colors.surface,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.border,
  } satisfies ViewStyle,
  headerBtn: {
    ...createSharedStyles(colors).iconButton,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  } satisfies ViewStyle,
  headerBtnText: {
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    color: colors.text,
  } satisfies TextStyle,
  headerCenter: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
    pointerEvents: 'box-none',
  } satisfies ViewStyle,
  headerTitle: {
    fontSize: layout.headerTitleSize,
    lineHeight: layout.headerTitleLineHeight,
    fontWeight: typography.weights.bold,
    color: colors.text,
  } satisfies TextStyle,

  // ── Overflow (⋯) popup menu ──────────────────────
  overflowMenuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  } satisfies ViewStyle,
  overflowMenu: {
    position: 'absolute',
    top: spacing.medium + componentSizes.avatar.md + spacing.tight,
    right: layout.screenPaddingH,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    paddingVertical: spacing.tight,
    ...shadows.md,
    zIndex: 101,
    minWidth: componentSizes.menu.compactMinWidth,
  } satisfies ViewStyle,
  overflowMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small + spacing.tight,
    gap: spacing.small,
  } satisfies ViewStyle,
  overflowMenuItemIcon: {
    width: componentSizes.icon.md,
    textAlign: 'center',
  } satisfies TextStyle,
  overflowMenuItemText: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: colors.text,
    fontWeight: typography.weights.medium,
  } satisfies TextStyle,

  // ── Card A: template + faction tabs (merged card) ──
  cardA: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    marginHorizontal: layout.screenPaddingH,
    marginTop: spacing.small,
    overflow: 'hidden',
    ...shadows.md,
  } satisfies ViewStyle,
  cardADivider: {
    height: fixed.divider,
    backgroundColor: colors.border,
    marginHorizontal: layout.cardPadding,
  } satisfies ViewStyle,

  // ── Template row (inside cardA) ──
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.small + spacing.tight,
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
  } satisfies ViewStyle,
  templatePillText: {
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  } satisfies TextStyle,
  templatePillArrow: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: colors.textSecondary,
    marginLeft: spacing.tight,
  } satisfies TextStyle,
  playerCount: {
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  } satisfies TextStyle,
  clearBtn: {
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
  } satisfies ViewStyle,
  clearBtnText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.error,
  } satisfies TextStyle,

  // ── Bottom create button ────────────────────
  bottomCreateBar: {
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.medium,
    backgroundColor: colors.background,
    ...shadows.lgUpward,
  } satisfies ViewStyle,
  bottomCreateBtn: {
    height: componentSizes.button.lg,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  } satisfies ViewStyle,
  bottomCreateBtnDisabled: {
    opacity: fixed.disabledOpacity,
  } satisfies ViewStyle,
  bottomCreateBtnText: {
    ...textStyles.bodySemibold,
    color: colors.textInverse,
  } satisfies TextStyle,

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
  } satisfies ViewStyle,
  scrollContent: {
    paddingBottom: spacing.large,
  } satisfies ViewStyle,

  // ── Loading ─────────────────────────────────
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  } satisfies ViewStyle,
  loadingText: {
    marginTop: spacing.medium,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  } satisfies TextStyle,
});
