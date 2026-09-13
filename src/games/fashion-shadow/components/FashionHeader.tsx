/** FashionHeader — game-local navigation chrome; does not alter the global header theme. */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { componentSizes, fixed, spacing, typography } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';

interface FashionHeaderProps {
  readonly title: string;
  readonly topInset: number;
  readonly onBack: () => void;
  readonly right?: React.ReactNode;
}

export const FashionHeader: React.FC<FashionHeaderProps> = ({ title, topInset, onBack, right }) => (
  <View style={[styles.header, { paddingTop: topInset }]}>
    <PressableScale onPress={onBack} style={styles.side} accessibilityLabel="返回">
      <Ionicons
        name="chevron-back"
        size={componentSizes.icon.lg}
        color={fashionShadowColors.text}
      />
    </PressableScale>
    <Text numberOfLines={1} style={styles.title}>
      {title}
    </Text>
    <View style={styles.side}>{right}</View>
  </View>
);

const styles = StyleSheet.create({
  header: {
    minHeight: componentSizes.header,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: fashionShadowColors.border,
    backgroundColor: fashionShadowColors.surfaceMuted,
    paddingHorizontal: spacing.small,
  },
  side: {
    minWidth: componentSizes.header,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: fashionShadowColors.text,
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
});
