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
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import { BlurView } from 'expo-blur';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { AlertModal } from '@/components/AlertModal';
import { Button } from '@/components/Button';
import { LoadingScreen } from '@/components/LoadingScreen';
import { RoleCardSimple } from '@/components/RoleCardSimple';
import { useAuthContext } from '@/contexts/AuthContext';
import { useUserStatsQuery } from '@/hooks/queries/useUserStatsQuery';
import { RootStackParamList } from '@/navigation/types';
import { isAIChatReady } from '@/services/feature/AIChatService';
import { TESTIDS } from '@/testids';
import { colors, componentSizes, layout, spacing } from '@/theme';
import { askAIAboutRole } from '@/utils/aiChatBridge';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import { AuthGateOverlay } from './components/AuthGateOverlay';
import { BoardInfoCard } from './components/BoardInfoCard';
import { BoardNominationModal } from './components/BoardNominationList';
import { BottomActionPanel } from './components/BottomActionPanel';
import { ChooseBottomCardModal } from './components/ChooseBottomCardModal';
import { ControlledSeatBanner } from './components/ControlledSeatBanner';
import { HeaderActions } from './components/HeaderActions';
import { HostControlButtons } from './components/HostControlButtons';
import { NightReviewModal } from './components/NightReviewModal';
import { NightReviewShareCard } from './components/NightReviewShareCard';
import { PlayerGrid } from './components/PlayerGrid';
import { PlayerProfileCard } from './components/PlayerProfileCard';
import { QRCodeModal } from './components/QRCodeModal';
import { RoleCardModal } from './components/RoleCardModal';
import { SeatConfirmModal } from './components/SeatConfirmModal';
import { ShareReviewModal } from './components/ShareReviewModal';
import { StatusRibbon } from './components/StatusRibbon';
import { createRoomScreenComponentStyles } from './components/styles';
import { useRoomScreenState } from './hooks/useRoomScreenState';
import { createRoomScreenStyles } from './RoomScreen.styles';
import { shareQRCodeImage } from './shareQRCode';
import { buildRoomUrl, shareOrCopyRoomLink } from './shareRoom';

type Props = NativeStackScreenProps<RootStackParamList, 'Room'>;

export const RoomScreen: React.FC<Props> = ({ route, navigation }) => {
  const { user } = useAuthContext();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createRoomScreenStyles(colors), []);
  const componentStyles = useMemo(() => createRoomScreenComponentStyles(colors), []);

  // ─── Notepad ──────────────────────────────────────────────────────────
  const handleNotepadPress = useCallback(() => {
    navigation.navigate('Notepad', { roomNumber: route.params.roomNumber });
  }, [navigation, route.params.roomNumber]);

  // ─── QR Code Modal state ──────────────────────────────────────────────
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [nominationModalVisible, setNominationModalVisible] = useState(false);
  const hasAutoShownQR = useRef(false);

  // User level for top bar display (shared cache via TanStack Query)
  const { data: userStats } = useUserStatsQuery();
  const userLevel = userStats?.level ?? null;

  const handleShareRoom = useCallback(() => {
    setQrModalVisible(true);
  }, []);

  const handleCopyLink = useCallback(() => {
    void shareOrCopyRoomLink(route.params.roomNumber)
      .then((result) => {
        if (result === 'copied') {
          toast.success('房间链接已复制');
        } else if (result === 'failed') {
          showErrorAlert('链接分享失败', '无法复制链接，请手动分享房间号');
        }
        // 'shared' → system share sheet already provided feedback
        // 'cancelled' → user dismissed intentionally, no alert needed
      })
      .catch((e) => {
        handleError(e, {
          label: '分享房间',
          logger: roomScreenLog,
          alertTitle: '链接分享失败',
          alertMessage: '无法复制链接，请手动分享房间号',
        });
      });
  }, [route.params.roomNumber]);

  const handleShareQRImage = useCallback(
    (getBase64: () => Promise<string>) => {
      void shareQRCodeImage(getBase64, route.params.roomNumber).catch((e) => {
        handleError(e, {
          label: '分享二维码',
          logger: roomScreenLog,
          alertTitle: '二维码分享失败',
          alertMessage: '无法分享二维码图片',
        });
      });
    },
    [route.params.roomNumber],
  );

  const handleAvatarPress = useCallback(() => {
    navigation.navigate('Settings', { roomNumber: route.params.roomNumber });
  }, [navigation, route.params.roomNumber]);

  const handleEncyclopedia = useCallback(() => {
    navigation.navigate('Encyclopedia', { roomNumber: route.params.roomNumber });
  }, [navigation, route.params.roomNumber]);

  const handleAnimationSettings = useCallback(() => {
    navigation.navigate('AnimationSettings', { roomNumber: route.params.roomNumber });
  }, [navigation, route.params.roomNumber]);

  const handleMusicSettings = useCallback(() => {
    navigation.navigate('MusicSettings', { roomNumber: route.params.roomNumber });
  }, [navigation, route.params.roomNumber]);

  const {
    // Route params
    roomNumber,
    template,
    // Game state
    gameState,
    isHost,
    roomStatus,
    currentSchema,
    isAudioPlaying,
    resolvedRoleRevealAnimation,
    connectionStatus,
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
    profileCardTargetUid,
    profileCardTargetSeat,
    profileCardRosterName,
    closeProfileCard,
    handleProfileKick,
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
  } = useRoomScreenState(route.params, navigation);

  // ─── Board nomination callbacks ────────────────────────────────────────
  const showNominations = roomStatus === GameStatus.Unseated || roomStatus === GameStatus.Seated;

  const nominationCount = gameState?.boardNominations
    ? Object.keys(gameState.boardNominations).length
    : 0;
  const hasMyNomination = user?.uid ? !!gameState?.boardNominations?.[user.uid] : false;

  const handleNominate = useCallback(() => {
    navigation.navigate('BoardPicker', {
      nominateMode: { roomCode: roomNumber },
    });
  }, [navigation, roomNumber]);

  const handleViewNominations = useCallback(() => {
    setNominationModalVisible(true);
  }, []);

  // Auto-close nomination modal when game progresses past setup phase
  useEffect(() => {
    if (!showNominations) {
      setNominationModalVisible(false);
    }
  }, [showNominations]);

  // ─── Auto-show QR invite card after room creation ─────────────────────
  useEffect(() => {
    if (isInitialized && gameState && isHost && template && !hasAutoShownQR.current) {
      hasAutoShownQR.current = true;
      setQrModalVisible(true);
    }
  }, [isInitialized, gameState, isHost, template]);

  // ─── Loading / Error early returns ─────────────────────────────────────
  if (!isInitialized || !gameState) {
    // Auth gate: first-time user via direct URL — show login options (must check before error)
    if (needsAuth) {
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
    <SafeAreaView
      style={styles.container}
      edges={['left', 'right']}
      testID={TESTIDS.roomScreenRoot}
    >
      {/* Header */}
      <View
        style={[styles.header, { paddingTop: insets.top + layout.headerPaddingV }]}
        testID={TESTIDS.roomHeader}
      >
        <BlurView intensity={60} tint="default" style={StyleSheet.absoluteFill} />
        <View style={styles.headerLeft}>
          <Button
            variant="icon"
            onPress={() => dispatchInteraction({ kind: 'LEAVE_ROOM' })}
            style={styles.backButton}
            testID={TESTIDS.roomBackButton}
          >
            <Ionicons name="chevron-back" size={componentSizes.icon.lg} color={colors.text} />
          </Button>
          {/* BGM Toggle — all players, ended phase only, right of back button */}
          {roomStatus === GameStatus.Ended && !isAudioPlaying && (
            <Button
              variant="icon"
              onPress={isBgmPlaying ? stopBgm : playBgm}
              style={styles.backButton}
              testID={TESTIDS.bgmToggleButton}
            >
              <Ionicons
                name={isBgmPlaying ? 'pause' : 'musical-notes'}
                size={componentSizes.icon.md}
                color={isBgmPlaying ? colors.primary : colors.text}
              />
            </Button>
          )}
        </View>
        <View style={styles.headerCenter}>
          <TouchableOpacity onPress={handleDebugTitleTap} activeOpacity={1}>
            <Text style={styles.headerTitle}>房间 {roomNumber}</Text>
          </TouchableOpacity>
        </View>
        {/* Header right: encyclopedia + host menu */}
        <View style={styles.headerRight}>
          <Button
            variant="icon"
            onPress={handleEncyclopedia}
            style={styles.backButton}
            testID={TESTIDS.roomEncyclopediaButton}
          >
            <Ionicons name="book-outline" size={componentSizes.icon.md} color={colors.text} />
          </Button>
          <HeaderActions
            visible
            user={user}
            level={userLevel}
            showUserSettings
            showShareRoom={roomStatus === GameStatus.Unseated || roomStatus === GameStatus.Seated}
            showAnimationSettings={
              isHost && !isStartingGame && !isAudioPlaying && roomStatus !== GameStatus.Ongoing
            }
            showMusicSettings={
              isHost && !isStartingGame && !isAudioPlaying && roomStatus !== GameStatus.Ongoing
            }
            showFillWithBots={isHost && roomStatus === GameStatus.Unseated}
            showMarkAllBotsViewed={isHost && isDebugMode && roomStatus === GameStatus.Assigned}
            showMarkAllBotsGroupConfirmed={
              isHost &&
              isDebugMode &&
              !isAudioPlaying &&
              roomStatus === GameStatus.Ongoing &&
              currentSchema?.kind === 'groupConfirm'
            }
            showClearAllSeats={
              isHost &&
              (roomStatus === GameStatus.Unseated || roomStatus === GameStatus.Seated) &&
              !!gameState &&
              Array.from(gameState.players.values()).some((p) => p !== null)
            }
            onFillWithBots={() =>
              void fillWithBots().catch((err) => {
                handleError(err, {
                  label: 'fillWithBots',
                  logger: roomScreenLog,
                  alertTitle: false,
                });
              })
            }
            onMarkAllBotsViewed={() =>
              void markAllBotsViewed().catch((err) => {
                handleError(err, {
                  label: 'markAllBotsViewed',
                  logger: roomScreenLog,
                  alertTitle: false,
                });
              })
            }
            onMarkAllBotsGroupConfirmed={() =>
              void markAllBotsGroupConfirmed().catch((err) => {
                handleError(err, {
                  label: 'markAllBotsGroupConfirmed',
                  logger: roomScreenLog,
                  alertTitle: false,
                });
              })
            }
            onClearAllSeats={() =>
              void clearAllSeats().catch((err) => {
                handleError(err, {
                  label: 'clearAllSeats',
                  logger: roomScreenLog,
                  alertTitle: false,
                });
              })
            }
            onAnimationSettings={handleAnimationSettings}
            onMusicSettings={handleMusicSettings}
            onUserSettings={handleAvatarPress}
            onShareRoom={handleShareRoom}
            styles={componentStyles.headerActions}
          />
        </View>
      </View>

      {/* StatusRibbon — unified slot: connection > night progress > speaking order > host guide */}
      <StatusRibbon
        connectionStatus={connectionStatus}
        nightProgress={nightProgress}
        guideMessage={guideMessage}
        speakingOrderText={speakingOrderText}
        styles={componentStyles.statusRibbon}
        connectionStatusBarStyles={componentStyles.connectionStatusBar}
        nightProgressIndicatorStyles={componentStyles.nightProgressIndicator}
        hostGuideBannerStyles={componentStyles.hostGuideBanner}
      />

      {/* Bot Mode Hint / Controlled Seat Banner - mutually exclusive */}
      {isDebugMode &&
        isHost &&
        hasBots &&
        roomStatus === GameStatus.Ongoing &&
        (controlledSeat !== null && gameState.players.get(controlledSeat) ? (
          <ControlledSeatBanner
            mode="controlled"
            controlledSeat={controlledSeat}
            botDisplayName={gameState.players.get(controlledSeat)?.displayName || 'Bot'}
            onRelease={() => setControlledSeat(null)}
            styles={componentStyles.controlledSeatBanner}
          />
        ) : (
          <ControlledSeatBanner mode="hint" styles={componentStyles.controlledSeatBanner} />
        ))}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Board Info - collapsed during ongoing/ended, expanded during setup */}
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
          styles={componentStyles.boardInfoCard}
          showNominations={showNominations}
          hasMyNomination={hasMyNomination}
          nominationCount={nominationCount}
          onNominatePress={handleNominate}
          onViewNominations={handleViewNominations}
        />

        {/* Player Grid */}
        <PlayerGrid
          seats={seatViewModels}
          roomNumber={roomNumber}
          onSeatPress={onSeatTapped}
          onSeatLongPress={onSeatLongPressed}
          disabled={(roomStatus === GameStatus.Ongoing && isAudioPlaying) || isActionSubmitting}
          controlledSeat={controlledSeat}
          showBotRoles={isDebugMode && isHost}
          showLevels={roomStatus !== GameStatus.Ongoing}
        />
      </ScrollView>

      {/* Bottom Action Panel - floating card with message + buttons */}
      <BottomActionPanel
        message={actionMessage}
        showMessage={!isAudioPlaying && (imActioner || roomStatus === GameStatus.Ended)}
        styles={componentStyles.bottomActionPanel}
        bottomInset={insets.bottom}
      >
        {/* Actioner: schema-driven bottom action buttons */}
        {(() => {
          const bottom = getBottomAction();
          if (!bottom.buttons.length) return null;
          return bottom.buttons.map((b) => (
            <Button
              key={b.key}
              variant="primary"
              onPress={() => {
                dispatchInteraction({ kind: 'BOTTOM_ACTION', intent: b.intent });
              }}
            >
              {b.label}
            </Button>
          ));
        })()}

        {/* View Role Card */}
        {/* P0-FIX: 使用 effectiveSeat 支持接管模式（Host 无 seat 但接管 bot 时也能查看身份） */}
        {(roomStatus === GameStatus.Assigned ||
          roomStatus === GameStatus.Ready ||
          roomStatus === GameStatus.Ongoing ||
          roomStatus === GameStatus.Ended) &&
          effectiveSeat !== null && (
            <Button variant="primary" onPress={() => dispatchInteraction({ kind: 'VIEW_ROLE' })}>
              查看身份
            </Button>
          )}
        {/* Greyed View Role (waiting for host) */}
        {(roomStatus === GameStatus.Unseated || roomStatus === GameStatus.Seated) &&
          effectiveSeat !== null && (
            <Button
              variant="primary"
              disabled
              fireWhenDisabled
              onPress={(meta: { disabled: boolean }) => {
                // Policy decision: disabled button shows alert
                if (meta.disabled) {
                  toast.info('等待房主开始分配角色');
                }
              }}
            >
              等待房主开始
            </Button>
          )}

        {/* Secondary row: Host controls + review buttons */}
        {(isHost || roomStatus === GameStatus.Ended) && (
          <View style={componentStyles.bottomActionPanel.secondaryRow}>
            {/* Host Control Buttons - dispatch events to policy */}
            <HostControlButtons
              isHost={isHost}
              showSettings={
                !isStartingGame &&
                !isAudioPlaying &&
                (roomStatus === GameStatus.Unseated || roomStatus === GameStatus.Seated)
              }
              showPrepareToFlip={roomStatus === GameStatus.Seated}
              showStartGame={roomStatus === GameStatus.Ready && !isStartingGame}
              showRestart={
                !isAudioPlaying &&
                (roomStatus === GameStatus.Assigned ||
                  roomStatus === GameStatus.Ready ||
                  roomStatus === GameStatus.Ongoing ||
                  roomStatus === GameStatus.Ended)
              }
              disabled={isHostActionSubmitting}
              onSettingsPress={() =>
                dispatchInteraction({ kind: 'HOST_CONTROL', action: 'settings' })
              }
              onPrepareToFlipPress={() =>
                dispatchInteraction({ kind: 'HOST_CONTROL', action: 'prepareToFlip' })
              }
              onStartGamePress={() =>
                dispatchInteraction({ kind: 'HOST_CONTROL', action: 'startGame' })
              }
              onRestartPress={() =>
                dispatchInteraction({ kind: 'HOST_CONTROL', action: 'restart' })
              }
            />
            {/* Last Night Info — host only, ended phase only */}
            {isHost && roomStatus === GameStatus.Ended && !isAudioPlaying && (
              <Button
                variant="danger"
                testID={TESTIDS.lastNightInfoButton}
                onPress={() => showLastNightInfo()}
              >
                昨夜信息
              </Button>
            )}
            {/* Night Review Button — host + spectators (no seat) + allowed players, ended phase only */}
            {(isHost ||
              effectiveSeat === null ||
              (effectiveSeat !== null &&
                gameState?.nightReviewAllowedSeats?.includes(effectiveSeat))) &&
              roomStatus === GameStatus.Ended &&
              !isAudioPlaying && (
                <Button
                  variant="danger"
                  testID={TESTIDS.nightReviewButton}
                  onPress={() => openNightReview()}
                >
                  详细信息
                </Button>
              )}
          </View>
        )}
      </BottomActionPanel>

      {/* Continue Game Overlay — shown after Host rejoin to unlock audio */}
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
          seatNumber={pendingSeat}
          isSubmitting={isSeatSubmitting}
          onConfirm={modalType === 'enter' ? handleConfirmSeat : handleConfirmLeave}
          onCancel={handleCancelSeat}
          styles={componentStyles.seatConfirmModal}
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
          allRoleIds={gameState?.template?.roles ?? template?.roles ?? []}
          remainingCards={
            gameState
              ? Array.from(gameState.players.values()).filter((p) => p && !p.hasViewedRole).length +
                (shouldPlayRevealAnimation ? 1 : 0)
              : 0
          }
          onClose={handleRoleCardClose}
          seerLabelMap={gameState?.seerLabelMap}
        />
      )}

      {/* Skill Preview Modal — triggered by tapping a role chip in BoardInfoCard */}
      <RoleCardSimple
        visible={skillPreviewRoleId !== null}
        roleId={skillPreviewRoleId}
        onClose={handleSkillPreviewClose}
        showRealIdentity
        onAskAI={
          isAIChatReady() ? (rid) => askAIAboutRole(rid, handleSkillPreviewClose) : undefined
        }
      />

      {/* Player Profile Card — triggered by tapping another player's seat */}
      <PlayerProfileCard
        visible={profileCardVisible}
        onClose={closeProfileCard}
        targetUid={profileCardTargetUid}
        targetSeat={profileCardTargetSeat}
        rosterName={profileCardRosterName}
        isHost={isHost}
        onKick={handleProfileKick}
      />

      {/* Night Review Modal — 裁判/观战者用，显示夜晚行动 + 全员身份 */}
      {nightReviewVisible && nightReviewData && (
        <NightReviewModal
          visible={nightReviewVisible}
          data={nightReviewData}
          onClose={closeNightReview}
        />
      )}

      {/* Share card — mounted on-demand during capture only */}
      {isCapturingShareCard && nightReviewData && (
        <View style={styles.hiddenShareCardContainer} pointerEvents="none">
          <NightReviewShareCard
            ref={nightReviewShareCardRef}
            data={nightReviewData}
            roomNumber={roomNumber}
          />
        </View>
      )}

      {/* Share Review Modal — Host 选择分享详细信息的座位 */}
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

      {/* QR Code Modal — 房间二维码分享 */}
      <QRCodeModal
        visible={qrModalVisible}
        roomNumber={roomNumber}
        roomUrl={buildRoomUrl(roomNumber)}
        onShareImage={handleShareQRImage}
        onCopyLink={handleCopyLink}
        onClose={() => setQrModalVisible(false)}
      />

      {/* Board Nomination Modal — 板子建议列表 */}
      {nominationModalVisible && (
        <BoardNominationModal
          visible={nominationModalVisible}
          nominations={gameState?.boardNominations}
          myUid={user?.uid ?? null}
          isHost={isHost}
          currentPlayerCount={gameState?.template.numberOfPlayers ?? 0}
          onUpvote={boardUpvote}
          onWithdraw={boardWithdraw}
          clearAllSeats={clearAllSeats}
          onClose={() => setNominationModalVisible(false)}
        />
      )}

      {/* Choose Bottom Card Modal — 盗宝大师 / 盗贼底牌选择 */}
      {chooseCardModalVisible && gameState?.bottomCards && (
        <ChooseBottomCardModal
          visible={chooseCardModalVisible}
          bottomCards={gameState.bottomCards}
          confirmText={currentSchema?.ui?.confirmText ?? ''}
          disabledIndices={bottomCardDisabledIndices}
          disabledHint={bottomCardDisabledHint}
          subtitle={bottomCardSubtitle}
          onChoose={handleChooseCard}
          onClose={closeChooseCardModal}
        />
      )}
    </SafeAreaView>
  );
};
