/** 底部半屏卡片：按紧急度排序的机器人列表。 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { AppModal } from '@/components/AppModal/AppModal';
import { borderRadius, colors, componentSizes, fixed, spacing, textStyles } from '@/theme';

import type { BotTakeoverBot, BotTakeoverStatus } from './BotTakeover';

interface TakeoverSheetProps {
  readonly visible: boolean;
  readonly bots: readonly BotTakeoverBot[];
  readonly activeSeat: number | null;
  readonly onTakeOver: (seat: number) => void;
  readonly onClose: () => void;
}

const STATUS_ORDER: Record<BotTakeoverStatus, number> = { acting: 0, waiting: 1, done: 2 };
const STATUS_ICON: Record<BotTakeoverStatus, string> = {
  acting: '🔴',
  waiting: '⚪',
  done: '✅',
};

function sortBots(
  bots: readonly BotTakeoverBot[],
  activeSeat: number | null,
): readonly BotTakeoverBot[] {
  return [...bots].sort((a, b) => {
    // 当前行动者置顶
    if (a.seat === activeSeat) return -1;
    if (b.seat === activeSeat) return 1;
    return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  });
}

export const TakeoverSheet: React.FC<TakeoverSheetProps> = ({
  visible,
  bots,
  activeSeat,
  onTakeOver,
  onClose,
}) => {
  const sorted = sortBots(bots, activeSeat);
  return (
    <AppModal visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>机器人接管</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="关闭"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={componentSizes.icon.md} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {sorted.map((bot) => (
              <View key={bot.seat} style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>
                    {STATUS_ICON[bot.status]} {bot.seat + 1}号位 · {bot.displayName}
                  </Text>
                  <Text style={styles.rowSubtitle}>{bot.statusLabel}</Text>
                </View>
                {bot.status !== 'done' && (
                  <Button variant="secondary" size="sm" onPress={() => onTakeOver(bot.seat)}>
                    {bot.actionLabel}
                  </Button>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
    padding: spacing.medium,
    gap: spacing.small,
    maxHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...textStyles.subtitleSemibold,
    color: colors.text,
  },
  closeButton: {
    minWidth: fixed.minTouchTarget,
    minHeight: fixed.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    gap: spacing.small,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.small,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.border,
    gap: spacing.small,
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
    gap: spacing.tight / 2,
  },
  rowTitle: {
    ...textStyles.secondarySemibold,
    color: colors.text,
  },
  rowSubtitle: {
    ...textStyles.secondary,
    color: colors.textSecondary,
  },
});
