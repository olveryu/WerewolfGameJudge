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
import { BoardInfoContent } from '@/features/room/components/BoardInfoContent';
import { RoomAudioResumeDialog } from '@/features/room/components/RoomAudioResumeDialog';
import { RoomDialog } from '@/features/room/components/RoomDialog';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSummary } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import { StageSettleRescue } from '@/features/room/components/StageSettleRescue';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import { BoardStrategyContent } from '@/games/werewolf/components/BoardStrategy/BoardStrategyContent';
import { BOARD_STRATEGY } from '@/games/werewolf/components/BoardStrategy/boardStrategyData';
import { RoleCardSimple } from '@/games/werewolf/components/RoleCardSimple';
import { WerewolfProfileDetails } from '@/games/werewolf/components/WerewolfProfileDetails';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import { ConfigScreen } from '@/games/werewolf/screens/ConfigScreen/ConfigScreen';
import { WerewolfEncyclopedia } from '@/games/werewolf/screens/EncyclopediaScreen/EncyclopediaScreen';
import { WerewolfNotepad } from '@/games/werewolf/screens/NotepadScreen/NotepadScreen';
import { TESTIDS } from '@/testids';
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

const renderProfileDetails = (
  statsUserId: string,
  onGamesPlayedChange: (gamesPlayed: number | null) => void,
) => <WerewolfProfileDetails userId={statsUserId} onGamesPlayedChange={onGamesPlayedChange} />;

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
  const [skillPreviewRoleId, setSkillPreviewRoleId] = useState<RoleId | null>(null);
  const [strategyBoardName, setStrategyBoardName] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [isConfigurationOpen, setIsConfigurationOpen] = useState(false);
  const [isNominationListOpen, setIsNominationListOpen] = useState(false);
  const [nominationEditorTitle, setNominationEditorTitle] = useState<string | null>(null);
  const isReadingRoomInformation =
    skillPreviewRoleId !== null ||
    strategyBoardName !== null ||
    isGuideOpen ||
    isNotepadOpen ||
    isConfigurationOpen ||
    isNominationListOpen ||
    nominationEditorTitle !== null;
  const {
    state,
    viewModel,
    shellModel,
    roomCode,
    roomId,
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
  } = useWerewolfRoomState(props, isReadingRoomInformation);
  const status = state.status;

  // ── Screen-local toggles ──
  const openSkillPreview = (roleId: string) => {
    if (!isValidRoleId(roleId)) throw new Error(`[FAIL-FAST] Invalid role ID: ${roleId}`);
    setSkillPreviewRoleId(roleId);
  };
  const canOpenNotepad = status === GameStatus.Day || status === GameStatus.Ended;
  const isSetup = isWerewolfSetup(status);

  const nominations = state.boardNominations ?? {};
  const nominationCount = Object.keys(nominations).length;
  const hasMyNomination = userId in nominations;
  const nominationLabel = hasMyNomination ? '修改建议' : '我来建议';
  const matchedStrategyName = matchStrategyBoard(state.templateRoles);

  const seatCount = viewModel.template.numberOfPlayers;
  const useConfigurationDialog =
    status === GameStatus.Ongoing || status === GameStatus.Day || status === GameStatus.Ended;
  const boardSections = createWerewolfBoardInfoSections(state.templateRoles);
  const skillPreview = (
    <RoleCardSimple
      visible={skillPreviewRoleId !== null}
      roleId={skillPreviewRoleId}
      onClose={() => setSkillPreviewRoleId(null)}
      showRealIdentity
    />
  );

  return (
    <RoomShell
      model={shellModel}
      showPlayerHand
      isSelecting={night.seatSelection !== null}
      mainEntries={
        isSetup
          ? [
              { label: nominationLabel, onOpen: () => setNominationEditorTitle(nominationLabel) },
              ...(nominationCount === 0
                ? []
                : [
                    {
                      label: `查看建议 (${nominationCount})`,
                      onOpen: () => setIsNominationListOpen(true),
                    },
                  ]),
            ]
          : []
      }
      manualEntries={[
        {
          label: '玩法',
          testId: TESTIDS.roomEncyclopediaButton,
          onOpen: () => setIsGuideOpen(true),
        },
        ...(matchedStrategyName === null
          ? []
          : [{ label: '攻略', onOpen: () => setStrategyBoardName(matchedStrategyName) }]),
        ...(canOpenNotepad ? [{ label: '笔记', onOpen: () => setIsNotepadOpen(true) }] : []),
      ]}
      configurationEntry={
        useConfigurationDialog && night.seatSelection === null
          ? { onOpen: () => setIsConfigurationOpen(true) }
          : null
      }
      content={{
        kind: 'seats',
        contextHeader:
          sheriffElectionPanel === null && remainingSeconds === null ? null : (
            <StageSettleRescue
              remainingSeconds={remainingSeconds}
              isOverdue={isOverdue}
              isHost={isHost}
              isRetrying={isHostActionSubmitting}
              onRetry={() => void submit('重新推进', { type: 'werewolf.phase.retrySettle' })}
              waitingLabel="等待推进…"
            />
          ),
        bottomSummary:
          sheriffElectionPanel === null ? null : (
            <SheriffElectionHud
              model={sheriffElectionPanel}
              onOpenDetails={isSheriffInspectorVisible ? null : openSheriffDetails}
            />
          ),
        beforeSeatBoard: (
          <>
            {!useConfigurationDialog && (
              <RoomGameSummary title="狼人杀" playerCount={seatCount} guide={null}>
                <BoardInfoContent
                  sections={boardSections}
                  onRolePress={openSkillPreview}
                  footer={null}
                />
              </RoomGameSummary>
            )}
          </>
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

          {isConfigurationOpen && (
            <RoomDialog
              title="本局配置"
              subtitle={`狼人杀（${seatCount}人）`}
              onClose={() => setIsConfigurationOpen(false)}
              footer={null}
            >
              <BoardInfoContent
                sections={boardSections}
                onRolePress={openSkillPreview}
                footer={null}
              />
              {skillPreview}
            </RoomDialog>
          )}

          {!isConfigurationOpen && skillPreview}

          {reviewAccess.overlay}

          {reviewAccess.isGrantVisible && (
            <ShareReviewModal
              seats={reviewAccess.grantSeats}
              currentAllowedSeats={state.nightReviewAllowedSeats ?? []}
              onConfirm={reviewAccess.grantSeatsAccess}
              onClose={reviewAccess.closeGrant}
            />
          )}

          {nominationEditorTitle !== null && (
            <ConfigScreen
              session={props.session}
              params={{ nominateMode: { roomCode } }}
              exitPath={`/room/${roomCode}`}
              onPickBoard={() => {}}
              onContinue={() => {}}
              onReturnToRoom={() => setNominationEditorTitle(null)}
              nominationDialog={{
                title: nominationEditorTitle,
                onClose: () => setNominationEditorTitle(null),
              }}
            />
          )}
          {isNominationListOpen && (
            <BoardNominationModal
              nominations={nominations}
              myUserId={userId}
              isHost={isHost}
              isReadOnly={!isSetup}
              onUpvote={boardNominations.upvote}
              onWithdraw={boardNominations.withdraw}
              onAdopt={boardNominations.adopt}
              onClose={() => setIsNominationListOpen(false)}
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

          {isGuideOpen && (
            <RoomDialog
              title="狼人杀玩法"
              onClose={() => setIsGuideOpen(false)}
              allowEscape
              footer={null}
            >
              <WerewolfEncyclopedia gameState={state} isHost={isHost} hasRoomContext />
            </RoomDialog>
          )}
          {isNotepadOpen && (
            <WerewolfNotepad
              activeNotepadRoom={{ roomId, userId, gameState: state }}
              surface={{ kind: 'dialog', onClose: () => setIsNotepadOpen(false) }}
            />
          )}
          {strategyBoardName !== null && (
            <RoomDialog
              title={`${strategyBoardName} · 攻略`}
              onClose={() => setStrategyBoardName(null)}
              allowEscape
              footer={null}
            >
              <BoardStrategyContent boardName={strategyBoardName} />
            </RoomDialog>
          )}
        </>
      }
    />
  );
}
