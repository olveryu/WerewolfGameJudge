/** Compact access to bot-seat takeover while the active game workspace hides the room board. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo, useCallback, useMemo } from 'react';
import {
  FlatList,
  type ListRenderItemInfo,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { UI_ICONS } from '@/config/iconTokens';
import { formatRoomSeat, type RoomSeatViewModel } from '@/features/room/model/RoomSeatDataSource';
import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import { TESTIDS } from '@/testids';
import { borderRadius, colors, componentSizes, fixed, spacing, textStyles } from '@/theme';

import { PICTIONARY_STAGE_MAX_WIDTH } from './PictionaryStageFrame';

const LONG_PRESS_DELAY_MS = 500;

interface PictionaryBotControlStripProps {
  readonly model: RoomSeatBoardModel;
}

interface PictionaryBotSeatButtonProps {
  readonly seat: RoomSeatViewModel;
  readonly isVisuallyDisabled: boolean;
  readonly onTakeOver: (seat: number) => void;
}

const PictionaryBotSeatButton: React.FC<PictionaryBotSeatButtonProps> = memo(
  ({ seat, isVisuallyDisabled, onTakeOver }) => {
    const handleTakeOver = useCallback(() => onTakeOver(seat.seat), [onTakeOver, seat.seat]);
    const displayName = seat.player?.displayName;
    if (displayName === undefined) {
      throw new Error(`[FAIL-FAST] Bot control seat ${seat.seat} has no player`);
    }

    return (
      <TouchableOpacity
        testID={TESTIDS.seatTilePressable(seat.seat)}
        accessibilityRole="button"
        accessibilityLabel={`${formatRoomSeat(seat.seat)} ${displayName}`}
        accessibilityHint="轻点或长按接管机器人"
        onPress={handleTakeOver}
        onLongPress={handleTakeOver}
        delayLongPress={LONG_PRESS_DELAY_MS}
        activeOpacity={isVisuallyDisabled ? 1 : fixed.activeOpacity}
        style={[
          styles.seatButton,
          seat.highlight === 'controlled' && styles.controlledSeatButton,
          isVisuallyDisabled && styles.visuallyDisabled,
        ]}
      >
        <Ionicons name={UI_ICONS.BOT} size={componentSizes.icon.sm} color={colors.primary} />
        <View style={styles.seatCopy}>
          <Text numberOfLines={1} style={styles.seatName}>
            {displayName}
          </Text>
          <Text style={styles.seatLabel}>{formatRoomSeat(seat.seat)}</Text>
        </View>
      </TouchableOpacity>
    );
  },
);
PictionaryBotSeatButton.displayName = 'PictionaryBotSeatButton';

const PictionaryBotControlStripComponent: React.FC<PictionaryBotControlStripProps> = ({
  model,
}) => {
  const botSeats = useMemo(
    () =>
      Array.from({ length: model.source.count }, (_, seat) => model.source.getSeat(seat)).filter(
        (seat) => seat.player?.kind === 'bot',
      ),
    [model.source],
  );
  const onTakeOver = model.onBotSeatLongPress;
  const renderSeat = useCallback(
    ({ item }: ListRenderItemInfo<RoomSeatViewModel>) => {
      if (onTakeOver === null) return null;
      return (
        <PictionaryBotSeatButton
          seat={item}
          isVisuallyDisabled={model.visuallyDisabled}
          onTakeOver={onTakeOver}
        />
      );
    },
    [model.visuallyDisabled, onTakeOver],
  );
  const getSeatKey = useCallback((seat: RoomSeatViewModel) => String(seat.seat), []);

  if (onTakeOver === null || botSeats.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        data={botSeats}
        renderItem={renderSeat}
        keyExtractor={getSeatKey}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

export const PictionaryBotControlStrip = memo(PictionaryBotControlStripComponent);
PictionaryBotControlStrip.displayName = 'PictionaryBotControlStrip';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: PICTIONARY_STAGE_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: spacing.medium,
    paddingTop: spacing.small,
  },
  listContent: { gap: spacing.small },
  seatButton: {
    minWidth: componentSizes.chip.minWidth * 2,
    minHeight: componentSizes.button.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    paddingHorizontal: spacing.small,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.small,
    backgroundColor: colors.surface,
  },
  controlledSeatButton: {
    borderColor: colors.warning,
    borderWidth: fixed.borderWidthThick,
  },
  visuallyDisabled: { opacity: fixed.disabledOpacity },
  seatCopy: { minWidth: 0 },
  seatName: { ...textStyles.secondarySemibold, color: colors.text },
  seatLabel: { ...textStyles.caption, color: colors.textSecondary },
});
