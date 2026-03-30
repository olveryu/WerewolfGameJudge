/**
 * sharedStyles — Cross-screen reusable style bases
 *
 * Provides token-based style fragments shared across multiple screens.
 * Each consumer spreads the base and overrides only what differs.
 * Does not create StyleSheets — consumers do that in their own factories.
 *
 * Presets are organised into:
 * - Layout   — screenContainer
 * - Card     — cardBase, cardElevated
 * - Button   — primaryButton/Text, secondaryButton/Text, dangerButton/Text
 * - Input    — inputBase
 * - Modal    — modalOverlay, modalBase
 * - Sheet    — sheetOverlay, sheetBase, sheetHandle
 * - List     — listItem, sectionTitle
 * - Misc     — iconButton (legacy)
 */
import type { TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { type ThemeColors } from './themes';
import { borderRadius } from './tokens';
import { componentSizes, fixed, shadows, spacing, textStyles } from './tokens';

export interface SharedStyles {
  // ── Layout ──────────────────────────────────────────────────────────────
  /** Full-screen root container */
  screenContainer: ViewStyle;

  // ── Card ────────────────────────────────────────────────────────────────
  /** Standard content card: surface + large radius + medium padding + md shadow */
  cardBase: ViewStyle;
  /** Emphasized card: same as cardBase but with lg shadow */
  cardElevated: ViewStyle;

  // ── Input ───────────────────────────────────────────────────────────────
  inputBase: TextStyle;

  // ── Modal ───────────────────────────────────────────────────────────────
  /** Dark overlay for center modals */
  modalOverlay: ViewStyle;
  /** Center modal content box */
  modalBase: ViewStyle;

  // ── Sheet ───────────────────────────────────────────────────────────────
  /** Light overlay for bottom sheets */
  sheetOverlay: ViewStyle;
  /** Bottom sheet content area */
  sheetBase: ViewStyle;
  /** Drag handle bar */
  sheetHandle: ViewStyle;

  // ── List ────────────────────────────────────────────────────────────────
  listItem: ViewStyle;
  sectionTitle: TextStyle;

  // ── Misc ────────────────────────────────────────────────────────────────
  /** Square icon button (avatar.md × avatar.md), rounded-medium, bg = background */
  iconButton: ViewStyle;
}

/**
 * Create shared style bases from the current theme colors.
 *
 * Call inside each `createXxxStyles(colors)` factory, then spread:
 * ```ts
 * const shared = createSharedStyles(colors);
 * // ...
 * heroCard: { ...shared.cardBase, ...shadows.lg },
 * startButton: { ...shared.primaryButton },
 * ```
 */
export function createSharedStyles(colors: ThemeColors): SharedStyles {
  return {
    // ── Layout ────────────────────────────────────────────────────────────
    screenContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // ── Card ──────────────────────────────────────────────────────────────
    cardBase: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      padding: spacing.medium,
      ...shadows.md,
    },
    cardElevated: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      padding: spacing.medium,
      ...shadows.lg,
    },

    // ── Input ─────────────────────────────────────────────────────────────
    inputBase: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.small,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      minHeight: componentSizes.button.md,
      ...textStyles.body,
      color: colors.text,
    },

    // ── Modal ─────────────────────────────────────────────────────────────
    modalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalBase: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xlarge,
      padding: spacing.large,
      ...shadows.lg,
      maxWidth: fixed.maxContentWidth,
      width: '90%',
    },

    // ── Sheet ─────────────────────────────────────────────────────────────
    sheetOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlayLight,
    },
    sheetBase: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.large,
      borderTopRightRadius: borderRadius.large,
      paddingTop: spacing.medium,
      paddingBottom: spacing.large,
      paddingHorizontal: spacing.screenH,
    },
    sheetHandle: {
      width: componentSizes.handle.width,
      height: componentSizes.handle.height,
      borderRadius: borderRadius.full,
      backgroundColor: colors.borderLight,
      alignSelf: 'center',
      marginBottom: spacing.medium,
    },

    // ── List ──────────────────────────────────────────────────────────────
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.medium,
      paddingHorizontal: spacing.medium,
      gap: spacing.small,
    },
    sectionTitle: {
      ...textStyles.subtitleSemibold,
      color: colors.text,
      paddingHorizontal: spacing.screenH,
      paddingTop: spacing.large,
      paddingBottom: spacing.small,
    },

    // ── Misc ──────────────────────────────────────────────────────────────
    iconButton: {
      width: componentSizes.avatar.md,
      height: componentSizes.avatar.md,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
  };
}
