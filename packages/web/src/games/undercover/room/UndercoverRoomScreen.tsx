/** Undercover room mounts exclusively through shared authentication, session and shell boundaries. */
import {
  getUndercoverOccupiedSeatCount,
  UNDERCOVER_CATEGORY_NAMES,
  type UndercoverRole,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { BoardInfoCard } from '@/features/room/components/BoardInfoCard';
import { RoleCardDialog } from '@/features/room/components/RoleCard';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSummary, RoomGuideButton } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { deriveRemainingRevealCards } from '@/features/room/model/RevealRoleData';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import { TESTIDS } from '@/testids';

import type { UndercoverRoomSession } from '../model/UndercoverRoomSession';
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
    openRules,
    reviewOverlay,
  } = useUndercoverRoomState(props);
  // BoardInfo 角色预览（纯展示状态）：只显示种类说明，不走身份查看协议。
  const [previewRole, setPreviewRole] = useState<UndercoverRole | null>(null);
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
              subtitle={`${formatUndercoverBlankMode(state.config.hasBlank)} · ${UNDERCOVER_CATEGORY_NAMES[state.config.category]}`}
              testId="undercover-room"
              headerRight={
                <RoomGuideButton
                  onPress={openRules}
                  label="查看谁是卧底玩法说明"
                  testId={TESTIDS.roomGuideButton('undercover')}
                />
              }
            />
            <BoardInfoCard
              playerCount={state.config.numberOfPlayers}
              sections={createUndercoverBoardInfoSections({
                roleCounts,
                hasBlank: state.config.hasBlank,
              })}
              collapsed={false}
              onRolePress={(roleId) => {
                if (isUndercoverRole(roleId)) setPreviewRole(roleId);
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
