/** Undercover room mounts exclusively through shared authentication, session and shell boundaries. */
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';

import type { UndercoverRoomSession } from '../model/UndercoverRoomSession';
import { undercoverStyles as styles } from '../undercover.styles';
import { UndercoverRevealModal } from './components/UndercoverRevealModal';
import { UndercoverWordModal } from './components/UndercoverWordModal';
import { useUndercoverRoomScreenState } from './hooks/useUndercoverRoomScreenState';
import { UNDERCOVER_CATEGORY_NAMES } from './undercoverRoomAdapter';

interface UndercoverRoomScreenProps extends GameRoomScreenProps<'undercover'> {
  readonly session: UndercoverRoomSession;
}

export function UndercoverRoomScreen(props: UndercoverRoomScreenProps) {
  const exit = useCallback(() => exitRoomFlow(props.navigation), [props.navigation]);
  return (
    <RoomEntryBoundary room={props.room} session={props.session} onExit={exit}>
      {(entryController) => <UndercoverRoomContent {...props} entryController={entryController} />}
    </RoomEntryBoundary>
  );
}

function UndercoverRoomContent(
  props: UndercoverRoomScreenProps & { readonly entryController: RoomEntryController },
) {
  const { state, shellModel, controls, isControlled, openRules } =
    useUndercoverRoomScreenState(props);
  return (
    <RoomShell
      model={shellModel}
      leadingExtraActions={null}
      trailingExtraActions={null}
      content={{
        kind: 'seats',
        contextHeader: null,
        sideInspector: null,
        afterSeatBoard: null,
        beforeSeatBoard: (
          <View style={styles.section} testID="undercover-room">
            <View style={styles.row}>
              <Text style={styles.title}>谁是卧底</Text>
              <Button variant="ghost" onPress={openRules}>
                游戏规则
              </Button>
            </View>
            <Text style={styles.muted}>
              {state.config.numberOfPlayers} 人 · {state.config.hasBlank ? '有白板' : '无白板'} ·{' '}
              {UNDERCOVER_CATEGORY_NAMES[state.config.category]}
            </Text>
            {state.phase === 'ended' && (
              <View style={styles.section} testID="undercover-results">
                <Text style={styles.text}>平民词：{state.round.civilianWord}</Text>
                <Text style={styles.text}>卧底词：{state.round.undercoverWord}</Text>
                <Text style={styles.muted}>
                  出局顺序：
                  {state.round.revelations.map((entry) => `${entry.seat + 1}号`).join(' → ')}
                </Text>
              </View>
            )}
          </View>
        ),
      }}
      gameOverlays={
        <>
          {controls.card !== null && (
            <UndercoverWordModal
              card={controls.card}
              isControlled={isControlled}
              shouldConfirm={controls.shouldConfirm}
              isSubmitting={controls.isSubmitting}
              onClose={controls.closeCard}
              onConfirm={controls.confirmCard}
            />
          )}
          {controls.selectedSeat !== null && (
            <UndercoverRevealModal
              seat={controls.selectedSeat}
              player={shellModel.seats.source.getSeat(controls.selectedSeat).player!}
              isSubmitting={controls.isSubmitting}
              onClose={controls.cancelRevelation}
              onConfirm={controls.reveal}
            />
          )}
        </>
      }
    />
  );
}
