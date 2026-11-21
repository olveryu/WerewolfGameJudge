/** Undercover room mounts exclusively through shared authentication, session and shell boundaries. */
import {
  getUndercoverOccupiedSeatCount,
  UNDERCOVER_CATEGORY_NAMES,
  UNDERCOVER_ROLE_NAMES,
  type UndercoverRole,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { BoardInfoContent } from '@/features/room/components/BoardInfoContent';
import { RoleCardDialog } from '@/features/room/components/RoleCard';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSettings, RoomGameSummary } from '@/features/room/components/RoomGameSummary';
import {
  type RoomInformation,
  RoomInformationDialog,
} from '@/features/room/components/RoomInformationDialog';
import { RoomShell } from '@/features/room/components/RoomShell';
import { RoomStatusSummary } from '@/features/room/components/RoomStatusSummary';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { deriveRemainingRevealCards } from '@/features/room/model/RevealRoleData';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import { UndercoverStatsPanel } from '@/games/undercover/components/UndercoverStatsPanel';
import { TESTIDS } from '@/testids';

import type { UndercoverRoomSession } from '../model/UndercoverRoomSession';
import { UndercoverRules } from '../screens/UndercoverRulesScreen';
import { UndercoverRevealModal } from './components/UndercoverRevealModal';
import {
  isUndercoverRole,
  toUndercoverRolePreviewData,
} from './components/UndercoverRoleCardAdapter';
import { UndercoverWordModal } from './components/UndercoverWordModal';
import { useUndercoverRoomState } from './hooks/useUndercoverRoomState';
import { formatUndercoverBlankMode } from './undercoverCopy';
import { createUndercoverBoardInfoSections } from './undercoverRoomAdapter';

interface UndercoverRoomScreenProps extends GameRoomScreenProps<'undercover'> {
  readonly session: UndercoverRoomSession;
  readonly review: RoomReviewContribution<UndercoverState>;
}

/** Mounts the undercover room behind the shared entry lifecycle (direct link, join, reconnect). */
export function UndercoverRoomScreen(props: UndercoverRoomScreenProps) {
  const navigate = useNavigate();
  return (
    <RoomEntryBoundary
      room={props.room}
      session={props.session}
      onExit={() => exitRoomFlow(navigate)}
    >
      {(entryController) => <UndercoverRoomContent {...props} entryController={entryController} />}
    </RoomEntryBoundary>
  );
}

function UndercoverRoomContent(
  props: UndercoverRoomScreenProps & { readonly entryController: RoomEntryController },
) {
  const {
    state,
    shellModel,
    controls,
    isControlled,
    equippedRevealEffect,
    revealPool,
    roleCounts,
    reviewOverlay,
  } = useUndercoverRoomState(props);
  // BoardInfo 角色预览（纯展示状态）：只显示种类说明，不走身份查看协议。
  const [previewRole, setPreviewRole] = useState<UndercoverRole | null>(null);
  const [information, setInformation] = useState<RoomInformation>(null);
  const isPreGame =
    state.phase === 'lobby' ||
    state.phase === 'preparing' ||
    state.phase === 'preparationFailed' ||
    state.phase === 'viewing';
  const settings = [
    { label: '白板模式', value: formatUndercoverBlankMode(state.config.hasBlank) },
    { label: '词语分类', value: UNDERCOVER_CATEGORY_NAMES[state.config.category] },
  ];
  const board = (
    <BoardInfoContent
      sections={createUndercoverBoardInfoSections({
        roleCounts,
        hasBlank: state.config.hasBlank,
      })}
      onRolePress={(roleId) => {
        if (isUndercoverRole(roleId)) setPreviewRole(roleId);
      }}
      footer={null}
    />
  );
  return (
    <RoomShell
      model={shellModel}
      phaseLabel={
        state.phase === 'lobby'
          ? '待开局'
          : state.phase === 'viewing'
            ? '查看词卡'
            : state.phase === 'preparing' || state.phase === 'preparationFailed'
              ? '准备词语'
              : state.phase === 'ended'
                ? '本局结束'
                : '游戏进行中'
      }
      lobbyAction={
        state.phase === 'lobby'
          ? { label: '分配角色', occupiedSeats: getUndercoverOccupiedSeatCount(state) }
          : null
      }
      selectionMode={controls.isSelecting ? 'host-task' : undefined}
      configurationEntry={
        !isPreGame && !controls.isSelecting
          ? { onOpen: () => setInformation('configuration') }
          : null
      }
      manualEntries={[
        {
          label: '玩法',
          onOpen: () => setInformation('guide'),
          testId: TESTIDS.roomGuideButton('undercover'),
        },
      ]}
      leadingExtraActions={null}
      trailingExtraActions={null}
      profileDetailsRenderer={(userId, onGamesPlayedChange) => (
        <UndercoverStatsPanel userId={userId} onGamesPlayedChange={onGamesPlayedChange} />
      )}
      content={{
        kind: 'seats',
        contextHeader: null,
        bottomSummary:
          state.phase === 'ended' ? (
            <RoomStatusSummary
              summary={`${UNDERCOVER_ROLE_NAMES[state.winner]}获胜`}
              action={null}
            />
          ) : null,
        afterSeatBoard: null,
        beforeSeatBoard: (
          <>
            {isPreGame && (
              <RoomGameSummary
                title="谁是卧底"
                playerCount={state.config.numberOfPlayers}
                settings={settings}
                testId="undercover-room"
                guide={null}
              >
                {board}
              </RoomGameSummary>
            )}
          </>
        ),
      }}
      gameOverlays={
        <>
          <RoomInformationDialog
            information={information}
            guideTitle="谁是卧底玩法"
            guide={<UndercoverRules embedded />}
            configuration={
              <>
                <p>{`谁是卧底（${state.config.numberOfPlayers}人）`}</p>
                {board}
                <RoomGameSettings settings={settings} />
              </>
            }
            onClose={() => setInformation(null)}
          />
          {controls.card !== null && (
            <UndercoverWordModal
              card={controls.card}
              effectType={isControlled ? null : equippedRevealEffect}
              shouldPlay={
                state.round !== null && !state.round.confirmedSeats.includes(controls.card.seat)
              }
              allRoles={revealPool}
              remainingCards={deriveRemainingRevealCards(
                getUndercoverOccupiedSeatCount(state),
                state.round?.confirmedSeats.length ?? 0,
              )}
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
          {previewRole !== null && (
            <RoleCardDialog
              role={toUndercoverRolePreviewData(previewRole)}
              onClose={() => setPreviewRole(null)}
              confirmText="知道了"
            />
          )}
          {reviewOverlay}
        </>
      }
    />
  );
}
