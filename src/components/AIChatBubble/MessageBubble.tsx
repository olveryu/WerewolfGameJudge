/**
 * MessageBubble - Single chat message bubble
 *
 * User messages are right-aligned and blue; AI messages are left-aligned and grey.
 * While streaming, shows a blinking cursor ▊ at end of text.
 * Renders message bubble + cursor animation. Does not call services directly.
 */

import { memo, useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

import { colors, spacing, type ThemeColors, typography } from '@/theme';

import type { DisplayMessage } from './AIChatBubble.styles';
import { SimpleMarkdown } from './SimpleMarkdown';

// ── Types ────────────────────────────────────────────────

interface MessageBubbleProps {
  message: DisplayMessage;
  colors: ThemeColors;
  bubbleStyle: object;
  textStyle: object;
  /** Whether currently streaming (shows blinking cursor) */
  isStreaming?: boolean;
}

// ── Blinking cursor ──────────────────────────────────────

function BlinkingCursor({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return <Animated.Text style={[localStyles.cursor, { opacity, color }]}>▊</Animated.Text>;
}

// ── Component ────────────────────────────────────────────

export const MessageBubble = memo(function MessageBubble({
  message,
  bubbleStyle,
  textStyle,
  isStreaming = false,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <View style={[localStyles.row, isUser && localStyles.rowUser]}>
      <View style={bubbleStyle}>
        {isUser ? (
          <Text style={textStyle}>{message.content}</Text>
        ) : (
          <View style={localStyles.assistantContent}>
            <SimpleMarkdown content={message.content} colors={colors} />
            {isStreaming && (
              <View style={localStyles.cursorRow}>
                <BlinkingCursor color={colors.textMuted} />
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
});

// ── Styles ───────────────────────────────────────────────

const localStyles = StyleSheet.create({
  row: {
    marginBottom: spacing.tight,
    flexDirection: 'row',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  assistantContent: {
    flex: 1,
  },
  cursorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.micro,
  },
  cursor: {
    fontSize: typography.secondary,
    marginLeft: 1,
  },
});
