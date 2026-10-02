/**
 * BotTakeoverStrip — Shared bot-seat takeover strip (G6).
 *
 * Single visual language for bot takeover across games: horizontal chips
 * with bot icon, display name and seat number. Tap or long-press takes over.
 * Games map their own seat data to BotTakeoverItem[].
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo, useCallback } from 'react';
import {
  FlatList,
  type ListRenderItemInfo,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { UI_ICONS } from '@/config/iconTokens';
import { formatRoomSeat } from '@/features/room/model/RoomSeatDataSource';
import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  spacing,
  typography,
} from '@/theme';

export interface BotTakeoverItem {
  readonly seat: number;
  readonly displayName: string;
  readonly isControlled: boolean;
  readonly isDisabled: boolean;
}

interface BotTakeoverStripProps {
  readonly bots: readonly BotTakeoverItem[];
  readonly onTakeOver: (seat: number) => void;
  readonly longPressDelayMs?: number;
  readonly testIDPrefix: string;
}

const BotTakeoverChip: React.FC<{
  readonly bot: BotTakeoverItem;
  readonly onTakeOver: (seat: number) => void;
  readonly longPressDelayMs: number;
  readonly testIDPrefix: string;
}> = memo(({ bot, onTakeOver, longPressDelayMs, testIDPrefix }) => {
  const handleTakeOver = useCallback(() => onTakeOver(bot.seat), [onTakeOver, bot.seat]);
  return (
    <PressableScale
      testID={`${testIDPrefix}-${bot.seat}`}
      accessibilityRole="button"
      accessibilityLabel={`${formatRoomSeat(bot.seat)} ${bot.displayName}`}
      accessibilityHint="轻点或长按接管机器人"
      onPress={handleTakeOver}
      onLongPress={handleTakeOver}
      delayLongPress={longPressDelayMs}
      haptic
      style={[
        styles.chip,
        bot.isControlled && styles.controlledChip,
        bot.isDisabled && styles.disabledChip,
      ]}
    >
      <Ionicons name={UI_ICONS.BOT} size={componentSizes.icon.sm} color={colors.primary} />
      <View style={styles.chipCopy}>
        <Text numberOfLines={1} style={styles.chipName}>
          {bot.displayName}
        </Text>
        <Text style={styles.chipSeat}>{formatRoomSeat(bot.seat)}</Text>
      </View>
    </PressableScale>
  );
});
BotTakeoverChip.displayName = 'BotTakeoverChip';

const BotTakeoverStripComponent: React.FC<BotTakeoverStripProps> = ({
  bots,
  onTakeOver,
  longPressDelayMs = 500,
  testIDPrefix,
}) => {
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<BotTakeoverItem>) => (
      <BotTakeoverChip
        bot={item}
        onTakeOver={onTakeOver}
        longPressDelayMs={longPressDelayMs}
        testIDPrefix={testIDPrefix}
      />
    ),
    [onTakeOver, longPressDelayMs, testIDPrefix],
  );

  if (bots.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        data={bots}
        keyExtractor={(bot) => String(bot.seat)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
};

export const BotTakeoverStrip = memo(BotTakeoverStripComponent);
BotTakeoverStrip.displayName = 'BotTakeoverStrip';

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  list: {
    gap: spacing.small,
    paddingVertical: spacing.tight,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    backgroundColor: colors.surface,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
    minHeight: fixed.minTouchTarget,
  },
  controlledChip: {
    borderColor: colors.warning,
    borderWidth: fixed.borderWidthHighlight,
  },
  disabledChip: {
    opacity: fixed.disabledOpacity,
  },
  chipCopy: {
    minWidth: 0,
  },
  chipName: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    maxWidth: 120,
  },
  chipSeat: {
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    color: colors.textMuted,
  },
});
