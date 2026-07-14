/**
 * FactionTabs styles — tab bar, individual tabs, labels, indicator.
 */
import type { TextStyle, ViewStyle } from 'react-native';

import { borderRadius, shadows, spacing, type ThemeColors, typography } from '@/theme';

export const createFactionTabsStyles = (colors: ThemeColors) => ({
  tabBar: {
    flexDirection: 'row',
    gap: spacing.tight,
    padding: spacing.tight,
  } satisfies ViewStyle,
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.small + spacing.tight,
    borderRadius: borderRadius.medium,
    position: 'relative' as const,
  } satisfies ViewStyle,
  tabActive: {
    ...shadows.sm,
  } satisfies ViewStyle,
  tabLabel: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
  } satisfies TextStyle,
  tabLabelActive: {
    fontWeight: typography.weights.bold,
  } satisfies TextStyle,
  tabIndicator: {
    // Hidden in Segmented Control style — active state shown via tabActive bg
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 0,
  } satisfies ViewStyle,
});
