/**
 * Chat window styles.
 *
 * Modal backdrop, chat window chrome, header, message bubbles,
 * scroll-to-bottom FAB, text input, empty state and quick-question pills.
 * `chatWidth` is injected from the barrel to avoid circular imports.
 */
import { StyleSheet } from 'react-native';

import { borderRadius, fixed, shadows, spacing, type ThemeColors, typography } from '@/theme';

export function createChatStyles(colors: ThemeColors, chatWidth: number) {
  return StyleSheet.create({
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
      width: chatWidth,
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
      borderBottomWidth: fixed.borderWidth,
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
      borderTopWidth: fixed.borderWidth,
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
      opacity: fixed.disabledOpacity,
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
      borderTopWidth: fixed.borderWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      gap: spacing.small,
    },
    quickQuestionBtn: {
      backgroundColor: colors.background,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      borderRadius: borderRadius.large,
      paddingVertical: spacing.tight,
      paddingHorizontal: spacing.medium,
      flexBasis: '48%',
      flexGrow: 0,
      flexShrink: 1,
    },
    quickQuestionBtnDisabled: {
      opacity: fixed.disabledOpacity,
    },
    quickQuestionText: {
      fontSize: typography.caption,
      color: colors.textSecondary,
    },
  });
}
