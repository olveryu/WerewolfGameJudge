/**
 * AIChatBubble.styles - 样式与布局常量
 *
 * 集中管理 AIChatBubble 的尺寸、位置和样式定义。
 *
 * ✅ 允许：样式定义、布局常量
 * ❌ 禁止：业务逻辑、import service
 */

import { Dimensions, StyleSheet } from 'react-native';
import { spacing, borderRadius, typography, shadows, type ThemeColors } from '../../theme';

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
    // 悬浮按钮 - 使用 left/top 定位
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

    // Modal - 使用固定尺寸，避免键盘弹出时 viewport 变化
    modalContainer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end', // 靠底部对齐
      alignItems: 'center',
      paddingBottom: 20, // 基础底部间距
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.3)',
    },

    // 聊天窗口 - 高度由组件通过 getChatHeight() 动态传入
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
      fontWeight: '600',
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

    // Messages
    messageList: {
      flex: 1,
    },
    messageListContent: {
      padding: spacing.small,
    },
    messageRow: {
      marginBottom: spacing.tight,
      flexDirection: 'row',
    },
    messageRowUser: {
      justifyContent: 'flex-end',
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
      fontSize: typography.body, // 必须 >= 16px，否则 iOS Safari 会自动缩放
      color: colors.text,
      marginRight: spacing.tight,
    },
    sendButton: {
      width: 36,
      height: 36,
      backgroundColor: colors.primary,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    sendButtonText: {
      color: colors.textInverse,
      fontWeight: '700',
      fontSize: 18,
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

    // Quick Questions - 横向滚动的 chips
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
    // AI 生成的跟进问题样式（更醒目）
    aiSuggestionBtn: {
      backgroundColor: `${colors.primary}15`,
      borderColor: colors.primary,
      borderWidth: 1.5,
    },
    aiSuggestionText: {
      color: colors.primary,
      fontWeight: '500',
    },
    quickQuestionText: {
      fontSize: typography.caption,
      color: colors.textSecondary,
    },
  });
