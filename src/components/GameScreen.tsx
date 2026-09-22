/** Shared game-page layout and typography; callers own navigation, state and commands. */
import type { ComponentProps, ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/theme';
import { fixed } from '@/theme/tokens';

const GAME_CONTENT_WIDTH = 720;
const GAME_CATALOG_WIDTH = 1040;

/** Bounds page height while leaving game-owned controls and overlays in explicit slots. */
export function GameScreen({
  header,
  children,
  footer,
  overlays,
  testID,
}: {
  readonly header: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly overlays?: ReactNode;
  readonly testID?: string;
}) {
  return (
    <SafeAreaView style={gameScreenStyles.screen} edges={['left', 'right']} testID={testID}>
      {header}
      {children}
      {footer}
      {overlays}
    </SafeAreaView>
  );
}

/** Provides one scrolling content region for forms and reading pages. */
export function GameScreenContent({
  children,
  contentContainerStyle,
  style,
  ...props
}: ComponentProps<typeof ScrollView>) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...props}
      style={[gameScreenStyles.scroll, style]}
      contentContainerStyle={[
        gameScreenStyles.content,
        { paddingBottom: spacing.xxlarge + insets.bottom },
        contentContainerStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
}

/** Keeps primary actions aligned with content and clear of the device safe area. */
export function GameScreenFooter({ children }: { readonly children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[gameScreenStyles.footer, { paddingBottom: Math.max(spacing.small, insets.bottom) }]}
    >
      <View style={gameScreenStyles.footerContent}>{children}</View>
    </View>
  );
}

export const gameScreenStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: GAME_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.large,
    paddingBottom: spacing.xxlarge,
  },
  catalog: { flex: 1, width: '100%', maxWidth: GAME_CATALOG_WIDTH, alignSelf: 'center' },
  footer: {
    paddingTop: spacing.small,
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerContent: {
    width: '100%',
    maxWidth: GAME_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: spacing.screenH,
  },
  kicker: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  title: {
    marginTop: spacing.small,
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  description: {
    marginTop: spacing.small,
    fontSize: typography.body,
    lineHeight: typography.body * 1.65,
    color: colors.textSecondary,
  },
  section: {
    marginTop: spacing.large,
    paddingTop: spacing.medium,
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.borderLight,
    gap: spacing.small,
  },
  sectionTitle: {
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
});
