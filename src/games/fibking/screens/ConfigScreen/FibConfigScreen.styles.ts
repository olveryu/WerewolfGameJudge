import { StyleSheet } from 'react-native';

import { borderRadius, colors, spacing, typography, withAlpha } from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

export const fibConfigStyles = StyleSheet.create({
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.medium,
    gap: spacing.small,
  },
  stepButton: {
    flexShrink: 0,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: componentSizes.button.lg,
    paddingHorizontal: spacing.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.small,
    backgroundColor: colors.background,
    textAlign: 'center',
    fontSize: typography.subtitle,
    lineHeight: typography.subtitle * 1.3,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  ruleBand: {
    marginTop: spacing.large,
    paddingVertical: spacing.medium,
    borderTopWidth: fixed.borderWidth,
    borderBottomWidth: fixed.borderWidth,
    borderColor: colors.borderLight,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ruleRowSpaced: {
    marginTop: spacing.medium,
  },
  ruleIcon: {
    width: componentSizes.icon.lg,
    height: componentSizes.icon.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.small,
    backgroundColor: withAlpha(colors.primary, 0.08),
    marginRight: spacing.small,
  },
  ruleText: {
    flex: 1,
    minWidth: 0,
  },
  ruleTitle: {
    fontSize: typography.secondary,
    lineHeight: typography.secondary * 1.4,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  ruleDescription: {
    marginTop: spacing.micro,
    fontSize: typography.caption,
    lineHeight: typography.caption * 1.5,
    color: colors.textSecondary,
  },
});
