/** FibKing room rendered entirely through the shared RoomEntryBoundary and RoomShell. */

import type React from 'react';
import { useCallback, useMemo } from 'react';

import { createBoardInfoStyles } from '@/features/room/components/boardInfo.styles';
import { BoardInfoCard } from '@/features/room/components/BoardInfoCard';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGuideButton } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { FibRoomSession } from '@/games/fibking/model/FibRoomSession';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

import { FibIdentityModal } from './components/FibIdentityModal';
import { FibRoomSummary } from './components/FibRoomSummary';
import { getFibRoleName } from './fibRoomAdapter';
import { useFibRoomScreenState } from './hooks/useFibRoomScreenState';

interface FibRoomScreenProps extends GameRoomScreenProps<'fibking'> {
  readonly session: FibRoomSession;
}

export const FibRoomScreen: React.FC<FibRoomScreenProps> = ({
  room,
  entryReason,
  navigation,
  session,
}) => {
  const handleExit = useCallback(() => exitRoomFlow(navigation), [navigation]);
  return (
    <RoomEntryBoundary room={room} session={session} onExit={handleExit}>
      {(entryController) => (
        <FibRoomContent
          room={room}
          entryReason={entryReason}
          navigation={navigation}
          session={session}
          entryController={entryController}
        />
      )}
    </RoomEntryBoundary>
  );
};

interface FibRoomContentProps extends FibRoomScreenProps {
  readonly entryController: RoomEntryController;
}

const FibRoomContent: React.FC<FibRoomContentProps> = ({
  room,
  entryReason,
  navigation,
  session,
  entryController,
}) => {
  const screen = useFibRoomScreenState({
    room,
    entryReason,
    navigation,
    session,
    entryController,
  });
  const boardInfoStyles = useMemo(() => createBoardInfoStyles(colors), []);

  return (
    <RoomShell
      model={screen.shellModel}
      leadingExtraActions={null}
      trailingExtraActions={null}
      content={{
        kind: 'seats',
        contextHeader: null,
        afterSeatBoard: null,
        sideInspector: null,
        beforeSeatBoard: (
          <>
            <FibRoomSummary
              phase={screen.phase}
              occupiedSeatCount={screen.occupiedSeatCount}
              playerCount={screen.playerCount}
              preparationStage={screen.preparationStage}
              preparationFailureCode={screen.preparationFailureCode}
              headerRight={
                <RoomGuideButton
                  onPress={screen.openRules}
                  label="查看瞎掰王玩法说明"
                  testID={TESTIDS.fibRulesButton}
                />
              }
            />
            <BoardInfoCard
              playerCount={screen.playerCount}
              sections={[
                {
                  title: getFibRoleName('guesser'),
                  items: [{ roleId: 'guesser', displayName: getFibRoleName('guesser'), count: 1 }],
                  color: colors.god,
                },
                {
                  title: getFibRoleName('honest'),
                  items: [{ roleId: 'honest', displayName: getFibRoleName('honest'), count: 1 }],
                  color: colors.villager,
                },
                {
                  title: getFibRoleName('fibber'),
                  items: [
                    {
                      roleId: 'fibber',
                      displayName: getFibRoleName('fibber'),
                      count: screen.playerCount - 2,
                    },
                  ],
                  color: colors.wolf,
                },
              ]}
              styles={boardInfoStyles}
            />
          </>
        ),
      }}
      gameOverlays={
        screen.isIdentityVisible && screen.roundView !== null ? (
          <FibIdentityModal
            view={screen.roundView}
            effectType={screen.isBotTakeoverActive ? null : screen.equippedRevealEffect}
            shouldPlay={screen.identityShouldPlay}
            allRoles={screen.identityAllRoles}
            confirmText={screen.identityConfirmText}
            onConfirm={screen.confirmIdentity}
          />
        ) : null
      }
    />
  );
};
