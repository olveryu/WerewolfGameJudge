/** Viewport-bounded task layout; media fits available space without cropping or page scrolling. */

import { CountdownPill } from '@/features/room/components/CountdownPill';
import type React from 'react';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { roomSurfaceStyles } from '@/features/room/components/RoomSurface.styles';
import { RoomTaskViewport } from '@/features/room/components/RoomTaskViewport';
import { TESTIDS } from '@/testids';
import { colors, fixed, spacing, textStyles } from '@/theme';
import { componentSizes } from '@/theme/tokens';

import { PICTIONARY_STAGE_MAX_WIDTH } from './PictionaryStageFrame';

interface PictionaryTaskFrameProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly remainingSeconds: number | null;
  readonly children: React.ReactNode;
  readonly footer: React.ReactNode;
}

/** Keep the task timer and completion controls visible, including above the web keyboard. */
export function PictionaryTaskFrame({
  eyebrow,
  title,
  remainingSeconds,
  children,
  footer,
}: PictionaryTaskFrameProps) {
  return (
    <RoomTaskViewport>
      <View style={styles.task} testID={TESTIDS.pictionaryStageFrame}>
        <View style={styles.heading}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
          </View>
          <CountdownPill remainingSeconds={remainingSeconds} zeroLabel="收稿中" />
        </View>
        <View style={styles.body}>{children}</View>
        <View style={styles.footer}>{footer}</View>
      </View>
    </RoomTaskViewport>
  );
}

/** Fit a canonical 4:3 drawing into the remaining task area. */
export function PictionaryTaskMedia({ children }: { readonly children: React.ReactNode }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const width = Math.min(size.width, (size.height * 4) / 3);
  return (
    <View
      style={styles.media}
      onLayout={({ nativeEvent }) =>
        setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height })
      }
    >
      <View style={{ width, height: (width * 3) / 4 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  task: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: PICTIONARY_STAGE_MAX_WIDTH,
    alignSelf: 'center',
    padding: spacing.small,
    gap: spacing.small,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    minHeight: fixed.minTouchTarget,
  },
  headingCopy: { flex: 1, minWidth: 0 },
  eyebrow: { ...textStyles.caption, color: colors.textSecondary },
  title: roomSurfaceStyles.title,
  body: { flex: 1, minHeight: 0, gap: spacing.small },
  footer: {
    flexShrink: 0,
    gap: spacing.tight,
    paddingTop: spacing.small,
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.border,
  },
  media: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
