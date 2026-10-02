/** Shared public room summary and guide action; no game state or command dependencies. */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, spacing, typography, withAlpha } from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

/** Displays public game information above a game's seats or specialized details. */
export function RoomGameSummary({
  icon,
  title,
  subtitle,
  headerRight,
  children,
  testID,
}: {
  readonly icon: ComponentProps<typeof Ionicons>['name'];
  readonly title: string;
  readonly subtitle: string;
  readonly headerRight?: ReactNode;
  readonly children?: ReactNode;
  readonly testID?: string;
}) {
  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryIdentity}>
          <View style={styles.iconBox} aria-hidden>
            <Ionicons name={icon} size={componentSizes.icon.md} color={colors.primary} />
          </View>
          <View style={styles.summaryText}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>
        {headerRight}
      </View>
      {children}
    </View>
  );
}

/** Text-labelled guide action beside public game information; reports navigation intent only. */
export function RoomGuideButton({
  onPress,
  label,
  testID,
}: {
  readonly onPress: () => void;
  readonly label: string;
  readonly testID?: string;
}) {
  return (
    <TouchableOpacity
      style={styles.guideRow}
      onPress={onPress}
      activeOpacity={fixed.activeOpacity}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <View aria-hidden>
        <Ionicons name="book-outline" size={componentSizes.icon.sm} color={colors.primary} />
      </View>
      <Text style={styles.guideTitle}>玩法</Text>
      <View aria-hidden>
        <Ionicons name="chevron-forward" size={componentSizes.icon.sm} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: componentSizes.button.lg,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.small,
    marginLeft: 'auto',
    maxWidth: '100%',
    flexShrink: 0,
  },
  guideTitle: {
    flexShrink: 1,
    minWidth: 0,
    marginHorizontal: spacing.small,
    color: colors.text,
    fontSize: typography.secondary,
    lineHeight: typography.secondary * 1.4,
    fontWeight: typography.weights.semibold,
  },
  container: {
    marginBottom: spacing.medium,
    paddingBottom: spacing.small,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.borderLight,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.small,
    paddingVertical: spacing.medium,
  },
  summaryIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flexBasis: '60%',
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  iconBox: {
    width: componentSizes.avatar.md,
    height: componentSizes.avatar.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.primary, 0.08),
    borderRadius: componentSizes.avatar.md / 2,
    marginRight: spacing.small,
  },
  summaryText: { flex: 1, minWidth: 0 },
  title: {
    fontSize: typography.body,
    lineHeight: typography.body * 1.35,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  subtitle: {
    marginTop: spacing.micro,
    fontSize: typography.secondary,
    lineHeight: typography.secondary * 1.4,
    color: colors.textSecondary,
  },
});
