/**
 * MessageBubble - 单条聊天消息气泡
 *
 * 用户消息右对齐蓝色，AI 消息左对齐灰色。
 * Streaming 时在文本末尾显示闪烁光标 ▊。
 *
 * ✅ 允许：渲染消息、光标动画
 * ❌ 禁止：直接调用 service
 */

import React, { memo, useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

import { spacing, type ThemeColors } from '@/theme';

import type { DisplayMessage } from './AIChatBubble.styles';
import { SimpleMarkdown } from './SimpleMarkdown';

// ── Types ────────────────────────────────────────────────

interface MessageBubbleProps {
  message: DisplayMessage;
  colors: ThemeColors;
  bubbleStyle: object;
  textStyle: object;
  /** 是否正在 streaming（显示闪烁光标） */
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

  return (
    <Animated.Text style={[localStyles.cursor, { opacity, color }]}>
      ▊
    </Animated.Text>
  );
}

// ── Component ────────────────────────────────────────────

export const MessageBubble = memo(function MessageBubble({
  message,
  colors,
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
    marginTop: 2,
  },
  cursor: {
    fontSize: 14,
    marginLeft: 1,
  },
});
