/** Compact access to bot-seat takeover while the active game workspace hides the room board. */

import type React from 'react';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  BotTakeoverStrip,
  type BotTakeoverItem,
} from '@/features/room/components/BotTakeoverStrip';
import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import { spacing } from '@/theme';

import { PICTIONARY_STAGE_MAX_WIDTH } from './PictionaryStageFrame';

interface PictionaryBotControlStripProps {
  readonly model: RoomSeatBoardModel;
}

const PictionaryBotControlStripComponent: React.FC<PictionaryBotControlStripProps> = ({
  model,
}) => {
  const bots: BotTakeoverItem[] = useMemo(
    () =>
      Array.from({ length: model.source.count }, (_, seat) => model.source.getSeat(seat))
        .filter((seat) => seat.player?.kind === 'bot')
        .map((seat) => {
          const displayName = seat.player?.displayName;
          if (displayName === undefined) {
            throw new Error(`[FAIL-FAST] Bot control seat ${seat.seat} has no player`);
          }
          return {
            seat: seat.seat,
            displayName,
            isControlled: seat.highlight === 'controlled',
            isDisabled: model.visuallyDisabled,
          };
        }),
    [model.source, model.visuallyDisabled],
  );
  const onTakeOver = model.onBotSeatLongPress;

  if (onTakeOver === null || bots.length === 0) return null;

  return (
    <View style={styles.container}>
      <BotTakeoverStrip bots={bots} onTakeOver={onTakeOver} testIDPrefix="pictionary-bot" />
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
});
