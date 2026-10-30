/**
 * WerewolfRoomScreen — RoomEntryBoundary → useWerewolfRoomState → RoomShell
 * plus the Werewolf overlays (identity card, night review, share, sheriff
 * details, MVP, bottom card, board nominations, strategy).
 *
 * The screen owns only screen-local toggles (skill preview, strategy
 * sheet, nomination list); every room fact comes from the state hook.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import {
  findClosestPresetName,
  GameStatus,
  isValidRoleId,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { createBoardInfoStyles } from '@/features/room/components/boardInfo.styles';
import { BoardInfoCard } from '@/features/room/components/BoardInfoCard';
import { RoomAudioResumeDialog } from '@/features/room/components/RoomAudioResumeDialog';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSummary, RoomGuideButton } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import { BOARD_STRATEGY, BoardStrategyModal } from '@/games/werewolf/components/BoardStrategy';
import { RoleCardSimple } from '@/games/werewolf/components/RoleCardSimple';
import { useSkiaShaderWarmup } from '@/games/werewolf/components/SkiaShaderWarmup';
import { WerewolfProfileDetails } from '@/games/werewolf/components/WerewolfProfileDetails';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import { askAIAboutRole } from '@/games/werewolf/services/aiChatBridge';
import { isAIChatReady } from '@/games/werewolf/services/AIChatService';
import { TESTIDS } from '@/testids';
import { colors, componentSizes, fixed } from '@/theme';
import { isMiniProgram } from '@/utils/miniProgram';

import { BoardNominationModal } from './components/BoardNominationList';
import { ChooseBottomCardModal } from './components/ChooseBottomCardModal';
import { createMvpSelectionStyles, MvpSelectionModal } from './components/MvpSelectionModal';
import { NightReviewModal } from './components/NightReviewModal';
import { NightReviewShareCard } from './components/NightReviewShareCard';
import { ShareProgressModal } from './components/ShareProgressModal';
import { ShareReviewModal } from './components/ShareReviewModal';
import {
  SheriffElectionInspector,
  SheriffElectionSheet,
} from './components/SheriffElectionDetailsSurfaces';
import { SheriffElectionHud } from './components/SheriffElectionHud';
import { createSheriffElectionPanelStyles } from './components/sheriffElectionPanel.styles';
import { WerewolfRoleCardModal } from './components/WerewolfRoleCardModal';
import { useWerewolfRoomState } from './hooks/useWerewolfRoomState';
import { createWerewolfBoardInfoSections, isWerewolfSetup } from './werewolfRoomAdapter';
import { createRoomScreenStyles } from './WerewolfRoomScreen.styles';

const BOARD_STRATEGY_KEYS = new Set(Object.keys(BOARD_STRATEGY));
const STRATEGY_MATCH_THRESHOLD = 0.1;

interface WerewolfRoomScreenProps extends GameRoomScreenProps<'werewolf'> {
  readonly session: WerewolfRoomSession;
  readonly audio: WerewolfAudioRuntime;
}

export const WerewolfRoomScreen: React.FC<WerewolfRoomScreenProps> = ({
  room,
  entryReason,
  navigation,
  session,
  audio,
}) => {
  const handleExit = useCallback(() => exitRoomFlow(navigation), [navigation]);

  return (
    <RoomEntryBoundary room={room} session={session} onExit={handleExit}>
      {(entryController) => (
        <WerewolfRoomContent
          room={room}
          entryReason={entryReason}
          navigation={navigation}
          entryController={entryController}
          session={session}
          audio={audio}
        />
      )}
    </RoomEntryBoundary>
  );
};

interface WerewolfRoomContentProps extends WerewolfRoomScreenProps {
  readonly entryController: RoomEntryController;
}

export const WerewolfRoomContent: React.FC<WerewolfRoomContentProps> = (props) => {
  const { room, navigation } = props;
  const roomCode = room.roomCode;
  const styles = useMemo(() => createRoomScreenStyles(colors), []);
  const boardInfoStyles = useMemo(() => createBoardInfoStyles(colors), []);
  const sheriffElectionStyles = useMemo(() => createSheriffElectionPanelStyles(colors), []);
  const mvpSelectionStyles = useMemo(() => createMvpSelectionStyles(), []);

  // Pre-compile Skia shaders for the reveal animations (no first-frame jank).
  useSkiaShaderWarmup();

  const {
    state,
    viewModel,
    shellModel,
    userId,
    isHost,
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
    nightReview,
    boardNominations,
  } = useWerewolfRoomState(props);
  const status = state.status;

  // ── Screen-local toggles ──
  const [skillPreviewRoleId, setSkillPreviewRoleId] = useState<RoleId | null>(null);
  const openSkillPreview = useCallback((roleId: string) => {
    if (!isValidRoleId(roleId)) throw new Error(`[FAIL-FAST] Invalid role ID: ${roleId}`);
    setSkillPreviewRoleId(roleId);
  }, []);
  const closeSkillPreview = useCallback(() => setSkillPreviewRoleId(null), []);
  const [strategyBoardName, setStrategyBoardName] = useState<string | null>(null);
  const isSetup = isWerewolfSetup(status);
  // The list is a setup-only surface: leaving setup closes it by derivation.
  const [isNominationListRequested, setIsNominationListOpen] = useState(false);
  const isNominationListOpen = isSetup && isNominationListRequested;

  const nominations = state.boardNominations ?? {};
  const nominationCount = Object.keys(nominations).length;
  const hasMyNomination = userId in nominations;

  const matchedStrategyName = useMemo(() => {
    const presetName = findClosestPresetName(state.templateRoles);
    if (presetName !== null && BOARD_STRATEGY_KEYS.has(presetName)) return presetName;
    return findClosestPresetName(
      state.templateRoles,
      STRATEGY_MATCH_THRESHOLD,
      BOARD_STRATEGY_KEYS,
    );
  }, [state.templateRoles]);

  const renderProfileDetails = useCallback(
    (statsUserId: string) => <WerewolfProfileDetails userId={statsUserId} />,
    [],
  );

  const seatCount = viewModel.template.numberOfPlayers;
  const isBoardCollapsed =
    status === GameStatus.Ongoing || status === GameStatus.Day || status === GameStatus.Ended;

  return (
    <RoomShell
      model={shellModel}
      profileDetailsRenderer={renderProfileDetails}
      content={{
        kind: 'seats',
        contextHeader:
          sheriffElectionPanel === null ? null : (
            <SheriffElectionHud
              model={sheriffElectionPanel}
              styles={sheriffElectionStyles}
              onOpenDetails={isSheriffInspectorVisible ? null : openSheriffDetails}
            />
          ),
        beforeSeatBoard: (
          <RoomGameSummary
            icon="moon-outline"
            title={`狼人杀 · ${seatCount}人局`}
            subtitle={findClosestPresetName(state.templateRoles) ?? '自定义配置'}
            headerRight={
              <RoomGuideButton
                onPress={() => navigation.navigate('GameGuide', { gameType: 'werewolf', roomCode })}
                testID={TESTIDS.roomEncyclopediaButton}
                label="角色百科"
              />
            }
          >
            <BoardInfoCard
              playerCount={seatCount}
              sections={createWerewolfBoardInfoSections(state.templateRoles)}
              collapsed={isBoardCollapsed}
              onRolePress={openSkillPreview}
              onNotepadPress={() =>
                navigation.navigate('GameNotepad', { gameType: 'werewolf', roomCode })
              }
              onStrategyPress={
                matchedStrategyName === null
                  ? undefined
                  : () => setStrategyBoardName(matchedStrategyName)
              }
              styles={boardInfoStyles}
              footer={
                isSetup ? (
                  <>
                    <TouchableOpacity
                      style={boardInfoStyles.nominationBtn}
                      onPress={() =>
                        navigation.navigate('GameConfig', {
                          gameType: 'werewolf',
                          mode: 'nominate',
                          roomCode,
                        })
                      }
                      activeOpacity={fixed.activeOpacity}
                    >
                      <Ionicons
                        name={hasMyNomination ? 'create-outline' : 'bulb-outline'}
                        size={componentSizes.icon.sm}
                        color={colors.primary}
                      />
                      <Text style={boardInfoStyles.nominationBtnText}>
                        {hasMyNomination ? '修改建议' : '我来建议'}
                      </Text>
                    </TouchableOpacity>
                    {nominationCount > 0 && (
                      <TouchableOpacity
                        style={boardInfoStyles.nominationBtn}
                        onPress={() => setIsNominationListOpen(true)}
                        activeOpacity={fixed.activeOpacity}
                      >
                        <Ionicons
                          name="list-outline"
                          size={componentSizes.icon.sm}
                          color={colors.primary}
                        />
                        <Text style={boardInfoStyles.nominationBtnText}>
                          查看建议 ({nominationCount})
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : null
              }
            />
          </RoomGameSummary>
        ),
        afterSeatBoard: null,
        sideInspector:
          sheriffElectionPanel === null ? null : (
            <SheriffElectionInspector model={sheriffElectionPanel} styles={sheriffElectionStyles} />
          ),
      }}
      leadingExtraActions={
        isHost ? (
          <Button
            variant="icon"
            onPress={bgm.isBgmPlaying ? bgm.stopBgm : bgm.playBgm}
            testID={TESTIDS.bgmToggleButton}
            accessibilityLabel={bgm.isBgmPlaying ? '暂停音乐' : '播放音乐'}
          >
            <Ionicons
              name={bgm.isBgmPlaying ? 'pause' : 'musical-notes'}
              size={componentSizes.icon.md}
              color={bgm.isBgmPlaying ? colors.primary : colors.text}
            />
          </Button>
        ) : null
      }
      trailingExtraActions={null}
      gameOverlays={
        <>
          {mvpSelection !== null && (
            <MvpSelectionModal
              {...mvpSelection}
              isSubmitting={isHostActionSubmitting}
              onClose={closeMvpSelection}
              styles={mvpSelectionStyles}
            />
          )}
          {sheriffElectionPanel !== null && !isSheriffInspectorVisible && (
            <SheriffElectionSheet
              visible={isSheriffDetailsVisible}
              model={sheriffElectionPanel}
              styles={sheriffElectionStyles}
              onClose={closeSheriffDetails}
            />
          )}

          <RoomAudioResumeDialog
            visible={audioResume.isDue}
            onContinue={audioResume.continueGame}
          />

          {(roleCard.viewing.isOpen || roleCard.viewing.isPending) && roleCard.roleId !== null && (
            <WerewolfRoleCardModal
              visible={roleCard.viewing.isOpen}
              isLoading={roleCard.viewing.isPending}
              roleId={roleCard.roleId}
              resolvedAnimation={roleCard.resolvedAnimation}
              shouldPlayAnimation={roleCard.viewing.shouldPlayAnimation}
              allRoleIds={[...state.templateRoles]}
              remainingCards={roleCard.viewing.remainingCards}
              onClose={roleCard.viewing.close}
              seerLabelMap={state.seerLabelMap}
            />
          )}

          <RoleCardSimple
            visible={skillPreviewRoleId !== null}
            roleId={skillPreviewRoleId}
            onClose={closeSkillPreview}
            showRealIdentity
            onAskAI={
              isAIChatReady() ? (roleId) => askAIAboutRole(roleId, closeSkillPreview) : undefined
            }
          />

          {nightReview.isVisible && nightReview.data !== null && (
            <NightReviewModal
              visible={nightReview.isVisible}
              data={nightReview.data}
              onClose={nightReview.close}
            />
          )}

          {nightReview.isCapturingShareCard && nightReview.data !== null && (
            <View style={styles.hiddenShareCardContainer}>
              <NightReviewShareCard
                ref={nightReview.shareCardRef}
                data={nightReview.data}
                roomCode={roomCode}
              />
            </View>
          )}

          {nightReview.shareRun !== null && isMiniProgram() && (
            <ShareProgressModal run={nightReview.shareRun} onCancel={nightReview.cancelShare} />
          )}

          {nightReview.isShareSeatsVisible && (
            <ShareReviewModal
              visible={nightReview.isShareSeatsVisible}
              seats={[...nightReview.shareSeats]}
              currentAllowedSeats={state.nightReviewAllowedSeats ?? []}
              onConfirm={nightReview.shareToSeats}
              onClose={nightReview.closeShareSeats}
            />
          )}

          {isNominationListOpen && (
            <BoardNominationModal
              visible={isNominationListOpen}
              nominations={nominations}
              myUserId={userId}
              isHost={isHost}
              onUpvote={boardNominations.upvote}
              onWithdraw={boardNominations.withdraw}
              onAdopt={boardNominations.adopt}
              onClose={() => setIsNominationListOpen(false)}
            />
          )}

          {night.chooseCardModal !== null && (
            <ChooseBottomCardModal
              visible
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
};
