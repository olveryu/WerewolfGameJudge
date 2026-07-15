import { StyleSheet } from 'react-native';

import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  spacing,
  typography,
  withAlpha,
} from '@/theme';

export const fibConfigStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.large,
    paddingBottom: spacing.xxlarge,
  },
  sectionLabel: {
    fontSize: typography.caption,
    lineHeight: typography.caption * 1.4,
    fontWeight: typography.weights.bold,
    color: colors.textMuted,
    marginBottom: spacing.small,
  },
  title: {
    fontSize: typography.title,
    lineHeight: typography.title * 1.35,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  description: {
    marginTop: spacing.small,
    fontSize: typography.body,
    lineHeight: typography.body * 1.55,
    color: colors.textSecondary,
  },
  controlPanel: {
    marginTop: spacing.large,
    padding: spacing.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.small,
    backgroundColor: colors.surface,
  },
  controlLabel: {
    fontSize: typography.secondary,
    lineHeight: typography.secondary * 1.4,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
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
  bottomBar: {
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.small,
    backgroundColor: withAlpha(colors.surface, 0.98),
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.border,
  },
  submitButton: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
});
