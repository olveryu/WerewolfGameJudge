/**
 * Shared non-scrolling task frame for games with a keyboard input.
 *
 * Moved out of PictionaryTaskFrame: the heading stays pinned, the body
 * shrinks to the space left above the keyboard, and the footer stays
 * pinned at the bottom. The frame itself adds no scrolling container,
 * so focusing the input never pulls the task content down; game-owned
 * body content may still scroll internally (for example, StoryRelay's
 * previous-entry area). The keyboard inset itself is handled by
 * RoomTaskViewport; this frame only owns the shrink discipline. Timer
 * and heading rendering stay with each game and arrive through the
 * header slot.
 */

import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { spacing } from '@/theme';

import { RoomTaskViewport } from './RoomTaskViewport';

interface RoomTaskFrameProps {
  /** Pinned heading supplied by the game (title, timer, countdown). */
  readonly header: ReactNode;
  /** Shrinking body: task content that yields space to the keyboard first. */
  readonly children: ReactNode;
  /** Pinned footer supplied by the game (actions, composer). Null omits it. */
  readonly footer: ReactNode;
  /** Width cap declared by the game; each game keeps its current cap. */
  readonly maxWidth: number;
  readonly testID?: string;
  /**
   * Geometry-only override for the task container (for example a wider
   * horizontal padding a game already ships with). Layout discipline
   * (flex body, pinned footer) is not overridable.
   */
  readonly containerStyle?: StyleProp<ViewStyle>;
  /** Geometry-only override for the footer wrapper (for example a border). */
  readonly footerStyle?: StyleProp<ViewStyle>;
}

/**
 * Renders a keyboard-safe task column: header, shrinking body, footer.
 * @pre Callers keep every keyboard input in the body or footer, never
 * inside a scrolling container.
 */
export function RoomTaskFrame({
  header,
  children,
  footer,
  maxWidth,
  testID,
  containerStyle,
  footerStyle,
}: RoomTaskFrameProps) {
  return (
    <RoomTaskViewport>
      <View style={[styles.task, { maxWidth }, containerStyle]} testID={testID}>
        {header}
        <View style={styles.body}>{children}</View>
        {footer !== null && footer !== undefined ? (
          <View style={[styles.footer, footerStyle]}>{footer}</View>
        ) : null}
      </View>
    </RoomTaskViewport>
  );
}

const styles = StyleSheet.create({
  task: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'center',
    padding: spacing.small,
    gap: spacing.small,
  },
  body: {
    flex: 1,
    minHeight: 0,
    gap: spacing.small,
  },
  footer: {
    flexShrink: 0,
    gap: spacing.tight,
  },
});
