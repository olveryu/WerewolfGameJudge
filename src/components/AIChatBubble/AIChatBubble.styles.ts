/**
 * AIChatBubble.styles - 样式与布局常量
 *
 * 集中管理 AIChatBubble 的尺寸、位置和样式定义。
 *
 * ✅ 允许：样式定义、布局常量
 * ❌ 禁止：业务逻辑、import service
 */

import { Dimensions, StyleSheet } from 'react-native';

import { borderRadius, shadows, spacing, type ThemeColors, typography } from '@/theme';

// ── 布局常量 ──────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const CHAT_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);
export const BUBBLE_SIZE = 56;
export const BUBBLE_MARGIN = 16;

/** 根据屏幕高度动态计算聊天窗口高度（55%，限制 320~600） */
export function getChatHeight(screenHeight: number): number {
  return Math.min(600, Math.max(320, Math.round(screenHeight * 0.55)));
}

/** 默认位置：右下角 */
export const DEFAULT_POSITION = {
  x: SCREEN_WIDTH - BUBBLE_SIZE - BUBBLE_MARGIN,
  y: SCREEN_HEIGHT - BUBBLE_SIZE - 60,
};

// ── DisplayMessage 类型 ─────────────────────────────────

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// ── StyleSheet ───────────────────────────────────────────

export const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // 悬浮按钮
    bubbleContainer: {
      position: 'absolute',
      left: 0,
      top: 0,
      zIndex: 1000,
    },
    bubble: {
      width: BUBBLE_SIZE,
      height: BUBBLE_SIZE,
      borderRadius: BUBBLE_SIZE / 2,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadows.lg,
    },
    bubbleIcon: {
      fontSize: 28,
    },

    // Modal
    modalContainer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingBottom: spacing.large,
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlayLight,
    },

    // Chat window
    chatWindow: {
      width: CHAT_WIDTH,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xlarge,
      ...shadows.lg,
      overflow: 'hidden',
    },

    // Header
    chatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    chatTitle: {
      fontSize: typography.body,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    headerButtons: {
      flexDirection: 'row',
      gap: spacing.tight,
    },
    headerBtn: {
      padding: spacing.tight,
    },
    headerBtnText: {
      fontSize: typography.body,
    },

    // Messages (wrapper for scroll-to-bottom overlay)
    messageListWrapper: {
      flex: 1,
      position: 'relative',
    },
    messageList: {
      flex: 1,
    },
    messageListContent: {
      padding: spacing.small,
    },
    messageBubble: {
      maxWidth: '85%',
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight,
      borderRadius: borderRadius.medium,
    },
    userBubble: {
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
    },
    assistantBubble: {
      backgroundColor: colors.background,
      borderBottomLeftRadius: 4,
    },
    messageText: {
      fontSize: typography.secondary,
      color: colors.text,
      lineHeight: 20,
    },
    userText: {
      color: colors.textInverse,
    },

    // Scroll-to-bottom FAB
    scrollToBottomBtn: {
      position: 'absolute',
      right: spacing.small,
      bottom: spacing.small,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.md,
    },
    scrollToBottomText: {
      fontSize: typography.subtitle,
      fontWeight: typography.weights.bold,
    },

    // Input
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: spacing.small,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    input: {
      flex: 1,
      minHeight: 36,
      maxHeight: 80,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight,
      fontSize: typography.body, // ≥ 16px — prevents iOS Safari auto-zoom
      color: colors.text,
      marginRight: spacing.tight,
    },
    sendButton: {
      width: 36,
      height: 36,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    sendButtonText: {
      color: colors.textInverse,
      fontWeight: typography.weights.bold,
      fontSize: typography.subtitle,
    },

    // Empty
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.large,
    },
    emptyText: {
      fontSize: typography.secondary,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
    },

    // Quick questions
    quickQuestionsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.small,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      gap: spacing.small,
    },
    quickQuestionBtn: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.large,
      paddingVertical: spacing.tight,
      paddingHorizontal: spacing.medium,
      flexBasis: '48%',
      flexGrow: 0,
      flexShrink: 1,
    },
    quickQuestionBtnDisabled: {
      opacity: 0.5,
    },
    quickQuestionText: {
      fontSize: typography.caption,
      color: colors.textSecondary,
    },
  });
