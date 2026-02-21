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
import * as Sentry from '@sentry/react-native';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import React, { useCallback, useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/LoadingScreen';
import { RoleCardSimple } from '@/components/RoleCardSimple';
import { RootStackParamList } from '@/navigation/types';
import { TESTIDS } from '@/testids';
import { spacing, useColors } from '@/theme';
import { showAlert } from '@/utils/alert';
import { roomScreenLog } from '@/utils/logger';

import { ActionButton } from './components/ActionButton';
import { AuthGateOverlay } from './components/AuthGateOverlay';
import { BoardInfoCard } from './components/BoardInfoCard';
import { BottomActionPanel } from './components/BottomActionPanel';
import { ConnectionStatusBar } from './components/ConnectionStatusBar';
import { ContinueGameOverlay } from './components/ContinueGameOverlay';
import { ControlledSeatBanner } from './components/ControlledSeatBanner';
import { HostControlButtons } from './components/HostControlButtons';
import { HostMenuDropdown } from './components/HostMenuDropdown';
import { NightProgressIndicator } from './components/NightProgressIndicator';
import { NightReviewModal } from './components/NightReviewModal';
import { PlayerGrid } from './components/PlayerGrid';
import { RoleCardModal } from './components/RoleCardModal';
import { SeatConfirmModal } from './components/SeatConfirmModal';
import { createRoomScreenComponentStyles } from './components/styles';
import { useRoomScreenState } from './hooks/useRoomScreenState';
import { buildNightReviewData } from './NightReview.helpers';
import { createRoomScreenStyles } from './RoomScreen.styles';
import { shareOrCopyRoomLink } from './shareRoom';

type Props = NativeStackScreenProps<RootStackParamList, 'Room'>;

export const RoomScreen: React.FC<Props> = ({ route, navigation }) => {
  const colors = useColors();
  const styles = useMemo(() => createRoomScreenStyles(colors), [colors]);
  const componentStyles = useMemo(() => createRoomScreenComponentStyles(colors), [colors]);

  const handleShareRoom = useCallback(() => {
    void shareOrCopyRoomLink(route.params.roomNumber)
      .then((result) => {
        if (result === 'copied') {
          showAlert('已复制', '房间链接已复制到剪贴板');
        } else if (result === 'failed') {
          showAlert('分享失败', '无法复制链接，请手动分享房间号');
        }
        // 'shared' → system share sheet already provided feedback
        // 'cancelled' → user dismissed intentionally, no alert needed
      })
      .catch((e) => {
        roomScreenLog.error('Share room failed:', e);
        Sentry.captureException(e);
        showAlert('分享失败', '无法复制链接，请手动分享房间号');
      });
  }, [route.params.roomNumber]);

  const {
    // Route params
    roomNumber,
    template,
    // Game state
    gameState,
    isHost,
    roomStatus,
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
    requestSnapshot,
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
    closeNightReview,
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
            <TouchableOpacity
              style={[styles.errorBackButton, { backgroundColor: colors.primary }]}
              onPress={handleRetry}
            >
              <Text style={styles.errorBackButtonText}>重试</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.errorBackButton}
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={styles.errorBackButtonText}>返回首页</Text>
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
          <TouchableOpacity onPress={handleShareRoom} activeOpacity={0.6}>
            <Text style={styles.headerSubtitle}>
              {gameState.template.roles.length}人局 · 复制链接
            </Text>
          </TouchableOpacity>
        </View>
        {/* Host Menu Dropdown - replaces headerSpacer */}
        <HostMenuDropdown
          visible={isHost}
          showFillWithBots={roomStatus === GameStatus.unseated}
          showMarkAllBotsViewed={isDebugMode && roomStatus === GameStatus.assigned}
          onFillWithBots={() =>
            void fillWithBots().catch((err) => {
              roomScreenLog.error('[fillWithBots] failed', err);
              Sentry.captureException(err);
            })
          }
          onMarkAllBotsViewed={() =>
            void markAllBotsViewed().catch((err) => {
              roomScreenLog.error('[markAllBotsViewed] failed', err);
              Sentry.captureException(err);
            })
          }
          styles={componentStyles.hostMenuDropdown}
        />
      </View>

      {/* Connection Status Bar */}
      {!isHost && (
        <ConnectionStatusBar
          status={connectionStatus}
          onForceSync={() => requestSnapshot()}
          styles={componentStyles.connectionStatusBar}
        />
      )}

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
        roomStatus === GameStatus.ongoing &&
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
          collapsed={roomStatus === GameStatus.ongoing || roomStatus === GameStatus.ended}
          onRolePress={handleSkillPreviewOpen}
          styles={componentStyles.boardInfoCard}
        />

        {/* Player Grid */}
        <PlayerGrid
          seats={seatViewModels}
          roomNumber={roomNumber}
          onSeatPress={onSeatTapped}
          onSeatLongPress={onSeatLongPressed}
          disabled={(roomStatus === GameStatus.ongoing && isAudioPlaying) || isActionSubmitting}
          controlledSeat={controlledSeat}
          showBotRoles={isDebugMode && isHost}
        />
      </ScrollView>

      {/* Bottom Action Panel - floating card with message + buttons */}
      <BottomActionPanel
        message={actionMessage}
        showMessage={!isAudioPlaying && (imActioner || roomStatus === GameStatus.ended)}
        styles={componentStyles.bottomActionPanel}
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
        {(roomStatus === GameStatus.assigned ||
          roomStatus === GameStatus.ready ||
          roomStatus === GameStatus.ongoing ||
          roomStatus === GameStatus.ended) &&
          effectiveSeat !== null && (
            <ActionButton
              label="查看身份"
              onPress={(_meta) => dispatchInteraction({ kind: 'VIEW_ROLE' })}
              styles={componentStyles.actionButton}
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
              styles={componentStyles.actionButton}
            />
          )}

        {/* Secondary row: Host controls + review buttons */}
        {(isHost || roomStatus === GameStatus.ended) && (
          <View style={componentStyles.bottomActionPanel.secondaryRow}>
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
              showRestart={
                !isAudioPlaying &&
                (roomStatus === GameStatus.assigned ||
                  roomStatus === GameStatus.ready ||
                  roomStatus === GameStatus.ongoing ||
                  roomStatus === GameStatus.ended)
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
            {/* Last Night Info — all players, ended phase only */}
            {roomStatus === GameStatus.ended && !isAudioPlaying && (
              <ActionButton
                label="昨夜信息"
                onPress={() => showLastNightInfo()}
                styles={componentStyles.actionButton}
              />
            )}
            {/* Night Review Button — all players, ended phase only */}
            {roomStatus === GameStatus.ended && (
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
      <ContinueGameOverlay
        visible={needsContinueOverlay}
        onContinue={resumeAfterRejoin}
        styles={componentStyles.continueGameOverlay}
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
      {roleCardVisible && effectiveRole && (
        <RoleCardModal
          visible={roleCardVisible}
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
          onClose={closeNightReview}
        />
      )}
    </SafeAreaView>
  );
};
