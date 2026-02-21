/**
 * AIChatBubble.styles - 样式与布局常量
 *
 * 集中管理 AIChatBubble 的尺寸、位置和样式定义。
 * 导出样式定义与布局常量。不含业务逻辑，不 import service。
 */

import { Dimensions, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { borderRadius, shadows, spacing, type ThemeColors, typography } from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

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

// ── NotepadStyles（NotepadPanel 依赖此类型） ─────────────

export interface NotepadStyles {
  container: ViewStyle;
  list: ViewStyle;
  listContent: ViewStyle;
  card: ViewStyle;
  cardWolf: ViewStyle;
  cardGod: ViewStyle;
  cardVillager: ViewStyle;
  cardThird: ViewStyle;
  cardHeader: ViewStyle;
  seatBtn: ViewStyle;
  seatNumber: TextStyle;
  seatPlaceholder: TextStyle;
  roleBadge: ViewStyle;
  roleBadgeWolf: ViewStyle;
  roleBadgeGod: ViewStyle;
  roleBadgeVillager: ViewStyle;
  roleBadgeThird: ViewStyle;
  roleBadgeText: TextStyle;
  roleBadgeTextWolf: TextStyle;
  roleBadgeTextGod: TextStyle;
  roleBadgeTextVillager: TextStyle;
  roleBadgeTextThird: TextStyle;
  handTag: ViewStyle;
  handTagActive: ViewStyle;
  handTagText: TextStyle;
  handTagTextActive: TextStyle;
  noteInput: TextStyle;
  popoverOverlay: ViewStyle;
  popover: ViewStyle;
  popoverTitle: TextStyle;
  popoverGrid: ViewStyle;
  popoverTag: ViewStyle;
  popoverTagSelectedWolf: ViewStyle;
  popoverTagSelectedGod: ViewStyle;
  popoverTagSelectedVillager: ViewStyle;
  popoverTagSelectedThird: ViewStyle;
  popoverTagText: TextStyle;
  popoverTagTextWolf: TextStyle;
  popoverTagTextGod: TextStyle;
  popoverTagTextVillager: TextStyle;
  popoverTagTextThird: TextStyle;
  popoverTagTextSelected: TextStyle;
  popoverClearBtn: ViewStyle;
  popoverClearText: TextStyle;
  legend: ViewStyle;
  legendItem: ViewStyle;
  legendDot: ViewStyle;
  legendDotWolf: ViewStyle;
  legendDotGod: ViewStyle;
  legendDotVillager: ViewStyle;
  legendDotThird: ViewStyle;
  legendText: TextStyle;
}

/** NotepadModal 层级额外样式（直接通过 ChatStyles 访问） */
export interface NotepadPublicStyles {
  notepadPublicSection: ViewStyle;
  notepadPublicLabel: TextStyle;
  notepadPublicRow: ViewStyle;
  notepadPublicInput: TextStyle;
}

// ── StyleSheet ───────────────────────────────────────────

export const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // 悬浮按钮
    bubbleContainer: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: BUBBLE_SIZE,
      height: BUBBLE_SIZE,
      zIndex: 1000,
      overflow: 'visible',
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
    pulseRing: {
      position: 'absolute',
      width: BUBBLE_SIZE,
      height: BUBBLE_SIZE,
      borderRadius: BUBBLE_SIZE / 2,
      borderWidth: 3,
      borderColor: colors.primary,
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

    // Notepad entry chip (subtle surface pill in header)
    notepadEntryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.medium,
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight,
    },
    notepadEntryBtnText: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
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
      opacity: 0.5,
    },
    quickQuestionText: {
      fontSize: typography.caption,
      color: colors.textSecondary,
    },

    // ── Notepad (full-screen modal) ──────────────────
    notepadModal: {
      flex: 1,
      backgroundColor: colors.background,
    },
    notepadHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    notepadHeaderTitle: {
      fontSize: typography.subtitle,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    notepadHeaderButtons: {
      flexDirection: 'row',
      gap: spacing.small,
    },
    notepadHeaderBtn: {
      padding: spacing.tight,
    },
    notepadHeaderBtnText: {
      fontSize: typography.body,
      color: colors.textSecondary,
    },
    notepadContainer: {
      flex: 1,
    },
    notepadList: {
      flex: 1,
    },
    notepadListContent: {
      padding: spacing.tight,
      gap: spacing.tight,
    },
    notepadCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      ...shadows.sm,
      paddingHorizontal: spacing.tight,
      paddingVertical: spacing.tight,
      gap: spacing.tight,
    },
    notepadCardWolf: {
      backgroundColor: colors.wolf + '18',
    },
    notepadCardGod: {
      backgroundColor: colors.god + '18',
    },
    notepadCardVillager: {
      backgroundColor: colors.villager + '18',
    },
    notepadCardThird: {
      backgroundColor: colors.third + '18',
    },
    notepadCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
    },
    notepadSeatBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.micro,
      minHeight: componentSizes.button.sm,
    },
    notepadSeatNumber: {
      fontSize: typography.secondary,
      fontWeight: typography.weights.bold,
      color: colors.text,
      minWidth: componentSizes.icon.lg,
      textAlign: 'center',
    },
    notepadSeatPlaceholder: {
      fontSize: typography.caption,
      color: colors.textMuted,
    },
    notepadRoleBadge: {
      minWidth: componentSizes.badge.md,
      paddingHorizontal: spacing.micro,
      paddingVertical: 1,
      borderRadius: borderRadius.small,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notepadRoleBadgeWolf: {
      backgroundColor: colors.wolf + '30',
    },
    notepadRoleBadgeGod: {
      backgroundColor: colors.god + '30',
    },
    notepadRoleBadgeVillager: {
      backgroundColor: colors.villager + '30',
    },
    notepadRoleBadgeThird: {
      backgroundColor: colors.third + '30',
    },
    notepadRoleBadgeText: {
      fontSize: typography.caption,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    notepadRoleBadgeTextWolf: {
      color: colors.wolf,
    },
    notepadRoleBadgeTextGod: {
      color: colors.god,
    },
    notepadRoleBadgeTextVillager: {
      color: colors.villager,
    },
    notepadRoleBadgeTextThird: {
      color: colors.third,
    },
    notepadHandTag: {
      marginLeft: 'auto',
      minHeight: componentSizes.button.sm,
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight,
      borderRadius: borderRadius.small,
      backgroundColor: colors.background,
      justifyContent: 'center',
    },
    notepadHandTagActive: {
      backgroundColor: colors.primary + '30',
    },
    notepadHandTagText: {
      fontSize: typography.caption,
      color: colors.textMuted,
    },
    notepadHandTagTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    notepadPopoverOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlayLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    notepadPopover: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      padding: spacing.medium,
      ...shadows.lg,
      width: 280,
    },
    notepadPopoverTitle: {
      fontSize: typography.secondary,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: spacing.small,
      textAlign: 'center',
    },
    notepadPopoverGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
      justifyContent: 'center',
    },
    notepadPopoverTag: {
      minWidth: componentSizes.button.md,
      minHeight: componentSizes.button.md,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notepadPopoverTagSelectedWolf: {
      backgroundColor: colors.wolf + '30',
    },
    notepadPopoverTagSelectedGod: {
      backgroundColor: colors.god + '30',
    },
    notepadPopoverTagSelectedVillager: {
      backgroundColor: colors.villager + '30',
    },
    notepadPopoverTagSelectedThird: {
      backgroundColor: colors.third + '30',
    },
    notepadPopoverTagText: {
      fontSize: typography.body,
      color: colors.textMuted,
    },
    notepadPopoverTagTextWolf: {
      color: colors.wolf,
    },
    notepadPopoverTagTextGod: {
      color: colors.god,
    },
    notepadPopoverTagTextVillager: {
      color: colors.villager,
    },
    notepadPopoverTagTextThird: {
      color: colors.third,
    },
    notepadPopoverTagTextSelected: {
      color: colors.text,
      fontWeight: typography.weights.bold,
    },
    notepadPopoverClearBtn: {
      minWidth: componentSizes.button.md,
      minHeight: componentSizes.button.md,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notepadPopoverClearText: {
      fontSize: typography.body,
      color: colors.error,
    },
    notepadNoteInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: borderRadius.small,
      paddingHorizontal: spacing.small,
      paddingVertical: 0,
      fontSize: typography.body, // ≥ 16px — prevents iOS Safari auto-zoom
      color: colors.text,
    },
    notepadLegend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.medium,
      paddingVertical: spacing.small,
      borderTopWidth: fixed.borderWidth,
      borderTopColor: colors.border,
    },
    notepadLegendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
    },
    notepadLegendDot: {
      width: spacing.small,
      height: spacing.small,
      borderRadius: borderRadius.full,
    },
    notepadLegendDotWolf: {
      backgroundColor: colors.wolf,
    },
    notepadLegendDotGod: {
      backgroundColor: colors.god,
    },
    notepadLegendDotVillager: {
      backgroundColor: colors.villager,
    },
    notepadLegendDotThird: {
      backgroundColor: colors.third,
    },
    notepadLegendText: {
      fontSize: typography.caption,
      color: colors.textSecondary,
    },

    // ── Notepad public note section ────────────────
    notepadPublicSection: {
      paddingHorizontal: spacing.medium,
      paddingTop: spacing.small,
      paddingBottom: spacing.tight,
      borderTopWidth: fixed.borderWidth,
      borderTopColor: colors.border,
    },
    notepadPublicLabel: {
      fontSize: typography.secondary,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: spacing.tight,
    },
    notepadPublicRow: {
      flexDirection: 'row',
      gap: spacing.small,
    },
    notepadPublicInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      borderRadius: borderRadius.medium,
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.small,
      fontSize: typography.body,
      color: colors.text,
      minHeight: 80,
      maxHeight: 160,
    },
  });

export type ChatStyles = ReturnType<typeof createStyles>;
