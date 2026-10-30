/** FibKing room rendered entirely through the shared RoomEntryBoundary and RoomShell. */

import type { FibRole } from '@game-judge/game-engine/games/fibking/public';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';

import { createBoardInfoStyles } from '@/features/room/components/boardInfo.styles';
import { BoardInfoCard } from '@/features/room/components/BoardInfoCard';
import { RoleCardSimple } from '@/features/room/components/RoleCardSimple';
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
import { isFibRole, toFibRolePreviewData } from './components/FibRoleCardAdapter';
import { FibRoomSummary } from './components/FibRoomSummary';
import { createFibBoardInfoSections } from './fibRoomAdapter';
import { useFibRoomState } from './hooks/useFibRoomState';

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
  const screen = useFibRoomState({
    room,
    entryReason,
    navigation,
    session,
    entryController,
  });
  const boardInfoStyles = useMemo(() => createBoardInfoStyles(colors), []);
  // BoardInfo 角色预览（纯展示状态）：只显示种类说明，不走身份查看协议。
  const [previewRole, setPreviewRole] = useState<FibRole | null>(null);

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
              sections={createFibBoardInfoSections(screen.playerCount)}
              styles={boardInfoStyles}
              onRolePress={(roleId) => {
                if (isFibRole(roleId)) setPreviewRole(roleId);
              }}
            />
          </>
        ),
      }}
      gameOverlays={
        <>
          {screen.roleViewing.isOpen && screen.roundView !== null ? (
            <FibIdentityModal
              view={screen.roundView}
              effectType={screen.isBotTakeoverActive ? null : screen.equippedRevealEffect}
              shouldPlay={screen.roleViewing.shouldPlayAnimation}
              allRoles={screen.identityAllRoles}
              remainingCards={screen.roleViewing.remainingCards}
              onClose={screen.roleViewing.close}
            />
          ) : null}
          {screen.isPublicViewOpen && screen.roundView !== null ? (
            <FibIdentityModal
              view={screen.roundView}
              effectType={null}
              shouldPlay={false}
              allRoles={screen.identityAllRoles}
              remainingCards={0}
              onClose={screen.closePublicView}
            />
          ) : null}
          {previewRole !== null ? (
            <RoleCardSimple
              visible={true}
              role={toFibRolePreviewData(previewRole)}
              onClose={() => setPreviewRole(null)}
              confirmText="知道了"
            />
          ) : null}
        </>
      }
    />
  );
};
