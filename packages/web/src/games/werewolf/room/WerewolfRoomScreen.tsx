/**
 * WerewolfRoomScreen — RoomEntryBoundary → useWerewolfRoomState → RoomShell plus the Werewolf
 * overlays (identity card, the shared review, review access grants, sheriff details, MVP, bottom
 * card, board nominations, strategy).
 *
 * The screen owns only screen-local toggles (skill preview, strategy sheet, nomination list);
 * every room fact comes from the state hook.
 */
import './WerewolfRoomScreen.css';

import {
  findClosestPresetName,
  type GameState,
  GameStatus,
  isValidRoleId,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { IconButton } from '@/components/IconButton';
import { gameGuidePath, gameNotepadPath } from '@/features/navigation/model/gamePaths';
import { BoardInfoCard } from '@/features/room/components/BoardInfoCard';
import { RoomAudioResumeDialog } from '@/features/room/components/RoomAudioResumeDialog';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSummary, RoomGuideButton } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import { StageSettleRescue } from '@/features/room/components/StageSettleRescue';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import { BOARD_STRATEGY } from '@/games/werewolf/components/BoardStrategy/boardStrategyData';
import { BoardStrategyModal } from '@/games/werewolf/components/BoardStrategy/BoardStrategyModal';
import { RoleCardSimple } from '@/games/werewolf/components/RoleCardSimple';
import { WerewolfProfileDetails } from '@/games/werewolf/components/WerewolfProfileDetails';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import { werewolfNominatePath } from '@/games/werewolf/navigation/werewolfConfigFlow';
import { TESTIDS } from '@/testids';
import IconBulbOutline from '~icons/ion/bulb-outline';
import IconCreateOutline from '~icons/ion/create-outline';
import IconListOutline from '~icons/ion/list-outline';
import IconMusicalNotes from '~icons/ion/musical-notes';
import IconPause from '~icons/ion/pause';

import { BoardNominationModal } from './components/BoardNominationList';
import { ChooseBottomCardModal } from './components/ChooseBottomCardModal';
import { MvpSelectionModal } from './components/MvpSelectionModal';
import { ShareReviewModal } from './components/ShareReviewModal';
import {
  SheriffElectionInspector,
  SheriffElectionSheet,
} from './components/SheriffElectionDetailsSurfaces';
import { SheriffElectionHud } from './components/SheriffElectionHud';
import { WerewolfRoleCardModal } from './components/WerewolfRoleCardModal';
import { useWerewolfRoomState } from './hooks/useWerewolfRoomState';
import { createWerewolfBoardInfoSections, isWerewolfSetup } from './werewolfRoomAdapter';

const BOARD_STRATEGY_KEYS = new Set(Object.keys(BOARD_STRATEGY));
const STRATEGY_MATCH_THRESHOLD = 0.1;

const renderProfileDetails = (statsUserId: string) => (
  <WerewolfProfileDetails userId={statsUserId} />
);

type WerewolfRoomScreenProps = GameRoomScreenProps<'werewolf'> & {
  readonly session: WerewolfRoomSession;
  /** The module's declared review (defineClientGameModule `review`); the room renders only it. */
  readonly review: RoomReviewContribution<GameState>;
  readonly audio: WerewolfAudioRuntime;
};

/** The shared entry lifecycle handles direct links, joining and reconnects. */
export function WerewolfRoomScreen(props: WerewolfRoomScreenProps) {
  const navigate = useNavigate();
  return (
    <RoomEntryBoundary
      room={props.room}
      session={props.session}
      onExit={() => exitRoomFlow(navigate)}
    >
      {(entryController) => <WerewolfRoomContent {...props} entryController={entryController} />}
    </RoomEntryBoundary>
  );
}

function matchStrategyBoard(templateRoles: GameState['templateRoles']): string | null {
  const presetName = findClosestPresetName(templateRoles);
  if (presetName !== null && BOARD_STRATEGY_KEYS.has(presetName)) return presetName;
  return findClosestPresetName(templateRoles, STRATEGY_MATCH_THRESHOLD, BOARD_STRATEGY_KEYS);
}

function WerewolfRoomContent(
  props: WerewolfRoomScreenProps & { readonly entryController: RoomEntryController },
) {
  const navigate = useNavigate();
  const {
    state,
    viewModel,
    shellModel,
    roomCode,
    userId,
    isHost,
    remainingSeconds,
    isOverdue,
    submit,
    bgm,
    roleCard,
    audioResume,
    night,
    sheriffElectionPanel,
    isSheriffInspectorVisible,
    isSheriffDetailsVisible,
    openSheriffDetails,
    closeSheriffDetails,
    mvpSelection,
    closeMvpSelection,
    isHostActionSubmitting,
    reviewAccess,
    boardNominations,
  } = useWerewolfRoomState(props);
  const status = state.status;

  // ── Screen-local toggles ──
  const [skillPreviewRoleId, setSkillPreviewRoleId] = useState<RoleId | null>(null);
  const openSkillPreview = (roleId: string) => {
    if (!isValidRoleId(roleId)) throw new Error(`[FAIL-FAST] Invalid role ID: ${roleId}`);
    setSkillPreviewRoleId(roleId);
  };
  const [strategyBoardName, setStrategyBoardName] = useState<string | null>(null);
  const isSetup = isWerewolfSetup(status);
  // The list is a setup-only surface: leaving setup closes it by derivation.
  const [isNominationListRequested, setIsNominationListRequested] = useState(false);
  const isNominationListOpen = isSetup && isNominationListRequested;

  const nominations = state.boardNominations ?? {};
  const nominationCount = Object.keys(nominations).length;
  const hasMyNomination = userId in nominations;
  const matchedStrategyName = matchStrategyBoard(state.templateRoles);

  const seatCount = viewModel.template.numberOfPlayers;
  const isBoardCollapsed =
    status === GameStatus.Ongoing || status === GameStatus.Day || status === GameStatus.Ended;

  return (
    <RoomShell
      model={shellModel}
      content={{
        kind: 'seats',
        contextHeader:
          sheriffElectionPanel === null && remainingSeconds === null ? null : (
            <>
              {sheriffElectionPanel !== null && (
                <SheriffElectionHud
                  model={sheriffElectionPanel}
                  onOpenDetails={isSheriffInspectorVisible ? null : openSheriffDetails}
                />
              )}
              <StageSettleRescue
                remainingSeconds={remainingSeconds}
                isOverdue={isOverdue}
                isHost={isHost}
                isRetrying={isHostActionSubmitting}
                onRetry={() => void submit('重新推进', { type: 'werewolf.phase.retrySettle' })}
                waitingLabel="等待推进…"
              />
            </>
          ),
        beforeSeatBoard: (
          <RoomGameSummary
            icon="moon-outline"
            title={`狼人杀 · ${seatCount}人局`}
            subtitle={findClosestPresetName(state.templateRoles) ?? '自定义配置'}
            headerRight={
              <RoomGuideButton
                onPress={() => void navigate(gameGuidePath('werewolf', roomCode))}
                testId={TESTIDS.roomEncyclopediaButton}
                label="角色百科"
              />
            }
          >
            <BoardInfoCard
              playerCount={seatCount}
              sections={createWerewolfBoardInfoSections(state.templateRoles)}
              collapsed={isBoardCollapsed}
              onRolePress={openSkillPreview}
              onStrategyPress={
                matchedStrategyName === null
                  ? null
                  : () => setStrategyBoardName(matchedStrategyName)
              }
              onNotepadPress={() => void navigate(gameNotepadPath('werewolf', roomCode))}
              footer={
                isSetup && (
                  <>
                    <button
                      type="button"
                      className="werewolf-nomination-button"
                      onClick={() => void navigate(werewolfNominatePath(roomCode))}
                    >
                      {hasMyNomination ? (
                        <IconCreateOutline aria-hidden />
                      ) : (
                        <IconBulbOutline aria-hidden />
                      )}
                      {hasMyNomination ? '修改建议' : '我来建议'}
                    </button>
                    {nominationCount > 0 && (
                      <button
                        type="button"
                        className="werewolf-nomination-button"
                        onClick={() => setIsNominationListRequested(true)}
                      >
                        <IconListOutline aria-hidden />
                        查看建议 ({nominationCount})
                      </button>
                    )}
                  </>
                )
              }
            />
          </RoomGameSummary>
        ),
        afterSeatBoard: null,
        sideInspector:
          sheriffElectionPanel === null ? null : (
            <SheriffElectionInspector model={sheriffElectionPanel} />
          ),
      }}
      leadingExtraActions={
        isHost &&
        status === GameStatus.Ongoing && (
          <IconButton
            className="werewolf-bgm-toggle"
            data-playing={bgm.isBgmPlaying}
            label={bgm.isBgmPlaying ? '暂停音乐' : '播放音乐'}
            icon={bgm.isBgmPlaying ? <IconPause aria-hidden /> : <IconMusicalNotes aria-hidden />}
            onClick={bgm.isBgmPlaying ? bgm.stopBgm : bgm.playBgm}
            data-testid={TESTIDS.bgmToggleButton}
          />
        )
      }
      trailingExtraActions={null}
      profileDetailsRenderer={renderProfileDetails}
      gameOverlays={
        <>
          {mvpSelection !== null && (
            <MvpSelectionModal
              participants={mvpSelection.participants}
              goldenDraws={mvpSelection.goldenDraws}
              onSelect={mvpSelection.onSelect}
              isSubmitting={isHostActionSubmitting}
              onClose={closeMvpSelection}
            />
          )}
          {sheriffElectionPanel !== null &&
            !isSheriffInspectorVisible &&
            isSheriffDetailsVisible && (
              <SheriffElectionSheet model={sheriffElectionPanel} onClose={closeSheriffDetails} />
            )}

          <RoomAudioResumeDialog
            visible={audioResume.isDue}
            onContinue={audioResume.continueGame}
          />

          {(roleCard.viewing.isOpen || roleCard.viewing.isPending) && roleCard.roleId !== null && (
            <WerewolfRoleCardModal
              isLoading={roleCard.viewing.isPending}
              roleId={roleCard.roleId}
              resolvedAnimation={roleCard.resolvedAnimation}
              shouldPlayAnimation={roleCard.viewing.shouldPlayAnimation}
              allRoleIds={state.templateRoles}
              remainingCards={roleCard.viewing.remainingCards}
              onClose={roleCard.viewing.close}
              seerLabelMap={state.seerLabelMap}
            />
          )}

          <RoleCardSimple
            visible={skillPreviewRoleId !== null}
            roleId={skillPreviewRoleId}
            onClose={() => setSkillPreviewRoleId(null)}
            showRealIdentity
          />

          {reviewAccess.overlay}

          {reviewAccess.isGrantVisible && (
            <ShareReviewModal
              seats={reviewAccess.grantSeats}
              currentAllowedSeats={state.nightReviewAllowedSeats ?? []}
              onConfirm={reviewAccess.grantSeatsAccess}
              onClose={reviewAccess.closeGrant}
            />
          )}

          {isNominationListOpen && (
            <BoardNominationModal
              nominations={nominations}
              myUserId={userId}
              isHost={isHost}
              onUpvote={boardNominations.upvote}
              onWithdraw={boardNominations.withdraw}
              onAdopt={boardNominations.adopt}
              onClose={() => setIsNominationListRequested(false)}
            />
          )}

          {night.chooseCardModal !== null && (
            <ChooseBottomCardModal
              choice={night.chooseCardModal.model.choice}
              confirmText={night.chooseCardModal.model.confirmText}
              onChoose={night.chooseCardModal.choose}
              onClose={night.chooseCardModal.close}
            />
          )}

          <BoardStrategyModal
            boardName={strategyBoardName}
            onClose={() => setStrategyBoardName(null)}
          />
        </>
      }
    />
  );
}
