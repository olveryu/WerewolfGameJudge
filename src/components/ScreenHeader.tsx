/**
 * ScreenHeader — Generic screen header component.
 *
 * Uses absoluteFill centering (same as RoomScreen) so the title is always centered
 * regardless of left/right button width differences. Left side defaults to a back button.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors } from '@/theme';
import { componentSizes, fixed, layout, spacing, typography } from '@/theme/tokens';

import { Button } from './Button';

interface ScreenHeaderProps {
  /** Header title text. */
  title: string;
  /** Back button callback. */
  onBack: () => void;
  /** Custom right-side content. */
  headerRight?: React.ReactNode;
  /** Safe area top inset (insets.top). */
  topInset: number;
  /** Back button testID. */
  backTestID?: string;
  /** Back button accessibilityLabel. */
  backAccessibilityLabel?: string;
  /** Additional style for the header container. */
  style?: ViewStyle;
}

export const ScreenHeader = memo<ScreenHeaderProps>(function ScreenHeader({
  title,
  onBack,
  headerRight,
  topInset,
  backTestID,
  backAccessibilityLabel = '返回',
  style,
}) {
  return (
    <View style={[styles.header, { paddingTop: topInset + layout.headerPaddingV }, style]}>
      <View style={styles.sideContainer}>
        <Button
          variant="icon"
          onPress={onBack}
          testID={backTestID}
          accessibilityLabel={backAccessibilityLabel}
        >
          <Ionicons name="chevron-back" size={componentSizes.icon.lg} color={colors.text} />
        </Button>
      </View>
      <View style={styles.centerContainer}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.sideContainer}>{headerRight}</View>
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenH,
    paddingVertical: layout.headerPaddingV,
    backgroundColor: colors.surface,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.border,
    overflow: 'hidden',
  },
  sideContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  centerContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  title: {
    fontSize: layout.headerTitleSize,
    lineHeight: layout.headerTitleLineHeight,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
});
