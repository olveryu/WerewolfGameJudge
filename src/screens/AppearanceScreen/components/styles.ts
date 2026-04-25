/**
 * AppearanceScreen styles
 *
 * Picker-specific styles extracted from SettingsScreenStyles.
 * Created once in parent Screen, passed to all sub-components via props.
 */
import { ImageStyle, StyleSheet, TextStyle, ViewStyle } from 'react-native';

import {
  borderRadius,
  componentSizes,
  fixed,
  shadows,
  spacing,
  textStyles,
  ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

export interface AppearanceScreenStyles {
  container: ViewStyle;
  content: ViewStyle;
  // Picker grid
  pickerGrid: ViewStyle;
  pickerItem: ViewStyle;
  pickerItemImage: ImageStyle;
  pickerItemWolfPawContainer: ViewStyle;
  pickerItemWolfPawIcon: ImageStyle;
  pickerItemSelected: ViewStyle;
  pickerItemLocked: ViewStyle;
  pickerItemLockOverlay: ViewStyle;
  pickerCheckBadge: ViewStyle;
  pickerPreviewOverlay: ViewStyle;
  pickerPreviewImage: ImageStyle;
  pickerFooter: ViewStyle;
  // Tab bar
  pickerTabBar: ViewStyle;
  pickerTab: ViewStyle;
  pickerTabActive: ViewStyle;
  pickerTabText: TextStyle;
  pickerTabTextActive: TextStyle;
  pickerTabIndicator: ViewStyle;
  // Rarity sub-tab bar
  rarityTabBar: ViewStyle;
  rarityTab: ViewStyle;
  rarityTabText: TextStyle;
  rarityTabTextActive: TextStyle;
  // Hero preview area
  heroPreview: ViewStyle;
  heroPreviewLeft: ViewStyle;
  heroPreviewRight: ViewStyle;
  heroFrameLabel: TextStyle;
  heroUploadBtn: ViewStyle;
  nameStyleHeroName: TextStyle;
  // Frame grid
  frameGridContent: ViewStyle;
  frameColumnWrapper: ViewStyle;
  frameGridCell: ViewStyle;
  frameGridCellSelected: ViewStyle;
  frameGridCellActive: ViewStyle;
  frameGridCellLocked: ViewStyle;
  frameGridName: TextStyle;
  frameGridNameSelected: TextStyle;
  frameGridNoFrame: ViewStyle;
  flairPreviewCell: ViewStyle;
  nameStylePreviewCell: ViewStyle;
  nameStylePreviewText: TextStyle;
  effectPreviewCell: ViewStyle;
  // Effect Hero area
  effectHeroIcon: ViewStyle;
  effectHeroName: TextStyle;
  effectHeroDesc: TextStyle;
  effectHeroRarity: TextStyle;
  effectHeroActions: ViewStyle;
  // ReadOnly upgrade card
  pickerUpgradeCard: ViewStyle;
  pickerUpgradeTitle: TextStyle;
  pickerUpgradeBenefits: ViewStyle;
  pickerUpgradeBenefit: TextStyle;
}

const HERO_ICON_SIZE = 72;

export const createAppearanceScreenStyles = (colors: ThemeColors): AppearanceScreenStyles =>
  StyleSheet.create<AppearanceScreenStyles>({
    container: {
      flex: 1,
      backgroundColor: colors.transparent,
      overflow: 'hidden',
    },
    content: {
      flex: 1,
      backgroundColor: colors.transparent,
    },
    // Picker grid
    pickerGrid: {
      paddingHorizontal: spacing.medium,
      paddingTop: spacing.medium,
    },
    pickerItem: {
      flex: 1,
      aspectRatio: 1,
      margin: spacing.tight,
      borderRadius: borderRadius.medium,
      overflow: 'hidden',
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.background,
      ...shadows.sm,
    },
    pickerItemImage: {
      width: '100%',
      height: '100%',
      borderRadius: borderRadius.medium - fixed.borderWidthThick,
    },
    pickerItemWolfPawContainer: {
      width: '100%',
      height: '100%',
      borderRadius: borderRadius.medium - fixed.borderWidthThick,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickerItemWolfPawIcon: {
      width: '70%',
      height: '70%',
    },
    pickerItemSelected: {
      borderColor: colors.primary,
    },
    pickerItemLocked: {
      opacity: 0.4,
      // Remove shadow from locked items
      boxShadow: 'none',
    },
    pickerItemLockOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: withAlpha(colors.background, 0.4),
      borderRadius: borderRadius.medium - fixed.borderWidthThick,
    },
    pickerCheckBadge: {
      position: 'absolute',
      bottom: spacing.micro,
      right: spacing.micro,
      width: componentSizes.icon.md,
      height: componentSizes.icon.md,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pickerPreviewOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pickerPreviewImage: {
      width: 200,
      height: 200,
      borderRadius: borderRadius.medium,
    },
    pickerFooter: {
      paddingHorizontal: spacing.screenH,
      paddingVertical: spacing.medium,
      borderTopWidth: fixed.borderWidth,
      borderTopColor: colors.border,
    },
    // Tab bar
    pickerTabBar: {
      flexDirection: 'row',
      paddingHorizontal: spacing.screenH,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    pickerTab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.small,
    },
    pickerTabActive: {
      // active state — no background, uses indicator
    },
    pickerTabText: {
      ...textStyles.bodyMedium,
      color: colors.textSecondary,
    },
    pickerTabTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    pickerTabIndicator: {
      position: 'absolute',
      bottom: 0,
      left: spacing.medium,
      right: spacing.medium,
      height: fixed.borderWidthHighlight,
      backgroundColor: colors.primary,
      borderTopLeftRadius: borderRadius.small,
      borderTopRightRadius: borderRadius.small,
    },
    // Rarity sub-tab bar
    rarityTabBar: {
      flexDirection: 'row',
      paddingHorizontal: spacing.screenH,
      paddingVertical: spacing.small,
      gap: spacing.tight,
    },
    rarityTab: {
      paddingVertical: spacing.tight,
      paddingHorizontal: spacing.small,
      borderRadius: borderRadius.full,
    },
    rarityTabText: {
      ...textStyles.caption,
      fontWeight: typography.weights.medium,
      color: colors.textMuted,
    },
    rarityTabTextActive: {
      color: colors.textInverse,
      fontWeight: typography.weights.semibold,
    },
    // Hero preview area
    heroPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.screenH,
      paddingVertical: spacing.medium,
      marginHorizontal: spacing.screenH,
      marginBottom: spacing.small,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      gap: spacing.medium,
      ...shadows.sm,
    },
    heroPreviewLeft: {
      alignItems: 'center',
      overflow: 'visible' as const,
    },
    heroPreviewRight: {
      flex: 1,
      gap: spacing.tight,
    },
    heroFrameLabel: {
      ...textStyles.caption,
      color: colors.textSecondary,
    },
    heroUploadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
      marginTop: spacing.small,
    },
    nameStyleHeroName: {
      ...textStyles.bodyMedium,
      fontWeight: typography.weights.semibold,
      marginTop: spacing.tight,
      textAlign: 'center' as const,
    },
    // Frame grid (FlatList-managed columns)
    frameGridContent: {
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.medium,
    },
    frameColumnWrapper: {
      justifyContent: 'flex-start',
    },
    frameGridCell: {
      width: `${100 / 3}%`,
      alignItems: 'center',
      padding: spacing.small,
      paddingHorizontal: spacing.small + spacing.tight,
      marginBottom: spacing.medium,
      borderRadius: borderRadius.medium,
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.background,
      overflow: 'visible' as const,
      ...shadows.sm,
    },
    frameGridCellSelected: {
      borderColor: colors.primary,
      backgroundColor: withAlpha(colors.primary, 0.08),
    },
    frameGridCellActive: {
      borderColor: withAlpha(colors.primary, 0.4),
    },
    frameGridCellLocked: {
      opacity: 0.4,
    },
    frameGridName: {
      ...textStyles.caption,
      color: colors.textSecondary,
      marginTop: spacing.tight,
      textAlign: 'center',
    },
    frameGridNameSelected: {
      color: colors.primary,
      fontWeight: typography.weights.medium,
    },
    frameGridNoFrame: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    flairPreviewCell: {
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'visible' as const,
    },
    nameStylePreviewCell: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.medium,
    },
    nameStylePreviewText: {
      fontSize: typography.caption,
      fontWeight: typography.weights.medium,
    },
    effectPreviewCell: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Effect Hero area
    effectHeroIcon: {
      width: HERO_ICON_SIZE,
      height: HERO_ICON_SIZE,
      borderRadius: borderRadius.large,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    effectHeroName: {
      ...textStyles.bodyMedium,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    effectHeroDesc: {
      ...textStyles.caption,
      color: colors.textSecondary,
    },
    effectHeroRarity: {
      ...textStyles.caption,
      fontWeight: typography.weights.semibold,
    },
    effectHeroActions: {
      flexDirection: 'row',
      gap: spacing.small,
      marginTop: spacing.tight,
    },
    // ReadOnly upgrade card
    pickerUpgradeCard: {
      marginTop: spacing.medium,
      paddingVertical: spacing.medium,
      paddingHorizontal: spacing.medium,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      gap: spacing.small,
    },
    pickerUpgradeTitle: {
      ...textStyles.secondarySemibold,
      color: colors.text,
    },
    pickerUpgradeBenefits: {
      gap: spacing.tight,
    },
    pickerUpgradeBenefit: {
      ...textStyles.caption,
      color: colors.textSecondary,
    },
  });
