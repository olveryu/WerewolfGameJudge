/**
 * WerewolfRoomScreen — RoomEntryBoundary → useWerewolfRoomState → RoomShell plus the Werewolf
 * overlays (identity card, the shared review, review access grants, sheriff details, MVP, bottom
 * card, board nominations, strategy).
 *
 * The screen owns only screen-local toggles (skill preview, strategy sheet, nomination list);
 * every room fact comes from the state hook.
 */
import './WerewolfRoomScreen.css';

import { Portal } from '@ark-ui/react/portal';
import {
  findClosestPresetName,
  type GameState,
  GameStatus,
  getWerewolfDaytimeAnnouncements,
  isValidRoleId,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { AppDialog } from '@/components/AppDialog';
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
import { StepCardPicker } from '@/features/room/steps/StepCardPicker';
import { STEP_CANCEL_SELECTION_ACTION_KEY } from '@/features/room/steps/useStepInteraction';
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
import { MvpSelectionModal } from './components/MvpSelectionModal';
import { ShareReviewModal } from './components/ShareReviewModal';
import { SheriffElectionDialog } from './components/SheriffElectionDetailsSurfaces';
import { SheriffElectionPanel } from './components/SheriffElectionPanel';
import { WerewolfRoleCardModal } from './components/WerewolfRoleCardModal';
import { buildSheriffElectionBoardStatus } from './day/sheriffElectionBoardStatus';
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
  const publicAnnouncements =
    status === GameStatus.Day || status === GameStatus.Ended
      ? getWerewolfDaytimeAnnouncements(state).filter(
          (announcement) => announcement.timing === 'beforeSheriff',
        )
      : [];

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
  const phaseLabel = isSetup
    ? '待开局'
    : status === GameStatus.Assigned
      ? '已发牌'
      : status === GameStatus.Ready
        ? '准备开局'
        : status === GameStatus.Ongoing
          ? '夜晚'
          : status === GameStatus.Day
            ? '白天'
            : '本局结束';
  // 竞选存在于白天及其后的终局；有竞选时它就是唯一状态条的内容。
  const sheriffBoardStatus =
    sheriffElectionPanel === null
      ? null
      : buildSheriffElectionBoardStatus(sheriffElectionPanel, isHost, phaseLabel);

  return (
    <RoomShell
      model={shellModel}
      actionSurface={shellModel.isAudioPlaying ? 'hidden' : 'hand'}
      phaseLabel={phaseLabel}
      lobbyAction={isSetup ? { label: '分配角色', occupiedSeats: viewModel.seats.length } : null}
      selectionMode={
        night.seatSelection !== null
          ? { kind: 'player', escapeActionKey: STEP_CANCEL_SELECTION_ACTION_KEY }
          : undefined
      }
      directory={{
        main: isSetup
          ? [
              {
                key: 'nomination-editor',
                label: nominationLabel,
                category: 'resource',
                icon: 'create-outline',
                opensDialog: true,
                state: {
                  kind: 'ready',
                  onPress: () => setNominationEditorTitle(nominationLabel),
                },
              },
              ...(nominationCount === 0
                ? []
                : [
                    {
                      key: 'nomination-list',
                      label: `查看建议 (${nominationCount})`,
                      category: 'resource' as const,
                      icon: 'eye-outline' as const,
                      opensDialog: true,
                      state: {
                        kind: 'ready' as const,
                        onPress: () => setIsNominationListOpen(true),
                      },
                    },
                  ]),
            ]
          : sheriffElectionPanel !== null
            ? [
                {
                  key: 'sheriff-details',
                  label: '警长详情',
                  category: 'resource',
                  icon: 'document-text-outline',
                  testID: TESTIDS.sheriffDetailsButton,
                  opensDialog: true,
                  state: { kind: 'ready', onPress: openSheriffDetails },
                },
              ]
            : [],
        manual: [
          {
            key: 'guide',
            label: '玩法',
            category: 'resource',
            icon: 'book-outline',
            testID: TESTIDS.roomEncyclopediaButton,
            opensDialog: true,
            state: { kind: 'ready', onPress: () => setIsGuideOpen(true) },
          },
          ...(matchedStrategyName === null
            ? []
            : [
                {
                  key: 'strategy',
                  label: '攻略',
                  category: 'resource' as const,
                  icon: 'bulb-outline' as const,
                  opensDialog: true,
                  state: {
                    kind: 'ready' as const,
                    onPress: () => setStrategyBoardName(matchedStrategyName),
                  },
                },
              ]),
          ...(canOpenNotepad
            ? [
                {
                  key: 'notepad',
                  label: '笔记',
                  category: 'resource' as const,
                  icon: 'document-text-outline' as const,
                  testID: TESTIDS.werewolfNotepadButton,
                  opensDialog: true,
                  state: {
                    kind: 'ready' as const,
                    onPress: () => setIsNotepadOpen(true),
                  },
                },
              ]
            : []),
        ],
        openConfiguration:
          useConfigurationDialog && night.seatSelection === null
            ? () => setIsConfigurationOpen(true)
            : null,
      }}
      content={{
        kind: 'seats',
        boardStatus: sheriffBoardStatus,
        statusNotices: publicAnnouncements.map((announcement) => ({
          key: announcement.key,
          text: announcement.message,
        })),
        statusIcon: status === GameStatus.Ongoing ? 'moon-outline' : 'time-outline',
        contextHeader:
          sheriffElectionPanel === null && remainingSeconds === null ? null : (
            <StageSettleRescue
              remainingSeconds={remainingSeconds}
              isOverdue={isOverdue}
              isHost={isHost}
              isRetrying={isHostActionSubmitting}
              onRetry={() =>
                void submit('重新推进', { type: 'werewolf.phase.retrySettle' }, { actionKey: null })
              }
              waitingLabel="等待推进…"
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
          {sheriffElectionPanel !== null && isSheriffDetailsVisible && (
            <SheriffElectionDialog model={sheriffElectionPanel} onClose={closeSheriffDetails} />
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
              confirmDisabled={roleCard.viewing.isConfirmationDisabled}
              onClose={roleCard.viewing.close}
              seerLabelMap={state.seerLabelMap}
            />
          )}

          {isConfigurationOpen && (
            <RoomDialog
              title="本局配置"
              subtitle={`狼人杀（${seatCount}人）`}
              onClose={() => setIsConfigurationOpen(false)}
              dismissOnEscape
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

          {night.cardPicker !== null && <StepCardPicker {...night.cardPicker} />}

          {isGuideOpen && (
            <RoomDialog
              title="狼人杀玩法"
              onClose={() => setIsGuideOpen(false)}
              dismissOnEscape
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
              dismissOnEscape
              footer={null}
            >
              <BoardStrategyContent boardName={strategyBoardName} />
            </RoomDialog>
          )}
          {state.sheriffElection?.phase === 'result' && sheriffElectionPanel !== null && (
            <AppDialog.Root
              open
              onEscapeKeyDown={(event) => event.preventDefault()}
              onInteractOutside={(event) => event.preventDefault()}
            >
              <Portal>
                <AppDialog.Backdrop className="center-dialog-backdrop" />
                <AppDialog.Positioner className="center-dialog-positioner">
                  <AppDialog.Content
                    className="center-dialog"
                    aria-describedby={undefined}
                    data-testid={TESTIDS.sheriffResultDialog}
                  >
                    <AppDialog.Title>警长竞选结果</AppDialog.Title>
                    <p>{sheriffElectionPanel.view.phaseDescription}</p>
                    <SheriffElectionPanel model={sheriffElectionPanel} />
                    <p>
                      {remainingSeconds === null || remainingSeconds === 0
                        ? '等待进入下一阶段…'
                        : `${remainingSeconds} 秒后继续`}
                    </p>
                  </AppDialog.Content>
                </AppDialog.Positioner>
              </Portal>
            </AppDialog.Root>
          )}
        </>
      }
    />
  );
}
