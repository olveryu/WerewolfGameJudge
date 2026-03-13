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
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createStyles as createChatStyles } from '@/components/AIChatBubble/AIChatBubble.styles';
import { NotepadModal } from '@/components/AIChatBubble/NotepadModal';
import { AlertModal } from '@/components/AlertModal';
import { LoadingScreen } from '@/components/LoadingScreen';
import { RoleCardSimple } from '@/components/RoleCardSimple';
import { SettingsSheet } from '@/components/SettingsSheet';
import { RootStackParamList } from '@/navigation/types';
import { TESTIDS } from '@/testids';
import type { ThemeColors } from '@/theme';
import { fixed, spacing, useTheme } from '@/theme';
import { showAlert } from '@/utils/alert';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import { ActionButton } from './components/ActionButton';
import { AuthGateOverlay } from './components/AuthGateOverlay';
import { BoardInfoCard } from './components/BoardInfoCard';
import { BottomActionPanel } from './components/BottomActionPanel';
import { ConnectionStatusBar } from './components/ConnectionStatusBar';
import { ControlledSeatBanner } from './components/ControlledSeatBanner';
import { HostControlButtons } from './components/HostControlButtons';
import { HostMenuDropdown } from './components/HostMenuDropdown';
import { NightProgressIndicator } from './components/NightProgressIndicator';
import { NightReviewModal } from './components/NightReviewModal';
import { PlayerGrid } from './components/PlayerGrid';
import { QRCodeModal } from './components/QRCodeModal';
import { RoleCardModal } from './components/RoleCardModal';
import { SeatConfirmModal } from './components/SeatConfirmModal';
import { ShareReviewModal } from './components/ShareReviewModal';
import { createRoomScreenComponentStyles } from './components/styles';
import { useRoomScreenState } from './hooks/useRoomScreenState';
import { buildNightReviewData } from './NightReview.helpers';
import { createRoomScreenStyles } from './RoomScreen.styles';
import { shareQRCodeImage } from './shareQRCode';
import { buildRoomUrl, shareOrCopyRoomLink } from './shareRoom';

type Props = NativeStackScreenProps<RootStackParamList, 'Room'>;

/** Maps GameStatus to a user-facing Chinese label for the header subtitle. */
function getStatusLabel(status: GameStatus): string {
  switch (status) {
    case GameStatus.Unseated:
      return '等待入座';
    case GameStatus.Seated:
      return '等待房主分配角色';
    case GameStatus.Assigned:
      return '查看身份';
    case GameStatus.Ready:
      return '准备就绪';
    case GameStatus.Ongoing:
      return '游戏进行中';
    case GameStatus.Ended:
      return '游戏结束';
  }
}

/** Maps GameStatus to a semantic theme color for the status pill badge. */
function getStatusColor(status: GameStatus, themeColors: ThemeColors): string {
  switch (status) {
    case GameStatus.Unseated:
      return themeColors.warning;
    case GameStatus.Seated:
    case GameStatus.Assigned:
      return themeColors.info;
    case GameStatus.Ready:
    case GameStatus.Ongoing:
      return themeColors.success;
    case GameStatus.Ended:
      return themeColors.textSecondary;
  }
}

export const RoomScreen: React.FC<Props> = ({ route, navigation }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createRoomScreenStyles(colors), [colors]);
  const componentStyles = useMemo(() => createRoomScreenComponentStyles(colors), [colors]);

  // ─── Notepad ──────────────────────────────────────────────────────────
  const chatStyles = useMemo(() => createChatStyles(colors), [colors]);
  const [notepadOpen, setNotepadOpen] = useState(false);

  const handleNotepadPress = useCallback(() => {
    setNotepadOpen(true);
  }, []);

  // ─── QR Code Modal state ──────────────────────────────────────────────
  const [qrModalVisible, setQrModalVisible] = useState(false);

  const handleShareRoom = useCallback(() => {
    setQrModalVisible(true);
  }, []);

  const handleCopyLink = useCallback(() => {
    void shareOrCopyRoomLink(route.params.roomNumber)
      .then((result) => {
        if (result === 'copied') {
          showAlert('已复制', '房间链接已复制到剪贴板');
        } else if (result === 'failed') {
          showAlert('链接分享失败', '无法复制链接，请手动分享房间号');
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
    navigation.navigate('Settings');
  }, [navigation]);

  const {
    // Route params
    roomNumber,
    template,
    // Game state
    gameState,
    isHost,
    roomStatus,
    isAudioPlaying,
    roleRevealAnimation,
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
    clearAllSeats,
    setControlledSeat,
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
    actionMessage,
    // Actioner
    imActioner,
    // Interaction
    dispatchInteraction,
    onSeatTapped,
    onSeatLongPressed,
    getBottomAction,
    handleDebugTitleTap,
    // Local UI state
    isStartingGame,
    isHostActionSubmitting,
    isActionSubmitting,
    // Seat modal
    seatModalVisible,
    pendingSeat,
    modalType,
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
    nightReviewVisible,
    openNightReview,
    openShareFromReview,
    closeNightReview,
    // Share review modal
    shareReviewVisible,
    closeShareReview,
    shareNightReview,
    // Settings sheet
    settingsSheetVisible,
    bgmEnabled,
    handleOpenSettings,
    handleCloseSettings,
    handleAnimationChange,
    handleBgmChange,
    // Notepad
    notepad,
  } = useRoomScreenState(route.params, navigation);

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
    <SafeAreaView style={styles.container} testID={TESTIDS.roomScreenRoot}>
      {/* Header */}
      <View style={styles.header} testID={TESTIDS.roomHeader}>
        <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
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
          <View style={styles.headerSubtitleRow}>
            <Text style={[styles.headerStatusText, { color: getStatusColor(roomStatus, colors) }]}>
              {getStatusLabel(roomStatus)}
            </Text>
            {(roomStatus === GameStatus.Unseated || roomStatus === GameStatus.Seated) && (
              <>
                <Text style={styles.headerSeparator}> · </Text>
                <TouchableOpacity onPress={handleShareRoom} activeOpacity={fixed.activeOpacity}>
                  <Text style={styles.headerShareLink}>分享房间</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
        {/* Header right: host menu */}
        <View style={styles.headerRight}>
          <HostMenuDropdown
            visible
            showSettings={
              isHost &&
              !isStartingGame &&
              !isAudioPlaying &&
              (roomStatus === GameStatus.Unseated || roomStatus === GameStatus.Seated)
            }
            showUserSettings
            showFillWithBots={isHost && roomStatus === GameStatus.Unseated}
            showMarkAllBotsViewed={isHost && isDebugMode && roomStatus === GameStatus.Assigned}
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
            onClearAllSeats={() =>
              void clearAllSeats().catch((err) => {
                handleError(err, {
                  label: 'clearAllSeats',
                  logger: roomScreenLog,
                  alertTitle: false,
                });
              })
            }
            onSettings={handleOpenSettings}
            onUserSettings={handleAvatarPress}
            styles={componentStyles.hostMenuDropdown}
          />
        </View>
      </View>

      {/* Connection Status Bar — only visible when disconnected */}
      <ConnectionStatusBar status={connectionStatus} styles={componentStyles.connectionStatusBar} />

      {/* Night Progress Indicator - only show during ongoing game */}
      {nightProgress && (
        <NightProgressIndicator
          currentStep={nightProgress.current}
          totalSteps={nightProgress.total}
          currentRoleName={nightProgress.roleName}
          styles={componentStyles.nightProgressIndicator}
        />
      )}

      {/* Bot Mode Hint / Controlled Seat Banner - mutually exclusive */}
      {isDebugMode &&
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
          playerCount={gameState.template.roles.length}
          wolfRoleItems={wolfRoleItems}
          godRoleItems={godRoleItems}
          specialRoleItems={specialRoleItems}
          villagerCount={villagerCount}
          villagerRoleItems={villagerRoleItems}
          collapsed={roomStatus === GameStatus.Ongoing || roomStatus === GameStatus.Ended}
          onRolePress={handleSkillPreviewOpen}
          onNotepadPress={handleNotepadPress}
          speakingOrderText={speakingOrderText}
          styles={componentStyles.boardInfoCard}
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
        />
      </ScrollView>

      {/* Bottom Action Panel - floating card with message + buttons */}
      <BottomActionPanel
        message={actionMessage}
        showMessage={!isAudioPlaying && (imActioner || roomStatus === GameStatus.Ended)}
        styles={componentStyles.bottomActionPanel}
        isDark={isDark}
      >
        {/* Actioner: schema-driven bottom action buttons */}
        {(() => {
          const bottom = getBottomAction();
          if (!bottom.buttons.length) return null;
          return bottom.buttons.map((b) => (
            <ActionButton
              key={b.key}
              label={b.label}
              onPress={(_meta) => {
                dispatchInteraction({ kind: 'BOTTOM_ACTION', intent: b.intent });
              }}
              styles={componentStyles.actionButton}
            />
          ));
        })()}

        {/* View Role Card */}
        {/* P0-FIX: 使用 effectiveSeat 支持接管模式（Host 无 seat 但接管 bot 时也能查看身份） */}
        {(roomStatus === GameStatus.Assigned ||
          roomStatus === GameStatus.Ready ||
          roomStatus === GameStatus.Ongoing ||
          roomStatus === GameStatus.Ended) &&
          effectiveSeat !== null && (
            <ActionButton
              label="查看身份"
              onPress={(_meta) => dispatchInteraction({ kind: 'VIEW_ROLE' })}
              styles={componentStyles.actionButton}
            />
          )}
        {/* Greyed View Role (waiting for host) */}
        {(roomStatus === GameStatus.Unseated || roomStatus === GameStatus.Seated) &&
          effectiveSeat !== null && (
            <ActionButton
              label="等待分配角色…"
              disabled
              onPress={(meta) => {
                // Policy decision: disabled button shows alert
                if (meta.disabled) {
                  showAlert('等待房主分配角色…');
                }
              }}
              styles={componentStyles.actionButton}
            />
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
              actionStyles={componentStyles.actionButton}
              dangerStyles={componentStyles.dangerActionButton}
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
              <ActionButton
                label="昨夜信息"
                testID={TESTIDS.lastNightInfoButton}
                onPress={() => showLastNightInfo()}
                styles={componentStyles.dangerActionButton}
              />
            )}
            {/* Night Review Button — host + spectators (no seat) + allowed players, ended phase only */}
            {(isHost ||
              effectiveSeat === null ||
              (effectiveSeat !== null &&
                gameState?.nightReviewAllowedSeats?.includes(effectiveSeat))) &&
              roomStatus === GameStatus.Ended &&
              !isAudioPlaying && (
                <ActionButton
                  label="详细信息"
                  testID={TESTIDS.nightReviewButton}
                  onPress={() => openNightReview()}
                  styles={componentStyles.dangerActionButton}
                />
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
          seatNumber={pendingSeat + 1}
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
      />

      {/* Night Review Modal — 裁判/观战者用，显示夜晚行动 + 全员身份 */}
      {nightReviewVisible && gameState && (
        <NightReviewModal
          visible={nightReviewVisible}
          data={buildNightReviewData(gameState)}
          roomNumber={roomNumber}
          onClose={closeNightReview}
          onShareToPlayers={isHost ? openShareFromReview : undefined}
        />
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

      {/* Notepad Modal — 笔记弹窗 */}
      <NotepadModal
        visible={notepadOpen}
        onClose={() => setNotepadOpen(false)}
        notepad={notepad}
        styles={chatStyles}
      />

      {/* Settings Sheet — Host 可调动画和 BGM 设置 */}
      <SettingsSheet
        visible={settingsSheetVisible}
        onClose={handleCloseSettings}
        roleRevealAnimation={roleRevealAnimation}
        bgmValue={bgmEnabled ? 'on' : 'off'}
        onAnimationChange={handleAnimationChange}
        onBgmChange={handleBgmChange}
        resolvedAnimation={resolvedRoleRevealAnimation}
      />
    </SafeAreaView>
  );
};
