/** FibKing room rendered entirely through the shared RoomEntryBoundary and RoomShell. */
import type { FibRole, FibState } from '@game-judge/game-engine/games/fibking/public';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { BoardInfoCard } from '@/features/room/components/BoardInfoCard';
import { RoleCardDialog } from '@/features/room/components/RoleCard';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGuideButton } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import { TESTIDS } from '@/testids';

import type { FibRoomSession } from '../model/FibRoomSession';
import { FibIdentityModal } from './components/FibIdentityModal';
import { isFibRole, toFibRolePreviewData } from './components/FibRoleCardAdapter';
import { FibRoomSummary } from './components/FibRoomSummary';
import { createFibBoardInfoSections } from './fibRoomAdapter';
import { useFibRoomState } from './hooks/useFibRoomState';

interface FibRoomScreenProps extends GameRoomScreenProps<'fibking'> {
  readonly session: FibRoomSession;
  readonly review: RoomReviewContribution<FibState>;
}

/** Mounts the FibKing room behind the shared entry lifecycle (direct link, join, reconnect). */
export function FibRoomScreen(props: FibRoomScreenProps) {
  const navigate = useNavigate();
  return (
    <RoomEntryBoundary
      room={props.room}
      session={props.session}
      onExit={() => exitRoomFlow(navigate)}
    >
      {(entryController) => <FibRoomContent {...props} entryController={entryController} />}
    </RoomEntryBoundary>
  );
}

function FibRoomContent(
  props: FibRoomScreenProps & { readonly entryController: RoomEntryController },
) {
  const screen = useFibRoomState(props);
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
                  testId={TESTIDS.fibRulesButton}
                />
              }
            />
            <BoardInfoCard
              playerCount={screen.playerCount}
              sections={createFibBoardInfoSections(screen.playerCount)}
              collapsed={false}
              onRolePress={(roleId) => {
                if (isFibRole(roleId)) setPreviewRole(roleId);
              }}
              onStrategyPress={null}
              onNotepadPress={null}
              footer={null}
            />
          </>
        ),
      }}
      gameOverlays={
        <>
          {screen.roleViewing.isOpen && screen.roundView !== null && (
            <FibIdentityModal
              view={screen.roundView}
              effectType={screen.isBotTakeoverActive ? null : screen.equippedRevealEffect}
              shouldPlay={screen.roleViewing.shouldPlayAnimation}
              allRoles={screen.identityAllRoles}
              remainingCards={screen.roleViewing.remainingCards}
              onClose={screen.roleViewing.close}
            />
          )}
          {screen.isPublicViewOpen && screen.roundView !== null && (
            <FibIdentityModal
              view={screen.roundView}
              effectType={null}
              shouldPlay={false}
              allRoles={screen.identityAllRoles}
              remainingCards={0}
              onClose={screen.closePublicView}
            />
          )}
          {previewRole !== null && (
            <RoleCardDialog
              role={toFibRolePreviewData(previewRole)}
              onClose={() => setPreviewRole(null)}
              confirmText="知道了"
            />
          )}
          {screen.reviewOverlay}
        </>
      }
    />
  );
}
