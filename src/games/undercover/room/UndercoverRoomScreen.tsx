/** Undercover room mounts exclusively through shared authentication, session and shell boundaries. */
import { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';

import { createBoardInfoStyles } from '@/features/room/components/boardInfo.styles';
import { BoardInfoCard } from '@/features/room/components/BoardInfoCard';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSummary, RoomGuideButton } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import { colors } from '@/theme';

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
  const boardInfoStyles = useMemo(() => createBoardInfoStyles(colors), []);
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
          <>
            <RoomGameSummary
              icon="search-outline"
              title={`谁是卧底 · ${state.config.numberOfPlayers}人局`}
              subtitle={`${state.config.hasBlank ? '有白板' : '无白板'} · ${UNDERCOVER_CATEGORY_NAMES[state.config.category]}`}
              testID="undercover-room"
              headerRight={<RoomGuideButton onPress={openRules} label="查看谁是卧底玩法说明" />}
            >
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
            </RoomGameSummary>
            <BoardInfoCard
              playerCount={state.config.numberOfPlayers}
              sections={[
                {
                  title: '卧底',
                  items: [{ roleId: 'undercover', displayName: '卧底', count: 1 }],
                  color: colors.wolf,
                },
                {
                  title: '平民',
                  items: [
                    {
                      roleId: 'civilian',
                      displayName: '平民',
                      count: state.config.numberOfPlayers - 1 - (state.config.hasBlank ? 1 : 0),
                    },
                  ],
                  color: colors.villager,
                },
                ...(state.config.hasBlank
                  ? [
                      {
                        title: '白板',
                        items: [{ roleId: 'blank', displayName: '白板', count: 1 }],
                        color: colors.textMuted,
                      },
                    ]
                  : []),
              ]}
              styles={boardInfoStyles}
            />
          </>
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
