/**
 * AvatarPickerScreen styles
 *
 * Picker-specific styles extracted from SettingsScreenStyles.
 * Created once in parent Screen, passed to all sub-components via props.
 */
import { ImageStyle, StyleSheet, TextStyle, ViewStyle } from 'react-native';

import {
  borderRadius,
  componentSizes,
  fixed,
  layout,
  spacing,
  textStyles,
  ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

export interface AvatarPickerScreenStyles {
  container: ViewStyle;
  header: ViewStyle;
  headerTitle: TextStyle;
  headerSpacer: ViewStyle;
  content: ViewStyle;
  // Picker grid
  pickerGrid: ViewStyle;
  pickerItem: ViewStyle;
  pickerItemImage: ImageStyle;
  pickerItemSelected: ViewStyle;
  pickerCheckBadge: ViewStyle;
  pickerSectionTitle: TextStyle;
  pickerCustomSection: ViewStyle;
  pickerCustomRow: ViewStyle;
  pickerCustomItem: ViewStyle;
  pickerCustomUploadItem: ViewStyle;
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
  // Hero preview area
  heroPreview: ViewStyle;
  heroPreviewLeft: ViewStyle;
  heroPreviewRight: ViewStyle;
  heroFrameLabel: TextStyle;
  heroUploadBtn: ViewStyle;
  // Frame grid
  frameGrid: ViewStyle;
  frameGridCell: ViewStyle;
  frameGridCellSelected: ViewStyle;
  frameGridCellActive: ViewStyle;
  frameGridName: TextStyle;
  frameGridNameSelected: TextStyle;
  frameGridNoFrame: ViewStyle;
  // ReadOnly upgrade card
  pickerUpgradeCard: ViewStyle;
  pickerUpgradeTitle: TextStyle;
  pickerUpgradeBenefits: ViewStyle;
  pickerUpgradeBenefit: TextStyle;
}

export const createAvatarPickerScreenStyles = (colors: ThemeColors): AvatarPickerScreenStyles =>
  StyleSheet.create<AvatarPickerScreenStyles>({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.screenH,
      paddingVertical: layout.headerPaddingV,
      backgroundColor: colors.surface,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      flex: 1,
      fontSize: layout.headerTitleSize,
      lineHeight: layout.headerTitleLineHeight,
      fontWeight: typography.weights.bold,
      color: colors.text,
      textAlign: 'center',
    },
    headerSpacer: {
      width: componentSizes.icon.lg,
    },
    content: {
      flex: 1,
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
    },
    pickerItemImage: {
      width: '100%',
      height: '100%',
      borderRadius: borderRadius.medium - fixed.borderWidthThick,
    },
    pickerItemSelected: {
      borderColor: colors.primary,
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
    pickerSectionTitle: {
      ...textStyles.secondarySemibold,
      color: colors.textSecondary,
      paddingHorizontal: spacing.tight,
      paddingTop: spacing.medium,
      paddingBottom: spacing.tight,
    },
    pickerCustomSection: {
      paddingHorizontal: spacing.tight,
      paddingBottom: spacing.small,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    pickerCustomRow: {
      flexDirection: 'row',
      gap: spacing.small,
    },
    pickerCustomItem: {
      width: componentSizes.avatar.xl,
      height: componentSizes.avatar.xl,
      borderRadius: borderRadius.medium,
      overflow: 'hidden',
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.background,
    },
    pickerCustomUploadItem: {
      width: componentSizes.avatar.xl,
      height: componentSizes.avatar.xl,
      borderRadius: borderRadius.medium,
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.border,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface,
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
      height: fixed.borderWidthThick,
      backgroundColor: colors.primary,
      borderRadius: fixed.borderWidth,
    },
    // Hero preview area
    heroPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.screenH,
      paddingVertical: spacing.small,
      gap: spacing.medium,
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
    // Frame grid
    frameGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.medium,
      gap: spacing.medium,
    },
    frameGridCell: {
      alignItems: 'center',
      padding: spacing.small,
      borderRadius: borderRadius.medium,
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.background,
      overflow: 'visible' as const,
    },
    frameGridCellSelected: {
      borderColor: colors.primary,
      backgroundColor: withAlpha(colors.primary, 0.08),
    },
    frameGridCellActive: {
      borderColor: withAlpha(colors.primary, 0.4),
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
