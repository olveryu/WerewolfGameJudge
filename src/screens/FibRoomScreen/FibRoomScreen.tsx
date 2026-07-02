/**
 * FibRoomScreen — fibking adapter over the shared room shell.
 *
 * Shared hooks own connection, sharing, seat operations, and profile-card state.
 * Fib-specific files derive seat view models, header items, summary copy, and bottom actions.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type React from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ControlledSeatBanner } from '@/components/room/ControlledSeatBanner';
import { PlayerProfileCard } from '@/components/room/PlayerProfileCard';
import { QRCodeModal } from '@/components/room/QRCodeModal';
import { RoomBottomActionPanel } from '@/components/room/RoomBottomActionPanel';
import { createRoomComponentStyles } from '@/components/room/roomComponentStyles';
import { RoomHeaderActions } from '@/components/room/RoomHeaderActions';
import { RoomSeatBoard } from '@/components/room/RoomSeatBoard';
import { RoomSeatConfirmModal } from '@/components/room/RoomSeatConfirmModal';
import { createRoomShellStyles } from '@/components/room/roomShellStyles';
import { RoomStatusRibbon } from '@/components/room/RoomStatusRibbon';
import type { RootStackParamList } from '@/navigation/types';
import { ConnectionStatus } from '@/services/room/ConnectionStatus';
import { TESTIDS } from '@/testids';
import {
  borderRadius,
  colors,
  componentSizes,
  spacing,
  textStyles,
  typography,
  withAlpha,
} from '@/theme';

import { FibIdentitySheet } from './components/FibIdentitySheet';
import { getFibSummaryBody, getFibSummaryTitle, shouldShowFibAnswerPanel } from './fibRoomView';
import { useFibRoomScreenState } from './hooks/useFibRoomScreenState';

type Props = NativeStackScreenProps<RootStackParamList, 'FibRoom'>;

const FibRoomScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createRoomShellStyles(colors), []);
  const componentStyles = useMemo(() => createRoomComponentStyles(colors), []);
  const {
    state,
    user,
    roomCode,
    connectionStatus,
    manualReconnect,
    isHost,
    filled,
    playerCount,
    roomCapabilities,
    activeControlledSeat,
    controlledSeatDisplayName,
    releaseControlledSeat,
    actionItems,
    operationItems,
    seatViewModels,
    onSeatPress,
    onSeatLongPress,
    handleBack,
    bottomLayout,
    identityOpen,
    identityRole,
    closeIdentity,
    seatOperation,
    isSeatSubmitting,
    confirmOperation,
    cancelOperation,
    profile,
    share,
    openRules,
    openUserSettings,
  } = useFibRoomScreenState(route.params, navigation);

  const listHeader = useMemo(() => {
    if (!state) return null;
    return (
      <View style={fibStyles.listHeader}>
        <TouchableOpacity
          style={fibStyles.rulesEntry}
          activeOpacity={0.75}
          onPress={openRules}
          testID="fib-rules-link"
        >
          <Ionicons
            name="help-circle-outline"
            size={componentSizes.icon.sm}
            color={colors.primary}
          />
          <View style={fibStyles.rulesEntryText}>
            <Text style={fibStyles.rulesEntryTitle}>玩法说明</Text>
            <Text style={fibStyles.rulesEntrySubtitle}>身份、流程、手机查看规则</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={componentSizes.icon.sm}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
        <View style={fibStyles.summaryPanel}>
          <Text style={fibStyles.summaryTitle}>{getFibSummaryTitle(state, filled)}</Text>
          <Text style={fibStyles.summaryBody}>{getFibSummaryBody(state)}</Text>
        </View>
        {shouldShowFibAnswerPanel(state) ? (
          <View style={fibStyles.answerPanel}>
            <Text style={fibStyles.answerTitle}>本轮答案</Text>
            <Text style={fibStyles.answerWord}>{state.word}</Text>
            <Text style={fibStyles.answerDef}>{state.definition}</Text>
          </View>
        ) : null}
      </View>
    );
  }, [filled, openRules, state]);

  if (!state) {
    return <LoadingScreen message="连接中…" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']} testID="fib-room-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.small }]}>
        <View style={styles.headerLeft}>
          <Button
            variant="icon"
            onPress={handleBack}
            style={styles.backButton}
            testID={TESTIDS.roomBackButton}
          >
            <Ionicons name="chevron-back" size={componentSizes.icon.lg} color={colors.text} />
          </Button>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>房间 {roomCode}</Text>
        </View>
        <View style={styles.headerRight}>
          <RoomHeaderActions
            visible
            user={user}
            ticketCount={null}
            showUserSettings
            actionItems={actionItems}
            operationItems={operationItems}
            onUserSettings={openUserSettings}
            styles={componentStyles.headerActions}
            menuButtonTestID="fib-room-menu"
          />
        </View>
      </View>

      <RoomStatusRibbon
        connectionStatus={connectionStatus}
        onManualReconnect={manualReconnect}
        guideMessage={
          connectionStatus === ConnectionStatus.Live
            ? `瞎掰王 · ${filled}/${playerCount} 人就座`
            : null
        }
        connectionStatusBarStyles={componentStyles.connectionStatusBar}
        hostGuideBannerStyles={componentStyles.hostGuideBanner}
      />

      {roomCapabilities?.canTakeOverBots === true ? (
        activeControlledSeat !== null && controlledSeatDisplayName ? (
          <ControlledSeatBanner
            mode="controlled"
            controlledSeat={activeControlledSeat}
            botDisplayName={controlledSeatDisplayName}
            onRelease={releaseControlledSeat}
            styles={componentStyles.controlledSeatBanner}
          />
        ) : (
          <ControlledSeatBanner mode="hint" styles={componentStyles.controlledSeatBanner} />
        )
      ) : null}

      <RoomSeatBoard
        seats={seatViewModels}
        onSeatPress={onSeatPress}
        onSeatLongPress={roomCapabilities?.canTakeOverBots === true ? onSeatLongPress : undefined}
        controlledSeat={activeControlledSeat}
        showBotRoles={roomCapabilities?.canShowBotRoles === true}
        virtualized
        listHeaderComponent={listHeader}
        contentContainerStyle={fibStyles.content}
        seatTestIDPrefix="fib-seat-{seat}"
      />

      <RoomBottomActionPanel
        layout={bottomLayout}
        onSchemaButtonPress={() => {
          throw new Error('FibRoomScreen: unexpected schema intent');
        }}
        onStaticButtonPress={(action) => {
          throw new Error(`FibRoomScreen: unexpected static action ${action}`);
        }}
        styles={componentStyles.bottomActionPanel}
        bottomInset={insets.bottom + spacing.medium}
      />

      <FibIdentitySheet
        visible={identityOpen}
        role={identityRole}
        word={state.word}
        definition={state.definition}
        onClose={closeIdentity}
      />

      {seatOperation ? (
        <RoomSeatConfirmModal
          visible
          kind={seatOperation.kind}
          seat={seatOperation.seat}
          isSubmitting={isSeatSubmitting}
          onConfirm={() => void confirmOperation()}
          onCancel={cancelOperation}
          styles={componentStyles.seatConfirmModal}
        />
      ) : null}

      {profile.target ? (
        <PlayerProfileCard
          visible
          onClose={profile.closeProfile}
          targetUserId={profile.target.userId}
          targetSeat={profile.target.seat}
          isHost={isHost}
          rosterName={profile.target.displayName}
          isSelf={profile.target.isSelf}
          onKick={roomCapabilities?.canManageSeats === true ? profile.handleKick : undefined}
          onLeaveSeat={roomCapabilities?.canSeat === true ? profile.handleLeaveSeat : undefined}
        />
      ) : null}

      <QRCodeModal
        visible={share.qrModalVisible}
        roomCode={roomCode}
        roomUrl={share.roomUrl}
        onShareImage={share.handleShareQRCode}
        onCopyLink={share.handleCopyLink}
        onClose={share.closeQRCode}
      />
    </SafeAreaView>
  );
};

const fibStyles = StyleSheet.create({
  content: {
    padding: spacing.medium,
    paddingBottom: spacing.xxlarge + spacing.xlarge,
  },
  listHeader: {
    gap: spacing.medium,
    marginBottom: spacing.medium,
  },
  rulesEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    borderRadius: borderRadius.small,
    backgroundColor: withAlpha(colors.primary, 0.05),
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
  },
  rulesEntryText: {
    flex: 1,
    gap: spacing.micro,
    minWidth: 0,
  },
  rulesEntryTitle: {
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  rulesEntrySubtitle: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.textSecondary,
  },
  summaryPanel: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.medium,
    gap: spacing.tight,
  },
  summaryTitle: {
    ...textStyles.titleBold,
    color: colors.text,
  },
  summaryBody: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: colors.textSecondary,
  },
  answerPanel: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.medium,
    gap: spacing.tight,
  },
  answerTitle: {
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  answerWord: {
    fontSize: typography.heading,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  answerDef: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  },
});

export default FibRoomScreen;
