/** FibKing room rendered entirely through the shared RoomEntryBoundary and RoomShell. */
import type { FibRole, FibState } from '@game-judge/game-engine/games/fibking/public';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { BoardInfoContent } from '@/features/room/components/BoardInfoContent';
import { RoleCardDialog } from '@/features/room/components/RoleCard';
import { RoomDialog } from '@/features/room/components/RoomDialog';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import { FibStatsPanel } from '@/games/fibking/components/FibStatsPanel';
import { TESTIDS } from '@/testids';

import type { FibRoomSession } from '../model/FibRoomSession';
import { FibRules } from '../screens/FibRulesScreen';
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
  const [information, setInformation] = useState<'guide' | 'configuration' | null>(null);
  const hasDealt =
    screen.phase === 'viewing' || screen.phase === 'ongoing' || screen.phase === 'ended';
  const board = (
    <BoardInfoContent
      sections={createFibBoardInfoSections(screen.playerCount)}
      onRolePress={(roleId) => {
        if (isFibRole(roleId)) setPreviewRole(roleId);
      }}
      footer={null}
    />
  );

  return (
    <RoomShell
      model={screen.shellModel}
      showPlayerHand={!screen.isGuessing}
      configurationEntry={
        hasDealt && !screen.isGuessing ? { onOpen: () => setInformation('configuration') } : null
      }
      manualEntries={[
        { label: '玩法', onOpen: () => setInformation('guide'), testId: TESTIDS.fibRulesButton },
      ]}
      leadingExtraActions={null}
      trailingExtraActions={null}
      profileDetailsRenderer={(userId, onGamesPlayedChange) => (
        <FibStatsPanel userId={userId} onGamesPlayedChange={onGamesPlayedChange} />
      )}
      content={{
        kind: 'seats',
        contextHeader: null,
        bottomSummary: null,
        afterSeatBoard: null,
        sideInspector: null,
        beforeSeatBoard: (
          <FibRoomSummary
            phase={screen.phase}
            playerCount={screen.playerCount}
            preparationStage={screen.preparationStage}
            preparationFailureCode={screen.preparationFailureCode}
            guide={null}
          >
            {board}
          </FibRoomSummary>
        ),
      }}
      gameOverlays={
        <>
          {information === 'guide' && (
            <RoomDialog
              title="瞎掰王玩法"
              onClose={() => setInformation(null)}
              allowEscape
              footer={null}
            >
              <FibRules embedded />
            </RoomDialog>
          )}
          {information === 'configuration' && (
            <RoomDialog
              title="本局配置"
              onClose={() => setInformation(null)}
              allowEscape
              footer={null}
            >
              <p>{`瞎掰王（${screen.playerCount}人）`}</p>
              {board}
            </RoomDialog>
          )}
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
