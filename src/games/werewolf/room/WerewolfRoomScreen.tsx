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
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import { findClosestPresetName } from '@werewolf/game-engine/models/Template';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { AlertModal } from '@/components/AlertModal';
import { BOARD_STRATEGY, BoardStrategyModal } from '@/components/BoardStrategy';
import { Button } from '@/components/Button';
import { DebugPanel } from '@/components/DebugPanel';
import { RoleCardSimple } from '@/components/RoleCardSimple';
import { useSkiaShaderWarmup } from '@/components/SkiaShaderWarmup';
import { useAuthContext } from '@/contexts/AuthContext';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/GameUiModule';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';
import type { RoomHeaderMenuItem, RoomShellModel } from '@/features/room/model/RoomShellModel';
import {
  resolveWerewolfBuiltinAvatarName,
  WerewolfProfileDetails,
} from '@/games/werewolf/components/WerewolfProfileDetails';
import { useWerewolfGame } from '@/games/werewolf/runtime/WerewolfGameContext';
import {
  createWerewolfBottomActionLayout,
  createWerewolfControlledSeatModel,
  createWerewolfSeatDataSource,
  createWerewolfStatusRibbon,
} from '@/games/werewolf/werewolfRoomAdapter';
import { useGachaStatusQuery } from '@/hooks/queries/useGachaQuery';
import { isAIChatReady } from '@/services/feature/AIChatService';
import { TESTIDS } from '@/testids';
import { colors, componentSizes } from '@/theme';
import { askAIAboutRole } from '@/utils/aiChatBridge';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import { createBoardInfoStyles } from './components/boardInfo.styles';
import { BoardInfoCard } from './components/BoardInfoCard';
import { BoardNominationModal } from './components/BoardNominationList';
import { ChooseBottomCardModal } from './components/ChooseBottomCardModal';
import { NightReviewModal } from './components/NightReviewModal';
import { NightReviewShareCard } from './components/NightReviewShareCard';
import { RoleCardModal } from './components/RoleCardModal';
import { ShareReviewModal } from './components/ShareReviewModal';
import type { LayoutContext, StaticButtonId } from './hooks/bottomLayoutConfig';
import { useBottomLayout } from './hooks/useBottomLayout';
import { useWerewolfRoomScreenState } from './hooks/useWerewolfRoomScreenState';
import type { ActionIntent } from './policy/types';
import { createRoomScreenStyles } from './WerewolfRoomScreen.styles';

// ── Strategy Modal ───────────────────────────────────────────────────────────
const BOARD_STRATEGY_KEYS = new Set(Object.keys(BOARD_STRATEGY));

export const WerewolfRoomScreen: React.FC<GameRoomScreenProps> = ({
  room,
  entryReason,
  navigation,
}) => {
  const facade = useWerewolfGame();
  const handleExit = useCallback(() => navigation.navigate('Home'), [navigation]);

  return (
    <RoomEntryBoundary room={room} session={facade.roomSession} onExit={handleExit}>
      {(entryController) => (
        <WerewolfRoomContent
          room={room}
          entryReason={entryReason}
          navigation={navigation}
          entryController={entryController}
        />
      )}
    </RoomEntryBoundary>
  );
};

interface WerewolfRoomContentProps extends GameRoomScreenProps {
  readonly entryController: RoomEntryController;
}

export const WerewolfRoomContent: React.FC<WerewolfRoomContentProps> = ({
  room,
  entryReason,
  navigation,
  entryController,
}) => {
  const roomCode = room.roomCode;
  const { user } = useAuthContext();
  const styles = useMemo(() => createRoomScreenStyles(colors), []);
  const boardInfoStyles = useMemo(() => createBoardInfoStyles(colors), []);

  // Pre-compile Skia GPU shaders for role reveal animations (eliminates first-frame jank).
  // Moved here from App.tsx -- Skia is now lazy-loaded, so warmup runs when Skia is ready.
  useSkiaShaderWarmup();

  // ─── Notepad ──────────────────────────────────────────────────────────
  const handleNotepadPress = useCallback(() => {
    navigation.navigate('Notepad', { roomCode });
  }, [navigation, roomCode]);

  // ─── Strategy Modal ───────────────────────────────────────────────────
  const [strategyBoardName, setStrategyBoardName] = useState<string | null>(null);

  const handleStrategyClose = useCallback(() => {
    setStrategyBoardName(null);
  }, []);

  const [nominationModalVisible, setNominationModalVisible] = useState(false);
  const hasAutoShownQR = useRef(false);

  // Ticket count for top bar badge (shared cache via TanStack Query)
  const { data: gachaStatus } = useGachaStatusQuery();
  const ticketCount = gachaStatus ? gachaStatus.normalDraws + gachaStatus.goldenDraws : null;

  const handleAvatarPress = useCallback(() => {
    navigation.navigate('Settings', { roomCode });
  }, [navigation, roomCode]);

  const handleEncyclopedia = useCallback(() => {
    navigation.navigate('Encyclopedia', { roomCode });
  }, [navigation, roomCode]);

  const handleMusicSettings = useCallback(() => {
    navigation.navigate('MusicSettings', { roomCode });
  }, [navigation, roomCode]);

  const {
    // Route params
    // Game state
    gameState,
    stateRevision,
    isHost,
    roomStatus,
    currentSchema,
    isAudioPlaying,
    resolvedRoleRevealAnimation,
    effectiveSeat,
    effectiveRole,
    isDebugMode,
    controlledSeat,
    hasBots,
    markAllBotsViewed,
    markAllBotsGroupConfirmed,
    clearAllSeats,
    releaseBot,
    capabilities,
    roomConnection,
    roomShare,
    // Board nomination
    boardUpvote,
    boardWithdraw,
    // BGM manual control
    isBgmPlaying,
    playBgm,
    stopBgm,
    // Derived view models
    seatViewModels,
    villagerCount,
    wolfRoleItems,
    godRoleItems,
    specialRoleItems,
    villagerRoleItems,
    nightProgress,
    speakingOrderText,
    guideMessage,
    actionMessage,
    // Actioner
    imActioner,
    // Interaction
    dispatchInteraction,
    onSeatTapped,
    onSeatLongPressed,
    getBottomAction,
    handleDebugTitleTap,
    // Player profile card
    profileSelection,
    closeProfile,
    requestProfileSelfLeave,
    // Local UI state
    isStartingGame,
    isHostActionSubmitting,
    isActionSubmitting,
    // Seat modal
    seatConfirmation,
    // Role card modal
    roleCardVisible,
    shouldPlayRevealAnimation,
    isLoadingRole,
    handleRoleCardClose,
    // Skill preview modal
    skillPreviewRoleId,
    handleSkillPreviewOpen,
    handleSkillPreviewClose,
    // Rejoin recovery
    resumeAfterRejoin,
    needsContinueOverlay,
    // Last night info
    showLastNightInfo,
    // Night review modal
    nightReviewData,
    nightReviewShareCardRef,
    isCapturingShareCard,
    nightReviewVisible,
    openNightReview,
    closeNightReview,
    // Share review modal
    shareReviewVisible,
    closeShareReview,
    shareNightReview,
    // Choose card modal (treasureMaster / thief)
    chooseCardModalVisible,
    closeChooseCardModal,
    handleChooseCard,
    bottomCardDisabledIndices,
    bottomCardDisabledHint,
    bottomCardSubtitle,
  } = useWerewolfRoomScreenState(room, navigation, entryController);

  // ─── Board nomination callbacks ────────────────────────────────────────
  const showNominations = roomStatus === GameStatus.Unseated || roomStatus === GameStatus.Seated;

  const nominationCount = gameState?.boardNominations
    ? Object.keys(gameState.boardNominations).length
    : 0;
  const hasMyNomination = user?.id ? !!gameState?.boardNominations?.[user.id] : false;

  const handleNominate = useCallback(() => {
    navigation.navigate('BoardPicker', {
      nominateMode: { roomCode: roomCode },
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

  // ─── Bottom panel layout ───────────────────────────────────────────────
  const layoutCtx: LayoutContext = useMemo(
    () => ({
      roomStatus,
      isHost,
      effectiveSeat,
      imActioner,
      isAudioPlaying,
      isStartingGame,
      isHostActionSubmitting,
      nightReviewAllowedSeats: gameState?.nightReviewAllowedSeats ?? [],
      isPlagueMode: gameState?.rules?.isPlagueMode ?? false,
    }),
    [
      roomStatus,
      isHost,
      effectiveSeat,
      imActioner,
      isAudioPlaying,
      isStartingGame,
      isHostActionSubmitting,
      gameState?.nightReviewAllowedSeats,
      gameState?.rules?.isPlagueMode,
    ],
  );
  const schemaVM = getBottomAction();
  const bottomLayout = useBottomLayout({ ctx: layoutCtx, schemaVM });

  const handleSchemaButtonPress = useCallback(
    (intent: ActionIntent) => {
      dispatchInteraction({ kind: 'BOTTOM_ACTION', intent });
    },
    [dispatchInteraction],
  );

  const handleStaticButtonPress = useCallback(
    (action: StaticButtonId) => {
      switch (action) {
        case 'viewRole':
          dispatchInteraction({ kind: 'VIEW_ROLE' });
          break;
        case 'waitForHost':
          toast.info('等待房主开始分配角色');
          break;
        case 'settings':
          if (!capabilities.canConfigureGame.isAllowed) {
            throw new Error(
              `Werewolf bottom layout emitted denied settings capability: ${capabilities.canConfigureGame.reason}`,
            );
          }
          capabilities.canConfigureGame.execute();
          break;
        case 'prepareToFlip':
          dispatchInteraction({ kind: 'HOST_CONTROL', action: 'prepareToFlip' });
          break;
        case 'startGame':
          dispatchInteraction({ kind: 'HOST_CONTROL', action: 'startGame' });
          break;
        case 'restart':
          dispatchInteraction({ kind: 'HOST_CONTROL', action: 'restart' });
          break;
        case 'lastNightInfo':
          showLastNightInfo();
          break;
        case 'nightReview':
          openNightReview();
          break;
      }
    },
    [capabilities.canConfigureGame, dispatchInteraction, showLastNightInfo, openNightReview],
  );

  const executeMarkAllBotsViewed = useCallback(() => {
    void markAllBotsViewed().catch((err) => {
      handleError(err, {
        label: 'markAllBotsViewed',
        logger: roomScreenLog,
        feedback: false,
      });
    });
  }, [markAllBotsViewed]);

  const executeMarkAllBotsGroupConfirmed = useCallback(() => {
    void markAllBotsGroupConfirmed().catch((err) => {
      handleError(err, {
        label: 'markAllBotsGroupConfirmed',
        logger: roomScreenLog,
        feedback: false,
      });
    });
  }, [markAllBotsGroupConfirmed]);

  const seatSource = useMemo(
    () =>
      createWerewolfSeatDataSource({
        seats: seatViewModels,
        controlledSeat,
        showBotRoles: isDebugMode && isHost,
        showLevels: roomStatus !== GameStatus.Ongoing,
        decorationsEnabled: roomStatus !== GameStatus.Ongoing,
        revision: stateRevision,
      }),
    [seatViewModels, controlledSeat, isDebugMode, isHost, roomStatus, stateRevision],
  );

  const statusRibbon = useMemo(
    () => createWerewolfStatusRibbon({ nightProgress, speakingOrderText, guideMessage }),
    [nightProgress, speakingOrderText, guideMessage],
  );

  const controlledSeatModel = useMemo(
    () =>
      createWerewolfControlledSeatModel({
        isVisible:
          isDebugMode &&
          isHost &&
          hasBots &&
          roomStatus !== GameStatus.Unseated &&
          roomStatus !== GameStatus.Seated,
        controlledSeat,
        controlledBotName:
          controlledSeat === null
            ? null
            : (gameState?.players.get(controlledSeat)?.displayName ?? null),
        showBulkViewHint: roomStatus === GameStatus.Assigned,
        release: releaseBot,
      }),
    [isDebugMode, isHost, hasBots, roomStatus, controlledSeat, gameState, releaseBot],
  );

  const bottomActions = useMemo(
    () => ({
      message:
        !isAudioPlaying &&
        (imActioner ||
          roomStatus === GameStatus.Ended ||
          (gameState?.rules?.isPlagueMode === true && isHost && roomStatus === GameStatus.Ready))
          ? gameState?.rules?.isPlagueMode && isHost && roomStatus === GameStatus.Ready
            ? '黑死病模式 — 已发牌，请由房主担任真人法官主持后续流程'
            : actionMessage
          : null,
      layout: createWerewolfBottomActionLayout({
        layout: bottomLayout,
        onIntent: handleSchemaButtonPress,
        onStaticAction: handleStaticButtonPress,
      }),
    }),
    [
      isAudioPlaying,
      imActioner,
      roomStatus,
      gameState?.rules?.isPlagueMode,
      isHost,
      actionMessage,
      bottomLayout,
      handleSchemaButtonPress,
      handleStaticButtonPress,
    ],
  );

  const headerMenuItems = useMemo((): readonly RoomHeaderMenuItem[] => {
    const items: RoomHeaderMenuItem[] = [];
    if (isHost && !isStartingGame && !isAudioPlaying && roomStatus !== GameStatus.Ongoing) {
      items.push({
        id: 'music-settings',
        label: '音乐设置',
        icon: 'musical-notes-outline',
        group: 'utility',
        tone: 'default',
        onPress: handleMusicSettings,
      });
    }
    if (isHost && isDebugMode && roomStatus === GameStatus.Assigned) {
      items.push({
        id: 'mark-bots-viewed',
        label: '标记机器人已查看',
        icon: 'eye-outline',
        group: 'operation',
        tone: 'default',
        onPress: executeMarkAllBotsViewed,
      });
    }
    if (
      isHost &&
      isDebugMode &&
      !isAudioPlaying &&
      roomStatus === GameStatus.Ongoing &&
      currentSchema?.kind === 'groupConfirm'
    ) {
      items.push({
        id: 'mark-bots-confirmed',
        label: '标记机器人已确认',
        icon: 'checkmark-done-outline',
        group: 'operation',
        tone: 'default',
        onPress: executeMarkAllBotsGroupConfirmed,
      });
    }
    return items;
  }, [
    isHost,
    isStartingGame,
    isAudioPlaying,
    roomStatus,
    isDebugMode,
    currentSchema?.kind,
    handleMusicSettings,
    executeMarkAllBotsViewed,
    executeMarkAllBotsGroupConfirmed,
  ]);

  const handleProfileKick = useCallback(() => {
    if (profileSelection === null) {
      throw new Error('Cannot kick without an open profile');
    }
    const capability = capabilities.canKickSeat;
    if (!capability.isAllowed) {
      throw new Error(`Cannot kick from profile: ${capability.reason}`);
    }
    capability.execute(profileSelection.target.seat);
  }, [capabilities.canKickSeat, profileSelection]);

  const handleProfileLeave = useCallback(() => {
    const capability = capabilities.canLeaveSeat;
    if (!capability.isAllowed) {
      throw new Error(`Cannot leave from profile: ${capability.reason}`);
    }
    requestProfileSelfLeave(capability.execute);
  }, [capabilities.canLeaveSeat, requestProfileSelfLeave]);

  const profile = useMemo((): RoomProfileCardModel | null => {
    if (profileSelection === null) return null;
    return {
      target: profileSelection.target,
      isSelf: profileSelection.isSelf,
      onClose: closeProfile,
      onKick:
        !profileSelection.isSelf && capabilities.canKickSeat.isAllowed ? handleProfileKick : null,
      onLeaveSeat:
        profileSelection.isSelf && capabilities.canLeaveSeat.isAllowed ? handleProfileLeave : null,
      resolveBuiltinAvatarName: resolveWerewolfBuiltinAvatarName,
      gameDetails: {
        title: '阵营分布',
        content: <WerewolfProfileDetails userId={profileSelection.target.userId} />,
      },
    };
  }, [
    capabilities.canKickSeat.isAllowed,
    capabilities.canLeaveSeat.isAllowed,
    closeProfile,
    handleProfileKick,
    handleProfileLeave,
    profileSelection,
  ]);

  const roomShellModel = useMemo(
    (): RoomShellModel => ({
      roomCode,
      capabilities,
      header: {
        onBack: () => dispatchInteraction({ kind: 'LEAVE_ROOM' }),
        onTitlePress: handleDebugTitleTap,
        userAction: {
          user,
          ticketCount,
          onPress: handleAvatarPress,
        },
        menuItems: headerMenuItems,
      },
      connection: roomConnection,
      statusRibbon,
      seats: {
        source: seatSource,
        visuallyDisabled:
          (roomStatus === GameStatus.Ongoing && isAudioPlaying) || isActionSubmitting,
        onSeatPress: onSeatTapped,
        onSeatLongPress: capabilities.canTakeOverBots.isAllowed ? onSeatLongPressed : null,
      },
      seatConfirmation,
      profile,
      share: roomShare,
      bottomActions,
      controlledSeat: controlledSeatModel,
    }),
    [
      roomCode,
      capabilities,
      handleDebugTitleTap,
      user,
      ticketCount,
      handleAvatarPress,
      headerMenuItems,
      dispatchInteraction,
      roomConnection,
      statusRibbon,
      seatSource,
      roomStatus,
      isAudioPlaying,
      isActionSubmitting,
      onSeatTapped,
      onSeatLongPressed,
      seatConfirmation,
      profile,
      roomShare,
      bottomActions,
      controlledSeatModel,
    ],
  );

  // ─── Auto-show QR invite card after room creation ─────────────────────
  useEffect(() => {
    if (isHost && entryReason === 'created' && !hasAutoShownQR.current) {
      hasAutoShownQR.current = true;
      roomShare.open();
    }
  }, [entryReason, isHost, roomShare]);

  return (
    <RoomShell
      model={roomShellModel}
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
      trailingExtraActions={
        <Button
          variant="icon"
          onPress={handleEncyclopedia}
          testID={TESTIDS.roomEncyclopediaButton}
          accessibilityLabel="角色百科"
        >
          <Ionicons name="book-outline" size={componentSizes.icon.md} color={colors.text} />
        </Button>
      }
      beforeSeatBoard={
        <BoardInfoCard
          playerCount={gameState.template.numberOfPlayers}
          wolfRoleItems={wolfRoleItems}
          godRoleItems={godRoleItems}
          specialRoleItems={specialRoleItems}
          villagerCount={villagerCount}
          villagerRoleItems={villagerRoleItems}
          collapsed={roomStatus === GameStatus.Ongoing || roomStatus === GameStatus.Ended}
          onRolePress={handleSkillPreviewOpen}
          onNotepadPress={handleNotepadPress}
          onStrategyPress={matchedStrategyName ? handleStrategyPress : undefined}
          styles={boardInfoStyles}
          showNominations={showNominations}
          hasMyNomination={hasMyNomination}
          nominationCount={nominationCount}
          onNominatePress={handleNominate}
          onViewNominations={handleViewNominations}
        />
      }
      afterSeatBoard={null}
      gameOverlays={
        <>
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
            <RoleCardModal
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

          {/* Debug Console -- store-driven modal, toggled via useHiddenDebugTrigger */}
          <DebugPanel />
        </>
      }
    />
  );
};
