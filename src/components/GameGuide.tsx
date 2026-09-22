/** Shared reading components for game guides; content and navigation remain game-owned. */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { borderRadius, colors, spacing, typography, withAlpha } from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

import { GameScreen, GameScreenContent, gameScreenStyles } from './GameScreen';
import { ScreenHeader } from './ScreenHeader';

/** Renders a readable guide with the same page frame as game configuration. */
export function GameGuide({
  title,
  heading,
  intro,
  onBack,
  children,
  testID,
}: {
  readonly title: string;
  readonly heading: string;
  readonly intro: string;
  readonly onBack: () => void;
  readonly children: ReactNode;
  readonly testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <GameScreen
      testID={testID}
      header={<ScreenHeader title={title} onBack={onBack} topInset={insets.top} />}
    >
      <GameScreenContent>
        <Text style={gameScreenStyles.kicker}>游戏目标</Text>
        <Text style={gameScreenStyles.title} accessibilityRole="header" aria-level={1}>
          {heading}
        </Text>
        <Text style={gameScreenStyles.description}>{intro}</Text>
        {children}
      </GameScreenContent>
    </GameScreen>
  );
}

/** Groups related rules under a second-level heading. */
export function GameGuideSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <View style={gameScreenStyles.section}>
      <Text style={gameScreenStyles.sectionTitle} accessibilityRole="header" aria-level={2}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Displays one rule using a decorative icon and wrapping text. */
export function RuleItem({
  icon,
  title,
  description,
}: {
  readonly icon: ComponentProps<typeof Ionicons>['name'];
  readonly title: string;
  readonly description: string;
}) {
  return (
    <View style={styles.ruleItem}>
      <View
        style={styles.ruleIcon}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      >
        <Ionicons name={icon} size={componentSizes.icon.sm} color={colors.primary} />
      </View>
      <View style={styles.ruleText}>
        <Text style={styles.ruleTitle}>{title}</Text>
        <Text style={styles.ruleDescription}>{description}</Text>
      </View>
    </View>
  );
}

/** Highlights a public gameplay constraint without an additional card hierarchy. */
export function GameNotice({ text }: { readonly text: string }) {
  return (
    <View style={styles.notice}>
      <Ionicons
        name="information-circle-outline"
        size={componentSizes.icon.sm}
        color={colors.info}
        aria-hidden
      />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.medium,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.borderLight,
  },
  ruleIcon: {
    width: componentSizes.avatar.md,
    height: componentSizes.avatar.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.small,
    backgroundColor: withAlpha(colors.primary, 0.08),
    marginRight: spacing.medium,
  },
  ruleText: { flex: 1, minWidth: 0 },
  ruleTitle: {
    fontSize: typography.body,
    lineHeight: typography.body * 1.45,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  ruleDescription: {
    marginTop: spacing.tight,
    fontSize: typography.secondary,
    lineHeight: typography.secondary * 1.6,
    color: colors.textSecondary,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.xlarge,
    padding: spacing.medium,
    borderRadius: borderRadius.small,
    backgroundColor: withAlpha(colors.info, 0.08),
  },
  noticeText: {
    flex: 1,
    minWidth: 0,
    marginLeft: spacing.small,
    fontSize: typography.secondary,
    lineHeight: typography.secondary * 1.6,
    color: colors.text,
  },
});
