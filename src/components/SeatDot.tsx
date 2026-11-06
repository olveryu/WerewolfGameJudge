/**
 * SeatDot - Circular seat-number marker shared by the record/review surfaces
 * (Avalon history, sheriff election panel, night review modal).
 *
 * `seat` is 0-based; the dot renders `seat + 1`. Base look: avatar.xs circle
 * on colors.background with a border and bold caption text. `size="sm"`
 * shrinks to badge.md with captionSmall text. `emphasis` covers the two
 * enlarged variants: `leader` (avatar.sm, primary ring + tint fill, flag
 * marker at the top-right corner) and `filled` (avatar.sm, primary fill,
 * inverse text). When `emphasis` is not `none`, the variant fixes the size
 * at avatar.sm and `size` is ignored. `withdrawn` dims the whole dot and
 * strikes the number through. The accessibility label is `N号`, extended with
 * `，<stateLabel>` when the caller passes a state word — the word itself is
 * each surface's own vocabulary (组队者 / 已退水） and stays with the caller.
 * Pure presentation component; does not import service, contains no business
 * logic.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  spacing,
  textStyles,
  typography,
  withAlpha,
} from '@/theme';

type SeatDotSize = 'md' | 'sm';
type SeatDotEmphasis = 'none' | 'leader' | 'filled';

interface SeatDotProps {
  /** 0-based seat index; the dot renders seat + 1. */
  readonly seat: number;
  /** md = avatar.xs (default), sm = badge.md. Ignored when emphasis is set. */
  readonly size?: SeatDotSize;
  /** Enlarged variants; a non-none emphasis fixes the size at avatar.sm. */
  readonly emphasis?: SeatDotEmphasis;
  /** Dims the dot and strikes the number through (withdrawn candidate). */
  readonly withdrawn?: boolean;
  /** Caller-owned state word appended to the accessibility label. */
  readonly stateLabel?: string;
  readonly testID?: string;
}

export const SeatDot = memo<SeatDotProps>(
  ({ seat, size = 'md', emphasis = 'none', withdrawn = false, stateLabel, testID }) => {
    const isSmall = emphasis === 'none' && size === 'sm';
    return (
      <View
        style={[
          styles.dot,
          isSmall ? styles.dotSmall : null,
          emphasis === 'leader' ? styles.dotLeader : null,
          emphasis === 'filled' ? styles.dotFilled : null,
          withdrawn ? styles.dotWithdrawn : null,
        ]}
        testID={testID}
        accessibilityLabel={stateLabel ? `${seat + 1}号，${stateLabel}` : `${seat + 1}号`}
      >
        <Text
          style={[
            styles.text,
            isSmall ? styles.textSmall : null,
            emphasis === 'leader' ? styles.textLeader : null,
            emphasis === 'filled' ? styles.textFilled : null,
            withdrawn ? styles.textWithdrawn : null,
          ]}
        >
          {seat + 1}
        </Text>
        {emphasis === 'leader' ? (
          <View style={styles.leaderMarker}>
            <Ionicons name="flag" size={componentSizes.icon.xs} color={colors.warning} />
          </View>
        ) : null}
      </View>
    );
  },
);

SeatDot.displayName = 'SeatDot';

const styles = StyleSheet.create({
  dot: {
    width: componentSizes.avatar.xs,
    height: componentSizes.avatar.xs,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dotSmall: {
    width: componentSizes.badge.md,
    height: componentSizes.badge.md,
  },
  dotLeader: {
    width: componentSizes.avatar.sm,
    height: componentSizes.avatar.sm,
    borderColor: colors.primary,
    backgroundColor: withAlpha(colors.primary, 0.12),
  },
  dotFilled: {
    width: componentSizes.avatar.sm,
    height: componentSizes.avatar.sm,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  dotWithdrawn: {
    opacity: fixed.disabledOpacity,
  },
  text: {
    ...textStyles.caption,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  textSmall: {
    ...textStyles.captionSmall,
  },
  textLeader: {
    color: colors.primary,
  },
  textFilled: {
    color: colors.textInverse,
  },
  textWithdrawn: {
    textDecorationLine: 'line-through',
  },
  leaderMarker: {
    position: 'absolute',
    top: -spacing.small,
    right: -spacing.tight,
    width: componentSizes.badge.sm,
    height: componentSizes.badge.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
