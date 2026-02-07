/**
 * RoomScreen - Main game room screen
 *
 * ✅ Allowed:
 *   - Own top-level state (magician seats, role card modal, isStartingGame)
 *   - Compute derived data (seatViewModels, roleStats, nightProgress, wolfVotesMap)
 *   - Wire hooks together (useGameRoom → useRoomInit → useActionOrchestrator → useInteractionDispatcher)
 *   - Render JSX (header, grid, bottom panel, modals)
 *   - Own styles factory (createStyles)
 *
 * ❌ Do NOT:
 *   - Contain action intent processing logic (that's useActionOrchestrator)
 *   - Contain interaction dispatch / policy logic (that's useInteractionDispatcher)
 *   - Contain room init logic (that's useRoomInit)
 *   - Import services directly (all through useGameRoom)
 *   - Duplicate gate checks that belong in policy layer
 *
 * Refactored modular architecture:
 * - hooks/useRoomInit.ts (room initialization lifecycle)
 * - hooks/useActionOrchestrator.ts (action intent handler + auto-trigger + rejection)
 * - hooks/useInteractionDispatcher.ts (policy dispatch + seat tap handlers)
 * - hooks/useRoomActions.ts (intent derivation layer)
 * - hooks/useActionerState.ts (actioner state derivation)
 * - RoomScreen.helpers.ts (pure functions)
 * - components/ (presentational layer)
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { GameStatus, getWolfVoteSummary, getPlayersNotViewedRole } from '../../models/Room';
import { buildNightPlan, getRoleDisplayName, getRoleSpec, Faction } from '../../models/roles';
import { showAlert } from '../../utils/alert';
import { useGameRoom } from '../../hooks/useGameRoom';
import { AudioService } from '../../services';
import { HostControlButtons } from './HostControlButtons';
import { useRoomHostDialogs } from './useRoomHostDialogs';
import { useRoomActionDialogs } from './useRoomActionDialogs';
import { useRoomSeatDialogs } from './useRoomSeatDialogs';
import { PlayerGrid } from './components/PlayerGrid';
import { BoardInfoCard } from './components/BoardInfoCard';
import { WaitingViewRoleList } from './components/WaitingViewRoleList';
import { ActionButton } from './components/ActionButton';
import { SeatConfirmModal } from './components/SeatConfirmModal';
import { NightProgressIndicator } from './components/NightProgressIndicator';
import { ControlledSeatBanner } from './components/ControlledSeatBanner';
import { HostMenuDropdown } from './components/HostMenuDropdown';
import { BottomActionPanel } from './components/BottomActionPanel';
import {
  toGameRoomLike,
  getRoleStats,
  formatRoleList,
  buildSeatViewModels,
} from './RoomScreen.helpers';
import {
  getActorIdentity,
  isActorIdentityValid,
} from './policy';
import { TESTIDS } from '../../testids';
import { useActionerState } from './hooks/useActionerState';
import { useRoomActions } from './hooks/useRoomActions';
import { useRoomInit } from './hooks/useRoomInit';
import { useActionOrchestrator } from './hooks/useActionOrchestrator';
import { useInteractionDispatcher } from './hooks/useInteractionDispatcher';
import { ConnectionStatusBar } from './components/ConnectionStatusBar';
import { roomScreenLog } from '../../utils/logger';
import { LoadingScreen } from '../../components/LoadingScreen';
import { RoleCardSimple } from '../../components/RoleCardSimple';
import {
  RoleRevealAnimator,
  createRoleData,
  type RoleData,
  type RevealEffectType,
} from '../../components/RoleRevealEffects';
import { useColors, spacing, typography, borderRadius, type ThemeColors } from '../../theme';
import { componentSizes, fixed } from '../../theme/tokens';
import { mobileDebug } from '../../utils/mobileDebug';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'Room'>;

export const RoomScreen: React.FC<Props> = ({ route, navigation }) => {
  const {
    roomNumber,
    isHost: isHostParam,
    template,
    roleRevealAnimation: initialRoleRevealAnimation,
  } = route.params;
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Use the new game room hook
  const {
    gameState,
    isHost,
    mySeatNumber,
    myRole,
    myUid,
    roomStatus,
    currentActionRole,
    currentSchema,
    currentStepId,
    isAudioPlaying,
    resolvedRoleRevealAnimation,
    connectionStatus,
    error: gameRoomError,
    createRoom,
    joinRoom,
    leaveRoom,
    takeSeat,
    leaveSeat,
    assignRoles,
    startGame,
    restartGame,
    setRoleRevealAnimation,
    viewedRole,
    submitAction,
    submitWolfVote,
    hasWolfVoted,
    getLastNightInfo: getLastNightInfoFn,
    lastSeatError,
    clearLastSeatError,
    requestSnapshot,
    submitRevealAck,
    sendWolfRobotHunterStatusViewed,
    // Debug mode
    isDebugMode,
    fillWithBots,
    markAllBotsViewed,
    controlledSeat,
    setControlledSeat,
    effectiveSeat,
    effectiveRole,
  } = useGameRoom();

  // Check if there are any bots in the game (for showing bot mode hint)
  const hasBots = useMemo(() => {
    if (!gameState) return false;
    return Array.from(gameState.players.values()).some((p) => p?.isBot);
  }, [gameState]);

  // Night progress indicator: calculate current step index and total steps
  // Uses buildNightPlan to get the actual steps based on the template roles
  const nightProgress = useMemo(() => {
    if (!currentStepId || gameState?.status !== 'ongoing') {
      return null;
    }

    // Build night plan from template roles (same as Host uses)
    const nightPlan = buildNightPlan(gameState.template.roles);

    // Find current step index in the dynamically built plan
    const stepIndex = nightPlan.steps.findIndex((step) => step.stepId === currentStepId);
    if (stepIndex === -1) return null;

    const currentStep = nightPlan.steps[stepIndex];
    return {
      current: stepIndex + 1, // 1-based for display
      total: nightPlan.length,
      roleName: currentStep?.displayName,
    };
  }, [currentStepId, gameState]);

  // =========================================================================
  // PR7: 音频架构 - UI 只读 isAudioPlaying
  // 根据 copilot-instructions.md：
  // - Handler 声明音频 (PLAY_AUDIO sideEffect)
  // - Facade 执行音频 + gate
  // - UI 只读 gate，用于禁用交互
  // RoomScreen 不触发音频，不写 isAudioPlaying
  // =========================================================================

  const submitRevealAckSafe = useCallback(
    (role: 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot') => {
      void submitRevealAck(role);
    },
    [submitRevealAck],
  );

  // Local UI state
  const [anotherIndex, setAnotherIndex] = useState<number | null>(null); // For Magician first seat
  const [secondSeatIndex, setSecondSeatIndex] = useState<number | null>(null); // For Magician second seat (temporary highlight)
  const [isStartingGame, setIsStartingGame] = useState(false); // Hide start button after clicking
  const [seatModalVisible, setSeatModalVisible] = useState(false);
  const [pendingSeatIndex, setPendingSeatIndex] = useState<number | null>(null);
  const [modalType, setModalType] = useState<'enter' | 'leave'>('enter');

  // Hidden debug panel trigger: tap title 5 times to show mobileDebug panel
  const debugTapCountRef = useRef(0);
  const debugTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleDebugTitleTap = useCallback(() => {
    debugTapCountRef.current += 1;
    if (debugTapTimeoutRef.current) {
      clearTimeout(debugTapTimeoutRef.current);
    }
    if (debugTapCountRef.current >= 5) {
      debugTapCountRef.current = 0;
      mobileDebug.toggle();
    } else {
      debugTapTimeoutRef.current = setTimeout(() => {
        debugTapCountRef.current = 0;
      }, 2000);
    }
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Room initialization (delegated to useRoomInit hook)
  // ───────────────────────────────────────────────────────────────────────────
  const {
    isInitialized,
    loadingMessage,
    showRetryButton,
    handleRetry,
  } = useRoomInit({
    roomNumber,
    isHostParam,
    template,
    createRoom,
    joinRoom,
    takeSeat,
    hasGameState: !!gameState,
    initialRoleRevealAnimation,
    setRoleRevealAnimation,
    gameRoomError,
  });

  // Auto-trigger intent idempotency: prevent duplicate triggers in the same turn
  // (managed by useActionOrchestrator)

  // Keep gameStateRef removed - managed by useActionOrchestrator

  const wolfVotesMap = useMemo(() => {
    const raw = gameState?.currentNightResults?.wolfVotesBySeat;
    if (!raw) return new Map<number, number>();
    const map = new Map<number, number>();
    for (const [k, v] of Object.entries(raw as Record<string, number>)) {
      map.set(Number.parseInt(k, 10), v);
    }
    return map;
  }, [gameState?.currentNightResults]);

  // ───────────────────────────────────────────────────────────────────────────
  // Actor Identity: Single source of truth for UI action-related decisions
  // ───────────────────────────────────────────────────────────────────────────
  const actorIdentity = useMemo(
    () =>
      getActorIdentity({
        mySeatNumber,
        myRole,
        effectiveSeat,
        effectiveRole,
        controlledSeat,
      }),
    [mySeatNumber, myRole, effectiveSeat, effectiveRole, controlledSeat],
  );

  const { actorSeatForUi, actorRoleForUi, isDelegating } = actorIdentity;

  // FAIL-FAST observability: Log warning when delegating but identity is invalid
  // This helps debugging "can't click anything" issues in debug bot mode
  useEffect(() => {
    if (isDelegating && !isActorIdentityValid(actorIdentity)) {
      roomScreenLog.warn('[ActorIdentity] Invalid delegation state detected', {
        controlledSeat,
        effectiveSeat,
        effectiveRole,
        actorSeatForUi,
        actorRoleForUi,
        hint: 'effectiveSeat should equal controlledSeat when delegating',
      });
    }
  }, [
    isDelegating,
    actorIdentity,
    controlledSeat,
    effectiveSeat,
    effectiveRole,
    actorSeatForUi,
    actorRoleForUi,
  ]);

  // Computed values: use useActionerState hook
  // Use actorSeatForUi/actorRoleForUi for action-related decisions
  const { imActioner, showWolves } = useActionerState({
    actorRole: actorRoleForUi,
    currentActionRole,
    currentSchema,
    actorSeatNumber: actorSeatForUi,
    wolfVotes: wolfVotesMap,
    isHost,
    actions: gameState?.actions ?? new Map(),
  });

  // Extract schema constraints for chooseSeat/swap schemas (non-compound).
  // Compound schemas (witch) have fixed targets or step-specific handling.
  const currentSchemaConstraints = useMemo(() => {
    if (!currentSchema) return undefined;
    // Only chooseSeat and swap schemas have constraints that affect seat selection
    if (currentSchema.kind === 'chooseSeat' || currentSchema.kind === 'swap') {
      return currentSchema.constraints;
    }
    return undefined;
  }, [currentSchema]);

  // Build seat view models for PlayerGrid
  // Uses actorSeatForUi to highlight the actor's seat (bot seat when delegating)
  const seatViewModels = useMemo(() => {
    if (!gameState) return [];

    // Bug fix: After wolfRobot learns (wolfRobotReveal exists), all seat taps
    // should have NO effect - no dialogs, no actions. Skip schema constraints
    // entirely so that PlayerGrid won't show "不能选择自己" alert for self-tap.
    const skipConstraints =
      currentSchema?.id === 'wolfRobotLearn' && gameState.wolfRobotReveal != null;

    return buildSeatViewModels(gameState, actorSeatForUi, showWolves, anotherIndex, {
      // Schema-driven constraints (notSelf, etc.) - UX-only early rejection
      // Skip when wolfRobot learning is complete (no seat should be tappable)
      schemaConstraints: imActioner && !skipConstraints ? currentSchemaConstraints : undefined,
      // For magician swap: highlight the second seat being selected
      secondSelectedIndex: secondSeatIndex,
    });
  }, [
    gameState,
    actorSeatForUi,
    showWolves,
    anotherIndex,
    secondSeatIndex,
    imActioner,
    currentSchemaConstraints,
    currentSchema?.id,
  ]);

  // Calculate role statistics using helper
  const { roleCounts, wolfRoles, godRoles, specialRoles, villagerCount } = useMemo(() => {
    if (!gameState) {
      return { roleCounts: {}, wolfRoles: [], godRoles: [], specialRoles: [], villagerCount: 0 };
    }
    return getRoleStats(gameState.template.roles);
  }, [gameState]);

  // Show alert when seat request is rejected (BUG-2 fix)
  useEffect(() => {
    if (lastSeatError) {
      showAlert('入座失败', '该座位已被占用，请选择其他位置。');
      clearLastSeatError();
    }
  }, [lastSeatError, clearLastSeatError]);

  // Reset UI state when game restarts
  useEffect(() => {
    if (!gameState) return;

    if (roomStatus === GameStatus.unseated || roomStatus === GameStatus.seated) {
      setIsStartingGame(false);
      setAnotherIndex(null); // Reset magician state
    }
  }, [gameState, roomStatus]);

  // ───────────────────────────────────────────────────────────────────────────
  // Intent Layer: useRoomActions
  // ───────────────────────────────────────────────────────────────────────────

  const gameContext = useMemo(
    () => ({
      gameState,
      roomStatus,
      currentActionRole,
      currentSchema,
      imActioner,
      actorSeatNumber: actorSeatForUi,
      actorRole: actorRoleForUi,
      isAudioPlaying,
      anotherIndex,
    }),
    [
      gameState,
      roomStatus,
      currentActionRole,
      currentSchema,
      imActioner,
      actorSeatForUi,
      actorRoleForUi,
      isAudioPlaying,
      anotherIndex,
    ],
  );

  const actionDeps = useMemo(
    () => ({
      hasWolfVoted,
      getWolfVoteSummary: () =>
        gameState ? getWolfVoteSummary(toGameRoomLike(gameState)) : '0/0 狼人已投票',
      getWitchContext: () => gameState?.witchContext ?? null,
    }),
    [gameState, hasWolfVoted],
  );

  const {
    getActionIntent,
    getAutoTriggerIntent,
    findVotingWolfSeat,
    getWolfStatusLine,
    getBottomAction,
  } = useRoomActions(gameContext, actionDeps);

  // ───────────────────────────────────────────────────────────────────────────
  // Dialog Layer: useRoomActionDialogs + useRoomSeatDialogs
  // ───────────────────────────────────────────────────────────────────────────

  const actionDialogs = useRoomActionDialogs();

  // Cleanup callback for leaving room - MUST call leaveRoom() to abort async operations
  const handleLeaveRoomCleanup = useCallback(() => {
    roomScreenLog.debug('handleLeaveRoomCleanup: calling leaveRoom + cleanup');
    // P0 fix: leaveRoom() sets abort flag to stop ongoing async operations (e.g., audio queue)
    // This also cleans up facade state, presence, etc.
    void leaveRoom();
    // Also cleanup audio (stops current player + BGM immediately)
    AudioService.getInstance().cleanup();
  }, [leaveRoom]);

  const seatDialogs = useRoomSeatDialogs({
    pendingSeatIndex,
    setPendingSeatIndex,
    setSeatModalVisible,
    setModalType,
    takeSeat,
    leaveSeat,
    roomStatus,
    navigation,
    onLeaveRoom: handleLeaveRoomCleanup,
  });

  const {
    showEnterSeatDialog,
    showLeaveSeatDialog,
    handleConfirmSeat,
    handleCancelSeat,
    handleConfirmLeave,
    handleLeaveRoom,
  } = seatDialogs;

  // ───────────────────────────────────────────────────────────────────────────
  // Action Orchestrator (delegated to useActionOrchestrator hook)
  // Handles: handleActionIntent, auto-trigger, rejection effect,
  //          proceedWithAction, buildWitchStepResults, confirmThenAct
  // ───────────────────────────────────────────────────────────────────────────

  const {
    handleActionIntent,
    pendingRevealDialog,
    setPendingRevealDialog,
    pendingHunterStatusViewed,
  } = useActionOrchestrator({
    gameState,
    roomStatus,
    currentActionRole,
    currentSchema,
    effectiveSeat,
    effectiveRole,
    controlledSeat,
    actorSeatForUi,
    imActioner,
    isAudioPlaying,
    myUid,
    anotherIndex,
    setAnotherIndex,
    setSecondSeatIndex,
    submitAction,
    submitWolfVote,
    submitRevealAckSafe,
    sendWolfRobotHunterStatusViewed,
    getAutoTriggerIntent,
    findVotingWolfSeat,
    actionDialogs,
  });

  // Host dialog callbacks from hook (must be declared before dispatchInteraction)
  const {
    showPrepareToFlipDialog,
    showStartGameDialog,
    showLastNightInfoDialog,
    showRestartDialog,
    showSpeakOrderDialog,
    handleSettingsPress,
  } = useRoomHostDialogs({
    gameState,
    assignRoles,
    startGame,
    restartGame,
    getLastNightInfo: getLastNightInfoFn,
    setIsStartingGame,
    navigation,
    roomNumber,
  });

  // Role card modal state
  const [roleCardVisible, setRoleCardVisible] = useState(false);
  // 记录本次打开是否需要播放动画（在打开时根据 hasViewedRole 决定，避免状态更新后丢失）
  const [shouldPlayRevealAnimation, setShouldPlayRevealAnimation] = useState(false);

  const handleRoleCardClose = useCallback(() => {
    setRoleCardVisible(false);
    setShouldPlayRevealAnimation(false);
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Interaction Dispatcher (delegated to useInteractionDispatcher hook)
  // Handles: seat tap, long press, interactionContext, dispatchInteraction,
  //          policy evaluation, host control actions, reveal ack, bot takeover
  // ───────────────────────────────────────────────────────────────────────────

  const { dispatchInteraction, onSeatTapped, onSeatLongPressed } = useInteractionDispatcher({
    // ── Game state ──
    gameState,
    roomStatus,

    // ── Gate state ──
    isAudioPlaying,
    pendingRevealDialog,
    pendingHunterStatusViewed,

    // ── Identity ──
    isHost,
    imActioner,
    mySeatNumber,
    myRole,
    effectiveSeat,
    actorSeatForUi,
    actorRoleForUi,

    // ── Debug mode ──
    isDebugMode,
    controlledSeat,
    isDelegating,

    // ── Action intent handler ──
    handleActionIntent,
    getActionIntent,

    // ── Seat dialogs ──
    showEnterSeatDialog,
    showLeaveSeatDialog,

    // ── State setters ──
    setShouldPlayRevealAnimation,
    setRoleCardVisible,
    setControlledSeat,
    setPendingRevealDialog,

    // ── Submission callbacks ──
    viewedRole,
    submitRevealAckSafe,
    sendWolfRobotHunterStatusViewed,
    handleLeaveRoom,

    // ── Host control dialogs ──
    handleSettingsPress,
    showPrepareToFlipDialog,
    showStartGameDialog,
    showLastNightInfoDialog,
    showRestartDialog,
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Host: Show speaking order dialog when night ends (after audio finishes)
  // ───────────────────────────────────────────────────────────────────────────
  const hasShownSpeakOrderRef = useRef(false);

  useEffect(() => {
    // Only show once per game, only for host, only when game ended and audio finished
    // P0-FIX: 等待查验结果弹窗关闭后再显示发言顺序弹窗
    if (
      !isHost ||
      roomStatus !== GameStatus.ended ||
      isAudioPlaying ||
      pendingRevealDialog ||
      hasShownSpeakOrderRef.current
    )
      return;

    hasShownSpeakOrderRef.current = true;
    showSpeakOrderDialog();
  }, [isHost, roomStatus, isAudioPlaying, pendingRevealDialog, showSpeakOrderDialog]);

  // Reset speak order flag when game restarts
  useEffect(() => {
    if (roomStatus === GameStatus.unseated || roomStatus === GameStatus.seated) {
      hasShownSpeakOrderRef.current = false;
    }
  }, [roomStatus]);

  // Loading state
  if (!isInitialized || !gameState) {
    // Determine the display message: prefer specific error over generic loading message
    const displayMessage = showRetryButton && gameRoomError ? gameRoomError : loadingMessage;
    const isError = showRetryButton;

    if (isError) {
      return (
        <View style={styles.loadingContainer}>
          <Ionicons name="warning-outline" size={spacing.xxlarge + spacing.medium} color={colors.error} style={{ marginBottom: spacing.medium }} />
          <Text style={[styles.loadingText, styles.errorMessageText]}>{displayMessage}</Text>
          <View style={styles.retryButtonRow}>
            <TouchableOpacity
              style={[styles.errorBackButton, { backgroundColor: colors.primary }]}
              onPress={handleRetry}
            >
              <Text style={styles.errorBackButtonText}>重试</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.errorBackButton} onPress={() => navigation.goBack()}>
              <Text style={styles.errorBackButtonText}>返回</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return <LoadingScreen message={displayMessage} />;
  }

  // Get action message
  const getActionMessage = () => {
    if (!currentActionRole) return '';

    // FAIL-FAST: schema.ui.prompt must exist
    if (!currentSchema?.ui?.prompt) {
      throw new Error(`[FAIL-FAST] Missing schema.ui.prompt for role: ${currentActionRole}`);
    }

    // Bug fix (ONLY hunter gate): When wolfRobot has learned hunter (wolfRobotReveal exists)
    // and needs to view hunter status, show the hunter gate prompt instead of learning prompt.
    // NOTE: This is intentionally NOT a generic "any learned role" gate. Only hunter has
    // this extra UI gate before night advances.
    const isWolfRobotHunterGateActive =
      currentSchema.id === 'wolfRobotLearn' &&
      gameState?.wolfRobotReveal?.learnedRoleId === 'hunter' &&
      !gameState?.wolfRobotHunterStatusViewed;

    const baseMessage = isWolfRobotHunterGateActive
      ? (currentSchema.ui.hunterGatePrompt ?? currentSchema.ui.prompt)
      : currentSchema.ui.prompt;

    const wolfStatusLine = getWolfStatusLine();
    if (wolfStatusLine) {
      return `${baseMessage}\n${wolfStatusLine}`;
    }

    return baseMessage;
  };

  const actionMessage = getActionMessage();

  return (
    <SafeAreaView style={styles.container} testID={TESTIDS.roomScreenRoot}>
      {/* Header */}
      <View style={styles.header} testID={TESTIDS.roomHeader}>
        <TouchableOpacity
          onPress={() => dispatchInteraction({ kind: 'LEAVE_ROOM' })}
          style={styles.backButton}
          testID={TESTIDS.roomBackButton}
        >
          <Text style={styles.backButtonText}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <TouchableOpacity onPress={handleDebugTitleTap} activeOpacity={1}>
            <Text style={styles.headerTitle}>房间 {roomNumber}</Text>
          </TouchableOpacity>
          <Text style={styles.headerSubtitle}>{gameState.template.roles.length}人局</Text>
        </View>
        {/* Host Menu Dropdown - replaces headerSpacer */}
        <HostMenuDropdown
          visible={isHost}
          showFillWithBots={roomStatus === GameStatus.unseated}
          showMarkAllBotsViewed={isDebugMode && roomStatus === GameStatus.assigned}
          onFillWithBots={() => void fillWithBots()}
          onMarkAllBotsViewed={() => void markAllBotsViewed()}
        />
      </View>

      {/* Connection Status Bar */}
      {!isHost && (
        <ConnectionStatusBar status={connectionStatus} onForceSync={() => requestSnapshot()} />
      )}

      {/* Night Progress Indicator - only show during ongoing game */}
      {nightProgress && (
        <NightProgressIndicator
          currentStep={nightProgress.current}
          totalSteps={nightProgress.total}
          currentRoleName={nightProgress.roleName}
        />
      )}

      {/* Bot Mode Hint / Controlled Seat Banner - mutually exclusive */}
      {isDebugMode &&
        hasBots &&
        roomStatus === GameStatus.ongoing &&
        (controlledSeat !== null && gameState.players.get(controlledSeat) ? (
          <ControlledSeatBanner
            mode="controlled"
            controlledSeat={controlledSeat}
            botDisplayName={gameState.players.get(controlledSeat)?.displayName || 'Bot'}
            onRelease={() => setControlledSeat(null)}
          />
        ) : (
          <ControlledSeatBanner mode="hint" />
        ))}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Board Info - hidden during ongoing/ended, shown during setup phases */}
        {roomStatus !== GameStatus.ongoing && roomStatus !== GameStatus.ended && (
          <BoardInfoCard
            playerCount={gameState.template.roles.length}
            wolfRolesText={formatRoleList(wolfRoles, roleCounts)}
            godRolesText={formatRoleList(godRoles, roleCounts)}
            specialRolesText={
              specialRoles.length > 0 ? formatRoleList(specialRoles, roleCounts) : undefined
            }
            villagerCount={villagerCount}
            collapsed={false}
          />
        )}

        {/* Player Grid */}
        <PlayerGrid
          seats={seatViewModels}
          roomNumber={roomNumber}
          onSeatPress={onSeatTapped}
          onSeatLongPress={onSeatLongPressed}
          disabled={roomStatus === GameStatus.ongoing && isAudioPlaying}
          controlledSeat={controlledSeat}
          showBotRoles={isDebugMode && isHost}
        />

        {/* Show players who haven't viewed their roles yet */}
        {isHost && roomStatus === GameStatus.assigned && (
          <WaitingViewRoleList seatIndices={getPlayersNotViewedRole(toGameRoomLike(gameState))} />
        )}
      </ScrollView>

      {/* Bottom Action Panel - floating card with message + buttons */}
      <BottomActionPanel message={actionMessage} showMessage={imActioner && !isAudioPlaying}>
        {/* Host Control Buttons - dispatch events to policy */}
        <HostControlButtons
          isHost={isHost}
          showSettings={
            !isStartingGame &&
            !isAudioPlaying &&
            (roomStatus === GameStatus.unseated || roomStatus === GameStatus.seated)
          }
          showPrepareToFlip={roomStatus === GameStatus.seated}
          showStartGame={roomStatus === GameStatus.ready && !isStartingGame}
          showLastNightInfo={roomStatus === GameStatus.ended && !isAudioPlaying}
          showRestart={
            !isAudioPlaying &&
            (roomStatus === GameStatus.assigned ||
              roomStatus === GameStatus.ready ||
              roomStatus === GameStatus.ongoing ||
              roomStatus === GameStatus.ended)
          }
          onSettingsPress={() => dispatchInteraction({ kind: 'HOST_CONTROL', action: 'settings' })}
          onPrepareToFlipPress={() =>
            dispatchInteraction({ kind: 'HOST_CONTROL', action: 'prepareToFlip' })
          }
          onStartGamePress={() =>
            dispatchInteraction({ kind: 'HOST_CONTROL', action: 'startGame' })
          }
          onLastNightInfoPress={() =>
            dispatchInteraction({ kind: 'HOST_CONTROL', action: 'lastNightInfo' })
          }
          onRestartPress={() => dispatchInteraction({ kind: 'HOST_CONTROL', action: 'restart' })}
        />

        {/* Actioner: schema-driven bottom action buttons */}
        {(() => {
          const bottom = getBottomAction();
          if (!bottom.buttons.length) return null;
          return bottom.buttons.map((b) => (
            <ActionButton
              key={b.key}
              label={b.label}
              onPress={(_meta) => dispatchInteraction({ kind: 'BOTTOM_ACTION', intent: b.intent })}
            />
          ));
        })()}

        {/* View Role Card */}
        {/* P0-FIX: 使用 effectiveSeat 支持接管模式（Host 无 seat 但接管 bot 时也能查看身份） */}
        {(roomStatus === GameStatus.assigned ||
          roomStatus === GameStatus.ready ||
          roomStatus === GameStatus.ongoing ||
          roomStatus === GameStatus.ended) &&
          effectiveSeat !== null && (
            <ActionButton
              label="查看身份"
              onPress={(_meta) => dispatchInteraction({ kind: 'VIEW_ROLE' })}
            />
          )}

        {/* Greyed View Role (waiting for host) */}
        {(roomStatus === GameStatus.unseated || roomStatus === GameStatus.seated) &&
          effectiveSeat !== null && (
            <ActionButton
              label="查看身份"
              disabled
              onPress={(meta) => {
                // Policy decision: disabled button shows alert
                if (meta.disabled) {
                  showAlert('等待房主点击"准备看牌"分配角色');
                }
              }}
            />
          )}
      </BottomActionPanel>

      {/* Seat Confirmation Modal */}
      {/* Seat Confirmation Modal - only render when pendingSeatIndex is set */}
      {pendingSeatIndex !== null && (
        <SeatConfirmModal
          visible={seatModalVisible}
          modalType={modalType}
          seatNumber={pendingSeatIndex + 1}
          onConfirm={modalType === 'enter' ? handleConfirmSeat : handleConfirmLeave}
          onCancel={handleCancelSeat}
        />
      )}

      {/* Role Card Modal - 统一使用 RoleRevealAnimator */}
      {/* 只在首次查看时播放动画（shouldPlayRevealAnimation），后续直接显示静态卡片 */}
      {/* P0-FIX: 使用 effectiveRole 支持接管模式（Host 接管 bot 时显示 bot 的身份） */}
      {roleCardVisible &&
        effectiveRole &&
        (() => {
          // 如果动画是 none 或不需要播放动画，直接显示静态卡片
          if (resolvedRoleRevealAnimation === 'none' || !shouldPlayRevealAnimation) {
            return (
              <RoleCardSimple
                visible={roleCardVisible}
                roleId={effectiveRole}
                onClose={handleRoleCardClose}
              />
            );
          }

          // 首次查看，播放动画
          const roleSpec = getRoleSpec(effectiveRole);
          const alignmentMap: Record<string, 'wolf' | 'god' | 'villager'> = {
            [Faction.Wolf]: 'wolf',
            [Faction.God]: 'god',
            [Faction.Villager]: 'villager',
            [Faction.Special]: 'villager', // Special 归类为 villager
          };
          const effectiveRoleData: RoleData = createRoleData(
            effectiveRole,
            getRoleDisplayName(effectiveRole),
            alignmentMap[roleSpec.faction] ?? 'villager',
          );
          const allRoles = gameState?.template?.roles ?? template?.roles ?? [];
          const allRolesData: RoleData[] = allRoles.map((roleId) => {
            const spec = getRoleSpec(roleId);
            return createRoleData(
              roleId,
              getRoleDisplayName(roleId),
              alignmentMap[spec.faction] ?? 'villager',
            );
          });
          // resolvedRoleRevealAnimation 直接作为 effectType（Host 已解析 random → 具体动画）
          const effectType: RevealEffectType = resolvedRoleRevealAnimation as RevealEffectType;
          return (
            <RoleRevealAnimator
              visible={roleCardVisible}
              role={effectiveRoleData}
              effectType={effectType}
              allRoles={allRolesData}
              onComplete={handleRoleCardClose}
            />
          );
        })()}
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles factory
// ─────────────────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: spacing.medium,
      fontSize: typography.body,
      color: colors.textSecondary,
    },
    errorIcon: {
      fontSize: spacing.xxlarge + spacing.medium, // ~48
      marginBottom: spacing.medium,
    },
    errorMessageText: {
      color: colors.error,
      textAlign: 'center',
      paddingHorizontal: spacing.large,
    },
    errorBackButton: {
      marginTop: spacing.large,
      paddingHorizontal: spacing.large,
      paddingVertical: spacing.medium,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.medium,
    },
    errorBackButtonText: {
      color: colors.textInverse,
      fontSize: typography.body,
      fontWeight: typography.weights.semibold,
    },
    retryButtonRow: {
      flexDirection: 'row',
      gap: spacing.small + spacing.tight, // ~12
      marginTop: spacing.large,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.medium,
      backgroundColor: colors.surface,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: componentSizes.avatar.md,
      height: componentSizes.avatar.md,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backButtonText: {
      color: colors.text,
      fontSize: typography.title,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: typography.subtitle,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.tight / 2,
    },
    headerSpacer: {
      minWidth: 60,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.medium,
      // Extra bottom padding so content isn't hidden behind BottomActionPanel
      paddingBottom: spacing.xxlarge + spacing.xlarge,
    },
  });
}

export default RoomScreen;
