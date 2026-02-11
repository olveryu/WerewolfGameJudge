/**
 * MessageBubble - 单条聊天消息气泡
 *
 * 支持长按弹出操作菜单（复制、重新生成）。
 * 用户消息右对齐蓝色，AI 消息左对齐灰色。
 *
 * ✅ 允许：渲染消息、长按菜单、Clipboard
 * ❌ 禁止：直接调用 service
 */

import React, { memo, useCallback, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { borderRadius, shadows, spacing, type ThemeColors, typography } from '@/theme';

import type { DisplayMessage } from './AIChatBubble.styles';
import { SimpleMarkdown } from './SimpleMarkdown';

// ── Types ────────────────────────────────────────────────

interface MessageBubbleProps {
  message: DisplayMessage;
  colors: ThemeColors;
  bubbleStyle: object;
  textStyle: object;
  onRetry?: (messageId: string) => void;
}

// ── Clipboard (lazy-loaded) ──────────────────────────────

let clipboardModule: { setStringAsync?: (s: string) => Promise<void> } | null = null;

async function copyToClipboard(text: string): Promise<boolean> {
  // Web: use navigator.clipboard
  if (Platform.OS === 'web') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  // Native: lazy-load expo-clipboard
  try {
    if (!clipboardModule) {
      clipboardModule = await import('expo-clipboard');
    }
    await clipboardModule.setStringAsync?.(text);
    return true;
  } catch {
    return false;
  }
}

// ── Component ────────────────────────────────────────────

export const MessageBubble = memo(function MessageBubble({
  message,
  colors,
  bubbleStyle,
  textStyle,
  onRetry,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [menuVisible, setMenuVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleLongPress = useCallback(() => {
    setMenuVisible(true);
    setCopied(false);
  }, []);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(message.content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setMenuVisible(false), 600);
    }
  }, [message.content]);

  const handleRetry = useCallback(() => {
    setMenuVisible(false);
    onRetry?.(message.id);
  }, [onRetry, message.id]);

  return (
    <>
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={400}
        style={[
          localStyles.row,
          isUser && localStyles.rowUser,
        ]}
      >
        <View style={bubbleStyle}>
          {isUser ? (
            <Text style={textStyle}>{message.content}</Text>
          ) : (
            <SimpleMarkdown content={message.content} colors={colors} />
          )}
        </View>
      </Pressable>

      {/* Long-press action menu */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={localStyles.menuBackdrop}
          onPress={() => setMenuVisible(false)}
        >
          <View style={[localStyles.menuContainer, { backgroundColor: colors.surface }]}>
            {/* Copy */}
            <TouchableOpacity
              style={localStyles.menuItem}
              onPress={handleCopy}
            >
              <Text style={[localStyles.menuText, { color: colors.text }]}>
                {copied ? '✓ 已复制' : '📋 复制'}
              </Text>
            </TouchableOpacity>

            {/* Regenerate (only for assistant messages) */}
            {!isUser && onRetry && (
              <>
                <View style={[localStyles.menuDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity
                  style={localStyles.menuItem}
                  onPress={handleRetry}
                >
                  <Text style={[localStyles.menuText, { color: colors.text }]}>
                    🔄 重新生成
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </>
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
  menuBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  menuContainer: {
    borderRadius: borderRadius.large,
    paddingVertical: spacing.tight,
    minWidth: 160,
    ...shadows.lg,
  },
  menuItem: {
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
  },
  menuText: {
    fontSize: typography.body,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.small,
  },
});
