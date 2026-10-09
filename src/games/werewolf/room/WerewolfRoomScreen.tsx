/**
 * WerewolfRoomScreen - Main game room screen (thin rendering shell)
 *
 * All hook wiring, derived state, and side-effects live in useWerewolfRoomScreenState.
 * This component only owns: styles, loading/error early returns, and JSX layout.
 * Creates theme-based styles, renders JSX (header, grid, bottom panel, modals),
 * and handles loading/error early returns. Does not wire hooks directly
 * (that's useWerewolfRoomScreenState), does not own local state, and does not import
 * services / policy / helpers.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { findClosestPresetName } from '@game-judge/game-engine/games/werewolf/public';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { AlertModal } from '@/components/AlertModal';
import { Button } from '@/components/Button';
import { useAuthContext } from '@/contexts/AuthContext';
import { createBoardInfoStyles } from '@/features/room/components/boardInfo.styles';
import { BoardInfoCard } from '@/features/room/components/BoardInfoCard';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSummary, RoomGuideButton } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import { BOARD_STRATEGY, BoardStrategyModal } from '@/games/werewolf/components/BoardStrategy';
import { RoleCardSimple } from '@/games/werewolf/components/RoleCardSimple';
import { useSkiaShaderWarmup } from '@/games/werewolf/components/SkiaShaderWarmup';
import { WerewolfProfileDetails } from '@/games/werewolf/components/WerewolfProfileDetails';
import { WerewolfRoleCardModal } from '@/games/werewolf/room/components/WerewolfRoleCardModal';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import { askAIAboutRole } from '@/games/werewolf/services/aiChatBridge';
import { isAIChatReady } from '@/games/werewolf/services/AIChatService';
import { TESTIDS } from '@/testids';
import { colors, componentSizes, fixed } from '@/theme';

import { BoardNominationModal } from './components/BoardNominationList';
import { ChooseBottomCardModal } from './components/ChooseBottomCardModal';
import { createMvpSelectionStyles, MvpSelectionModal } from './components/MvpSelectionModal';
import { NightReviewModal } from './components/NightReviewModal';
import { NightReviewShareCard } from './components/NightReviewShareCard';
import { ShareReviewModal } from './components/ShareReviewModal';
import {
  SheriffElectionInspector,
  SheriffElectionSheet,
} from './components/SheriffElectionDetailsSurfaces';
import { SheriffElectionHud } from './components/SheriffElectionHud';
import { createSheriffElectionPanelStyles } from './components/sheriffElectionPanel.styles';
import { useWerewolfRoomScreenState } from './hooks/useWerewolfRoomScreenState';
import { createRoomScreenStyles } from './WerewolfRoomScreen.styles';

// ── Strategy Modal ───────────────────────────────────────────────────────────
const BOARD_STRATEGY_KEYS = new Set(Object.keys(BOARD_STRATEGY));

interface WerewolfRoomScreenProps extends GameRoomScreenProps<'werewolf'> {
  readonly client: WerewolfGameClient;
}

export const WerewolfRoomScreen: React.FC<WerewolfRoomScreenProps> = ({
  room,
  entryReason,
  navigation,
  client,
}) => {
  const handleExit = useCallback(() => exitRoomFlow(navigation), [navigation]);

  return (
    <RoomEntryBoundary room={room} session={client.roomSession} onExit={handleExit}>
      {(entryController) => (
        <WerewolfRoomContent
          room={room}
          entryReason={entryReason}
          navigation={navigation}
          entryController={entryController}
          client={client}
        />
      )}
    </RoomEntryBoundary>
  );
};

interface WerewolfRoomContentProps extends GameRoomScreenProps<'werewolf'> {
  readonly entryController: RoomEntryController;
  readonly client: WerewolfGameClient;
}

export const WerewolfRoomContent: React.FC<WerewolfRoomContentProps> = ({
  room,
  entryReason,
  navigation,
  entryController,
  client,
}) => {
  const roomCode = room.roomCode;
  const { user } = useAuthContext();
  const styles = useMemo(() => createRoomScreenStyles(colors), []);
  const boardInfoStyles = useMemo(() => createBoardInfoStyles(colors), []);
  const sheriffElectionStyles = useMemo(() => createSheriffElectionPanelStyles(colors), []);

  // Pre-compile Skia GPU shaders for role reveal animations (eliminates first-frame jank).
  // Moved here from App.tsx -- Skia is now lazy-loaded, so warmup runs when Skia is ready.
  useSkiaShaderWarmup();

  // ─── Notepad ──────────────────────────────────────────────────────────
  const handleNotepadPress = useCallback(() => {
    navigation.navigate('GameNotepad', { gameType: 'werewolf', roomCode });
  }, [navigation, roomCode]);

  // ─── Strategy Modal ───────────────────────────────────────────────────
  const [strategyBoardName, setStrategyBoardName] = useState<string | null>(null);

  const handleStrategyClose = useCallback(() => {
    setStrategyBoardName(null);
  }, []);

  const [nominationModalVisible, setNominationModalVisible] = useState(false);
  const hasAutoShownQR = useRef(false);

  const handleEncyclopedia = useCallback(() => {
    navigation.navigate('GameGuide', { gameType: 'werewolf', roomCode });
  }, [navigation, roomCode]);

  const {
    roomShellModel,
    roomShare,
    gameState,
    isHost,
    roomStatus,
    isAudioPlaying,
    resolvedRoleRevealAnimation,
    effectiveSeat,
    effectiveRole,
    currentSchema,
    clearAllSeats,
    boardUpvote,
    boardWithdraw,
    sheriffElectionPanel,
    isSheriffInspectorVisible,
    isSheriffDetailsVisible,
    openSheriffDetails,
    closeSheriffDetails,
    isBgmPlaying,
    playBgm,
    stopBgm,
    villagerCount,
    wolfRoleItems,
    godRoleItems,
    specialRoleItems,
    villagerRoleItems,
    mvpSelection,
    closeMvpSelection,
    isHostActionSubmitting,
    roleCardVisible,
    shouldPlayRevealAnimation,
    isLoadingRole,
    handleRoleCardClose,
    skillPreviewRoleId,
    handleSkillPreviewOpen,
    handleSkillPreviewClose,
    resumeAfterRejoin,
    needsContinueOverlay,
    nightReviewData,
    nightReviewShareCardRef,
    isCapturingShareCard,
    nightReviewVisible,
    closeNightReview,
    shareReviewVisible,
    closeShareReview,
    shareNightReview,
    chooseCardModalVisible,
    closeChooseCardModal,
    handleChooseCard,
    bottomCardDisabledIndices,
    bottomCardDisabledHint,
    bottomCardSubtitle,
  } = useWerewolfRoomScreenState(room, navigation, entryController, client);

  const mvpSelectionStyles = useMemo(() => createMvpSelectionStyles(), []);

  // ─── Board nomination callbacks ────────────────────────────────────────
  const showNominations = roomStatus === GameStatus.Unseated || roomStatus === GameStatus.Seated;

  const nominationCount = gameState?.boardNominations
    ? Object.keys(gameState.boardNominations).length
    : 0;
  const hasMyNomination = user?.id ? !!gameState?.boardNominations?.[user.id] : false;

  const handleNominate = useCallback(() => {
    navigation.navigate('GameConfig', {
      gameType: 'werewolf',
      mode: 'nominate',
      roomCode,
    });
  }, [navigation, roomCode]);

  const handleViewNominations = useCallback(() => {
    setNominationModalVisible(true);
  }, []);

  // Auto-close nomination modal when game progresses past setup phase
  useEffect(() => {
    if (!showNominations) {
      setNominationModalVisible(false);
    }
  }, [showNominations]);

  // ─── Strategy: find closest matching board with strategy data ──────────
  const matchedStrategyName = useMemo(() => {
    if (!gameState) return null;
    const roles = gameState.template.roles;
    // Exact match first (via name or roles)
    const exactName = gameState.template.name;
    if (exactName && BOARD_STRATEGY_KEYS.has(exactName)) return exactName;
    // Fuzzy match -- only against boards that have strategy content
    return findClosestPresetName(roles, 0.1, BOARD_STRATEGY_KEYS);
  }, [gameState]);

  const handleStrategyPress = useCallback(() => {
    if (matchedStrategyName) {
      setStrategyBoardName(matchedStrategyName);
    }
  }, [matchedStrategyName]);

  // ─── Auto-show QR invite card after room creation ─────────────────────
  useEffect(() => {
    if (isHost && entryReason === 'created' && !hasAutoShownQR.current) {
      hasAutoShownQR.current = true;
      roomShare.open();
    }
  }, [entryReason, isHost, roomShare]);

  const renderProfileDetails = useCallback(
    (statsUserId: string) => <WerewolfProfileDetails userId={statsUserId} />,
    [],
  );

  return (
    <RoomShell
      model={roomShellModel}
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
            title={`狼人杀 · ${gameState.template.numberOfPlayers}人局`}
            subtitle={findClosestPresetName(gameState.template.roles) ?? '自定义配置'}
            headerRight={
              <RoomGuideButton
                onPress={handleEncyclopedia}
                testID={TESTIDS.roomEncyclopediaButton}
                label="角色百科"
              />
            }
          >
            <BoardInfoCard
              playerCount={gameState.template.numberOfPlayers}
              sections={[
                { title: '狼人', items: wolfRoleItems, color: colors.wolf },
                { title: '神职', items: godRoleItems, color: colors.god },
                { title: '特殊', items: specialRoleItems, color: colors.third },
                {
                  title: '村民',
                  items:
                    villagerCount > 0
                      ? [
                          { roleId: 'villager', displayName: '村民', count: villagerCount },
                          ...villagerRoleItems,
                        ]
                      : villagerRoleItems,
                  color: colors.villager,
                },
              ]}
              collapsed={
                roomStatus === GameStatus.Ongoing ||
                roomStatus === GameStatus.Day ||
                roomStatus === GameStatus.Ended
              }
              onRolePress={handleSkillPreviewOpen}
              onNotepadPress={handleNotepadPress}
              onStrategyPress={matchedStrategyName ? handleStrategyPress : undefined}
              styles={boardInfoStyles}
              footer={
                <>
                  {showNominations && (
                    <TouchableOpacity
                      style={boardInfoStyles.nominationBtn}
                      onPress={handleNominate}
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
                  )}
                  {showNominations && nominationCount > 0 && (
                    <TouchableOpacity
                      style={boardInfoStyles.nominationBtn}
                      onPress={handleViewNominations}
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
        roomStatus === GameStatus.Ended && !isAudioPlaying ? (
          <Button
            variant="icon"
            onPress={isBgmPlaying ? stopBgm : playBgm}
            testID={TESTIDS.bgmToggleButton}
            accessibilityLabel={isBgmPlaying ? '暂停音乐' : '播放音乐'}
          >
            <Ionicons
              name={isBgmPlaying ? 'pause' : 'musical-notes'}
              size={componentSizes.icon.md}
              color={isBgmPlaying ? colors.primary : colors.text}
            />
          </Button>
        ) : null
      }
      trailingExtraActions={null}
      gameOverlays={
        <>
          {mvpSelection != null && (
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

          {/* Continue Game Overlay -- shown after Host rejoin to unlock audio */}
          <AlertModal
            visible={needsContinueOverlay}
            title="游戏已恢复"
            message="点击下方按钮继续游戏并恢复音频"
            buttons={[{ text: '继续游戏', onPress: resumeAfterRejoin }]}
            onClose={resumeAfterRejoin}
          />

          {/* Role Card Modal */}
          {(roleCardVisible || isLoadingRole) && effectiveRole && (
            <WerewolfRoleCardModal
              visible={roleCardVisible}
              isLoading={isLoadingRole}
              roleId={effectiveRole}
              resolvedAnimation={resolvedRoleRevealAnimation}
              shouldPlayAnimation={shouldPlayRevealAnimation}
              allRoleIds={gameState?.template.roles ?? []}
              remainingCards={
                gameState
                  ? Array.from(gameState.players.values()).filter((p) => p && !p.hasViewedRole)
                      .length + (shouldPlayRevealAnimation ? 1 : 0)
                  : 0
              }
              onClose={handleRoleCardClose}
              seerLabelMap={gameState?.seerLabelMap}
            />
          )}

          {/* Skill Preview Modal -- triggered by tapping a role chip in BoardInfoCard */}
          <RoleCardSimple
            visible={skillPreviewRoleId !== null}
            roleId={skillPreviewRoleId}
            onClose={handleSkillPreviewClose}
            showRealIdentity
            onAskAI={
              isAIChatReady() ? (rid) => askAIAboutRole(rid, handleSkillPreviewClose) : undefined
            }
          />

          {/* Night Review Modal -- for Judge / spectators; shows night actions + all roles */}
          {nightReviewVisible && nightReviewData && (
            <NightReviewModal
              visible={nightReviewVisible}
              data={nightReviewData}
              onClose={closeNightReview}
            />
          )}

          {/* Share card -- mounted on-demand during capture only */}
          {isCapturingShareCard && nightReviewData && (
            <View style={styles.hiddenShareCardContainer}>
              <NightReviewShareCard
                ref={nightReviewShareCardRef}
                data={nightReviewData}
                roomCode={roomCode}
              />
            </View>
          )}

          {/* Share Review Modal -- Host picks seats whose details to share */}
          {shareReviewVisible && gameState && (
            <ShareReviewModal
              visible={shareReviewVisible}
              seats={Array.from(gameState.players.entries())
                .filter(([seatNum, p]) => p !== null && seatNum !== effectiveSeat)
                .map(([seatNum, p]) => ({
                  seat: seatNum,
                  displayName: p!.displayName ?? `玩家${seatNum + 1}`,
                }))
                .sort((a, b) => a.seat - b.seat)}
              currentAllowedSeats={gameState.nightReviewAllowedSeats ?? []}
              onConfirm={shareNightReview}
              onClose={closeShareReview}
            />
          )}

          {/* Board Nomination Modal -- board suggestion list */}
          {nominationModalVisible && (
            <BoardNominationModal
              client={client}
              visible={nominationModalVisible}
              nominations={gameState?.boardNominations}
              myUserId={user?.id ?? null}
              isHost={isHost}
              currentPlayerCount={gameState?.template.numberOfPlayers ?? 0}
              onUpvote={(userId: string) => {
                void boardUpvote(userId);
              }}
              onWithdraw={() => {
                void boardWithdraw();
              }}
              clearAllSeats={clearAllSeats}
              onClose={() => setNominationModalVisible(false)}
            />
          )}

          {/* Choose Bottom Card Modal -- Treasure Master / Thief deck card selection */}
          {chooseCardModalVisible && gameState?.bottomCards && (
            <ChooseBottomCardModal
              visible={chooseCardModalVisible}
              bottomCards={gameState.bottomCards}
              confirmText={currentSchema?.ui?.confirmText ?? ''}
              disabledIndices={bottomCardDisabledIndices}
              disabledHint={bottomCardDisabledHint}
              subtitle={bottomCardSubtitle}
              onChoose={(idx) => handleChooseCard(idx)}
              onClose={closeChooseCardModal}
            />
          )}

          {/* Board Strategy Modal -- strategy details */}
          <BoardStrategyModal boardName={strategyBoardName} onClose={handleStrategyClose} />
        </>
      }
    />
  );
};
