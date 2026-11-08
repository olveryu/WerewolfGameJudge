/**
 * Pictionary task heading: eyebrow and title.
 *
 * Pictionary-owned presentation moved out of PictionaryTaskFrame when
 * the frame skeleton moved to the shared RoomTaskFrame. The countdown
 * lives in the shared answering top bar now, so this heading carries no
 * timer.
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { roomSurfaceStyles } from '@/features/room/components/RoomSurface.styles';
import { colors, fixed, spacing, textStyles } from '@/theme';

interface PictionaryTaskHeadingProps {
  readonly eyebrow: string;
  readonly title: string;
}

/** Task heading without a timer; the top bar owns the countdown. */
export const PictionaryTaskHeading: React.FC<PictionaryTaskHeadingProps> = ({ eyebrow, title }) => {
  return (
    <View style={styles.heading}>
      <View style={styles.headingCopy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    minHeight: fixed.minTouchTarget,
  },
  headingCopy: { flex: 1, minWidth: 0 },
  eyebrow: { ...textStyles.caption, color: colors.textSecondary },
  title: roomSurfaceStyles.title,
});
