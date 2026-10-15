/** Shared stage frame: width-limited column, header pinned above the scrolling content. */

import type { ReactNode } from 'react';
import { ScrollView, type ScrollViewProps, StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

/** Phone-width cap for stage content, matching the product's phone-sized stage. */
export const STAGE_FRAME_MAX_WIDTH = 430;

interface StageFrameProps {
  /** Header rendered above the scroll area; it stays pinned while content scrolls. */
  readonly header: ReactNode;
  readonly children: ReactNode;
  /** Applied to the width-limited column so page objects can scope to the whole stage. */
  readonly testID?: string;
  readonly showsVerticalScrollIndicator?: boolean;
  readonly keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
}

/**
 * One stage skeleton for seatless stage games: the header (phase label and
 * countdown supplied by the game) never scrolls away; only the content below
 * it scrolls. Games keep their own header and countdown presentation.
 */
export function StageFrame({
  header,
  children,
  testID,
  showsVerticalScrollIndicator = true,
  keyboardShouldPersistTaps,
}: StageFrameProps) {
  return (
    <View style={styles.outer}>
      <View style={styles.inner} testID={testID}>
        {header}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: STAGE_FRAME_MAX_WIDTH,
    paddingHorizontal: spacing.screenH,
    paddingVertical: spacing.small,
    gap: spacing.small,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    gap: spacing.small,
    paddingBottom: spacing.medium,
  },
});
