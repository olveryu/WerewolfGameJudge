/**
 * RoomScreen - Main game room screen (thin rendering shell)
 *
 * All hook wiring, derived state, and side-effects live in useRoomScreenState.
 * This component only owns: styles, loading/error early returns, and JSX layout.
 * Creates theme-based styles, renders JSX (header, grid, bottom panel, modals),
 * and handles loading/error early returns. Does not wire hooks directly
 * (that's useRoomScreenState), does not own local state, and does not import
 * services / policy / helpers.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import { findClosestPresetName } from '@werewolf/game-engine/models/Template';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { toast } from 'sonner-native';

import { AlertModal } from '@/components/AlertModal';
import { BOARD_STRATEGY, BoardStrategyModal } from '@/components/BoardStrategy';
import { Button } from '@/components/Button';
import { DebugPanel } from '@/components/DebugPanel';
import { LoadingScreen } from '@/components/LoadingScreen';
import { RoleCardSimple } from '@/components/RoleCardSimple';
import { useSkiaShaderWarmup } from '@/components/SkiaShaderWarmup';
import { useAuthContext } from '@/contexts/AuthContext';
import { RoomShell } from '@/features/room/components/RoomShell';
import { createRoomFeatureStyles } from '@/features/room/components/styles';
import type { GameRoomScreenProps } from '@/features/room/model/GameUiModule';
import type { RoomHeaderMenuItem, RoomShellModel } from '@/features/room/model/RoomShellModel';
import {
  createWerewolfBottomActionLayout,
  createWerewolfControlledSeatModel,
  createWerewolfRoomCapabilities,
  createWerewolfSeatDataSource,
  createWerewolfStatusRibbon,
  toRoomConnectionStatus,
} from '@/games/werewolf/werewolfRoomAdapter';
import { useGachaStatusQuery } from '@/hooks/queries/useGachaQuery';
import { isAIChatReady } from '@/services/feature/AIChatService';
import { TESTIDS } from '@/testids';
import { colors, componentSizes, spacing } from '@/theme';
import { askAIAboutRole } from '@/utils/aiChatBridge';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';
import { isMiniProgram } from '@/utils/miniProgram';

import { AuthGateOverlay } from './components/AuthGateOverlay';
import { createBoardInfoStyles } from './components/boardInfo.styles';
import { BoardInfoCard } from './components/BoardInfoCard';
import { BoardNominationModal } from './components/BoardNominationList';
import { ChooseBottomCardModal } from './components/ChooseBottomCardModal';
import { NightReviewModal } from './components/NightReviewModal';
import { NightReviewShareCard } from './components/NightReviewShareCard';
import { PlayerProfileCard } from './components/PlayerProfileCard';
import { QRCodeModal } from './components/QRCodeModal';
import { RoleCardModal } from './components/RoleCardModal';
import { SeatConfirmModal } from './components/SeatConfirmModal';
import { ShareReviewModal } from './components/ShareReviewModal';
import { WxAuthFailedOverlay } from './components/WxAuthFailedOverlay';
import type { LayoutContext, StaticButtonId } from './hooks/bottomLayoutConfig';
import { useBottomLayout } from './hooks/useBottomLayout';
import { useRoomScreenState } from './hooks/useRoomScreenState';
import type { ActionIntent } from './policy/types';
import { createRoomScreenStyles } from './RoomScreen.styles';
import { shareQRCodeImage } from './shareQRCode';
import { buildRoomUrl, shareOrCopyRoomLink } from './shareRoom';

// ── Strategy Modal ───────────────────────────────────────────────────────────
const BOARD_STRATEGY_KEYS = new Set(Object.keys(BOARD_STRATEGY));

export const RoomScreen: React.FC<GameRoomScreenProps> = ({ room, entryReason, navigation }) => {
  const roomCode = room.roomCode;
  const { user } = useAuthContext();
  const styles = useMemo(() => createRoomScreenStyles(colors), []);
  const roomFeatureStyles = useMemo(() => createRoomFeatureStyles(colors), []);
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

  // ─── QR Code Modal state ──────────────────────────────────────────────
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [nominationModalVisible, setNominationModalVisible] = useState(false);
  const hasAutoShownQR = useRef(false);

  // Ticket count for top bar badge (shared cache via TanStack Query)
  const { data: gachaStatus } = useGachaStatusQuery();
  const ticketCount = gachaStatus ? gachaStatus.normalDraws + gachaStatus.goldenDraws : null;

  const handleShareRoom = useCallback(() => {
    setQrModalVisible(true);
  }, []);

  const handleCopyLink = useCallback(() => {
    void shareOrCopyRoomLink(roomCode)
      .then((result) => {
        if (result === 'copied') {
          toast.success('房间链接已复制');
        } else if (result === 'failed') {
          showErrorAlert('链接分享失败', '无法复制链接，请手动分享房间号');
        }
        // 'shared' -> system share sheet already provided feedback
        // 'cancelled' -> user dismissed intentionally, no alert needed
      })
      .catch((e) => {
        handleError(e, {
          label: '分享链接',
          logger: roomScreenLog,
          alertMessage: '无法复制链接，请手动分享房间号',
        });
      });
  }, [roomCode]);

  const handleShareQRImage = useCallback(
    (getBase64: () => Promise<string>) => {
      void shareQRCodeImage(getBase64, roomCode).catch((e) => {
        handleError(e, {
          label: '分享二维码',
          logger: roomScreenLog,
          alertMessage: '无法分享二维码图片',
        });
      });
    },
    [roomCode],
  );

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
    mySeat,
    roomStatus,
    currentSchema,
    isAudioPlaying,
    resolvedRoleRevealAnimation,
    connectionStatus,
    manualReconnect,
    gameRoomError,
    effectiveSeat,
    effectiveRole,
    isDebugMode,
    controlledSeat,
    hasBots,
    fillWithBots,
    markAllBotsViewed,
    markAllBotsGroupConfirmed,
    clearAllSeats,
    takeSeat,
    leaveSeat,
    kickPlayer,
    setControlledSeat,
    // Board nomination
    boardUpvote,
    boardWithdraw,
    // BGM manual control
    isBgmPlaying,
    playBgm,
    stopBgm,
    // Initialization
    isInitialized,
    loadingMessage,
    showRetryButton,
    handleRetry,
    // Auth gate
    needsAuth,
    clearNeedsAuth,
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
    profileCardVisible,
    profileCardTargetUserId,
    profileCardTargetSeat,
    profileCardRosterName,
    profileCardIsSelf,
    closeProfileCard,
    handleProfileKick,
    handleProfileLeaveSeat,
    openProfile,
    // Local UI state
    isStartingGame,
    isHostActionSubmitting,
    isActionSubmitting,
    // Seat modal
    seatModalVisible,
    pendingSeat,
    modalType,
    isSeatSubmitting,
    handleConfirmSeat,
    handleCancelSeat,
    handleConfirmLeave,
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
  } = useRoomScreenState(room, navigation);

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
          dispatchInteraction({ kind: 'HOST_CONTROL', action: 'settings' });
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
    [dispatchInteraction, showLastNightInfo, openNightReview],
  );

  const executeClearSeats = useCallback(async () => {
    await clearAllSeats();
    return { success: true } as const;
  }, [clearAllSeats]);

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

  const hasOccupiedSeats = useMemo(
    () =>
      gameState ? Array.from(gameState.players.values()).some((player) => player !== null) : false,
    [gameState],
  );
  const capabilities = useMemo(
    () =>
      createWerewolfRoomCapabilities({
        status: roomStatus,
        isHost,
        mySeat,
        isDebugMode,
        isAudioPlaying,
        hasOccupiedSeats,
        isShareAvailable: !isMiniProgram(),
        takeSeat,
        leaveSeat,
        kickSeat: kickPlayer,
        clearSeats: executeClearSeats,
        fillBots: fillWithBots,
        configureGame: () => dispatchInteraction({ kind: 'HOST_CONTROL', action: 'settings' }),
        openProfile,
        takeOverBot: onSeatLongPressed,
        shareRoom: handleShareRoom,
      }),
    [
      roomStatus,
      isHost,
      mySeat,
      isDebugMode,
      isAudioPlaying,
      hasOccupiedSeats,
      takeSeat,
      leaveSeat,
      kickPlayer,
      executeClearSeats,
      fillWithBots,
      dispatchInteraction,
      openProfile,
      onSeatLongPressed,
      handleShareRoom,
    ],
  );

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
        release: () => setControlledSeat(null),
      }),
    [isDebugMode, isHost, hasBots, roomStatus, controlledSeat, gameState, setControlledSeat],
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
      connection: {
        status: toRoomConnectionStatus(connectionStatus),
        onManualReconnect: manualReconnect,
      },
      statusRibbon,
      seats: {
        source: seatSource,
        visuallyDisabled:
          (roomStatus === GameStatus.Ongoing && isAudioPlaying) || isActionSubmitting,
        onSeatPress: onSeatTapped,
        onSeatLongPress: capabilities.canTakeOverBots.isAllowed ? onSeatLongPressed : null,
      },
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
      connectionStatus,
      manualReconnect,
      statusRibbon,
      seatSource,
      roomStatus,
      isAudioPlaying,
      isActionSubmitting,
      onSeatTapped,
      onSeatLongPressed,
      bottomActions,
      controlledSeatModel,
    ],
  );

  // ─── Auto-show QR invite card after room creation ─────────────────────
  useEffect(() => {
    if (
      isInitialized &&
      gameState &&
      isHost &&
      entryReason === 'created' &&
      !hasAutoShownQR.current
    ) {
      hasAutoShownQR.current = true;
      setQrModalVisible(true);
    }
  }, [isInitialized, gameState, isHost, entryReason]);

  // ─── Loading / Error early returns ─────────────────────────────────────
  if (!isInitialized || !gameState) {
    // Auth gate: first-time user via direct URL -- show login options (must check before error)
    if (needsAuth) {
      if (isMiniProgram()) {
        return (
          <WxAuthFailedOverlay
            onCancel={() => {
              clearNeedsAuth();
              navigation.navigate('Home');
            }}
          />
        );
      }
      return (
        <AuthGateOverlay
          onSuccess={() => {
            clearNeedsAuth();
            handleRetry();
          }}
          onCancel={() => {
            clearNeedsAuth();
            navigation.navigate('Home');
          }}
        />
      );
    }

    const displayMessage = showRetryButton && gameRoomError ? gameRoomError : loadingMessage;
    const isError = showRetryButton;

    if (isError) {
      return (
        <View style={styles.loadingContainer}>
          <Ionicons
            name="warning-outline"
            size={spacing.xxlarge + spacing.medium}
            color={colors.error}
            style={{ marginBottom: spacing.medium }}
          />
          <Text style={[styles.loadingText, styles.errorMessageText]}>{displayMessage}</Text>
          <View style={styles.retryButtonRow}>
            <TouchableOpacity style={styles.errorBackButton} onPress={handleRetry}>
              <Text style={styles.errorBackButtonText}>重试</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.errorSecondaryButton}
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={styles.errorSecondaryButtonText}>返回首页</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return <LoadingScreen message={displayMessage} />;
  }

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

          {/* Seat Confirmation Modal */}
          {/* Seat Confirmation Modal - only render when pendingSeat is set */}
          {pendingSeat !== null && (
            <SeatConfirmModal
              visible={seatModalVisible}
              modalType={modalType}
              seat={pendingSeat}
              isSubmitting={isSeatSubmitting}
              onConfirm={modalType === 'enter' ? handleConfirmSeat : handleConfirmLeave}
              onCancel={handleCancelSeat}
              styles={roomFeatureStyles.seatConfirmModal}
            />
          )}

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

          {/* Player Profile Card -- triggered by tapping another player's seat */}
          <PlayerProfileCard
            visible={profileCardVisible}
            onClose={closeProfileCard}
            targetUserId={profileCardTargetUserId}
            targetSeat={profileCardTargetSeat}
            rosterName={profileCardRosterName}
            isHost={isHost}
            isSelf={profileCardIsSelf}
            onKick={handleProfileKick}
            onLeaveSeat={handleProfileLeaveSeat}
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

          {/* QR Code Modal -- room QR code share */}
          <QRCodeModal
            visible={qrModalVisible}
            roomCode={roomCode}
            roomUrl={buildRoomUrl(roomCode)}
            onShareImage={handleShareQRImage}
            onCopyLink={handleCopyLink}
            onClose={() => setQrModalVisible(false)}
          />

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
