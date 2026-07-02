/**
 * FibRoomScreen — fibking adapter over the shared room shell.
 *
 * Shared hooks own connection, sharing, seat operations, and profile-card state.
 * Fib-specific files derive seat view models, header items, summary copy, and bottom actions.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ControlledSeatBanner } from '@/components/room/ControlledSeatBanner';
import { usePlayerProfileController } from '@/components/room/hooks/usePlayerProfileController';
import { useRoomActionRunner } from '@/components/room/hooks/useRoomActionRunner';
import { useRoomBotControl } from '@/components/room/hooks/useRoomBotControl';
import { useRoomConnectionLifecycle } from '@/components/room/hooks/useRoomConnectionLifecycle';
import {
  type RoomSeatOperation,
  useRoomSeatOperations,
} from '@/components/room/hooks/useRoomSeatOperations';
import { useRoomShareActions } from '@/components/room/hooks/useRoomShareActions';
import { PlayerProfileCard } from '@/components/room/PlayerProfileCard';
import { getRoomSeatPressResult } from '@/components/room/policy/roomSeatInteraction';
import { QRCodeModal } from '@/components/room/QRCodeModal';
import { RoomBottomActionPanel } from '@/components/room/RoomBottomActionPanel';
import { createRoomComponentStyles } from '@/components/room/roomComponentStyles';
import { RoomHeaderActions } from '@/components/room/RoomHeaderActions';
import { RoomSeatBoard } from '@/components/room/RoomSeatBoard';
import { RoomSeatConfirmModal } from '@/components/room/RoomSeatConfirmModal';
import { createRoomShellStyles } from '@/components/room/roomShellStyles';
import { RoomStatusRibbon } from '@/components/room/RoomStatusRibbon';
import { useFibFacade } from '@/contexts';
import { useAuthContext } from '@/contexts/AuthContext';
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
import { showAlert } from '@/utils/alert';
import { handleError } from '@/utils/errorPipeline';
import { isExpectedError } from '@/utils/errorUtils';
import { roomScreenLog } from '@/utils/logger';

import { createFibBottomLayout } from './fibRoom/fibBottomLayout';
import {
  createFibHeaderActionItems,
  createFibHeaderOperationItems,
} from './fibRoom/fibHeaderItems';
import { FibIdentitySheet } from './fibRoom/FibIdentitySheet';
import { getFibRoomLifecycle } from './fibRoom/fibRoomLifecycle';
import {
  countFibSeatedPlayers,
  createFibSeatViewModels,
  findFibSeatByUserId,
  getFibDisplayName,
  getFibReasonMessage,
  getFibSummaryBody,
  getFibSummaryTitle,
  isFibBotUserId,
  shouldShowFibAnswerPanel,
  userToFibRosterProfile,
} from './fibRoom/fibRoomView';

type Props = NativeStackScreenProps<RootStackParamList, 'FibRoom'>;

const FibRoomScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const facade = useFibFacade();
  const { user } = useAuthContext();
  const { roomCode } = route.params;
  const myUserId = user?.id ?? null;
  const styles = useMemo(() => createRoomShellStyles(colors), []);
  const componentStyles = useMemo(() => createRoomComponentStyles(colors), []);
  const [identityOpen, setIdentityOpen] = useState(false);

  const handleConnectError = useCallback((err: unknown): void => {
    handleError(err, {
      label: '连接房间',
      logger: roomScreenLog,
      alertMessage: '无法连接房间，请稍后重试',
    });
  }, []);

  const handleLeaveError = useCallback((err: unknown): void => {
    handleError(err, {
      label: '离开房间',
      logger: roomScreenLog,
      feedback: false,
    });
  }, []);

  const { state, connectionStatus, manualReconnect } = useRoomConnectionLifecycle({
    facade,
    roomCode,
    userId: myUserId,
    onConnectError: handleConnectError,
    onLeaveError: handleLeaveError,
  });

  const isHost = myUserId !== null && state?.hostUserId === myUserId;
  const mySeat = useMemo(() => findFibSeatByUserId(state, myUserId), [state, myUserId]);

  const runAction = useRoomActionRunner({
    reasonToMessage: getFibReasonMessage,
    logger: roomScreenLog,
    isExpectedError,
  });

  const runSeatOperation = useCallback(
    async (operation: RoomSeatOperation): Promise<boolean> => {
      switch (operation.kind) {
        case 'enter':
        case 'move':
          if (!user) {
            showAlert('入座失败', '请先登录');
            return false;
          }
          return runAction(
            () => facade.sit(operation.seat, userToFibRosterProfile(user)),
            '入座失败',
          );
        case 'leave':
          return runAction(() => facade.leaveSeat(), '离座失败');
        case 'kick':
          return runAction(() => facade.kick(operation.seat), '移出失败');
        default: {
          const _exhaustive: never = operation.kind;
          throw new Error(`FibRoomScreen: unsupported seat operation ${_exhaustive}`);
        }
      }
    },
    [facade, runAction, user],
  );

  const {
    operation: seatOperation,
    isSubmitting: isSeatSubmitting,
    openOperation,
    cancelOperation,
    confirmOperation,
  } = useRoomSeatOperations({ runOperation: runSeatOperation });

  const openKickOperation = useCallback(
    (seat: number): void => {
      openOperation({ kind: 'kick', seat });
    },
    [openOperation],
  );

  const openLeaveOperation = useCallback(
    (seat: number): void => {
      openOperation({ kind: 'leave', seat });
    },
    [openOperation],
  );

  const getProfileDisplayName = useCallback(
    (seat: number, userId: string): string => {
      if (!state) throw new Error('FibRoomScreen.getProfileDisplayName: missing state');
      return getFibDisplayName(state, seat, userId);
    },
    [state],
  );

  const profile = usePlayerProfileController({
    myUserId,
    getDisplayName: getProfileDisplayName,
    onKickSeat: openKickOperation,
    onLeaveSeat: openLeaveOperation,
  });

  const filled = state ? countFibSeatedPlayers(state) : 0;
  const isFull = state ? filled === state.numberOfPlayers : false;
  const hasFibBots = useMemo(
    () => (state ? Object.values(state.seats).some((seat) => isFibBotUserId(seat.userId)) : false),
    [state],
  );

  const lifecycle = useMemo(
    () => (state ? getFibRoomLifecycle({ state, filled, isHost, hasBots: hasFibBots }) : null),
    [filled, hasFibBots, isHost, state],
  );
  const roomStatus = lifecycle?.status;
  const roomCapabilities = lifecycle?.capabilities;

  const isFibBotSeat = useCallback(
    (seat: number): boolean => {
      if (!state) return false;
      const occupant = state.seats[seat] ?? null;
      return occupant !== null && isFibBotUserId(occupant.userId);
    },
    [state],
  );

  const { activeControlledSeat, effectiveSeat, releaseControlledSeat, toggleControlledSeat } =
    useRoomBotControl({
      enabled: roomCapabilities?.canTakeOverBots ?? false,
      mySeat,
      isBotSeat: isFibBotSeat,
    });
  const controlledSeatOccupant =
    state && activeControlledSeat !== null ? (state.seats[activeControlledSeat] ?? null) : null;

  const share = useRoomShareActions({
    roomCode,
    gameName: '瞎掰王',
    autoShowWhen: state !== null && isHost && route.params.isHost,
  });

  const openSettings = useCallback((): void => {
    navigation.navigate('FibConfig', { existingRoomCode: roomCode });
  }, [navigation, roomCode]);

  const handleClearSeats = useCallback((): void => {
    showAlert('清空所有座位?', undefined, [
      { text: '取消', style: 'cancel' },
      {
        text: '清空',
        style: 'destructive',
        onPress: () => void runAction(() => facade.clearSeats(), '清空失败'),
      },
    ]);
  }, [facade, runAction]);

  const handleFillBots = useCallback((): void => {
    showAlert('填充机器人?', '将用机器人填满空座位', [
      { text: '取消', style: 'cancel' },
      {
        text: '填充',
        onPress: () => void runAction(() => facade.fillBots(), '填充失败'),
      },
    ]);
  }, [facade, runAction]);

  const actionItems = useMemo(
    () =>
      createFibHeaderActionItems({
        onShareRoom: share.openQRCode,
      }),
    [share.openQRCode],
  );

  const operationItems = useMemo(
    () =>
      createFibHeaderOperationItems({
        filled,
        isFull,
        canManageSeats: roomCapabilities?.canManageSeats ?? false,
        onFillBots: handleFillBots,
        onClearSeats: handleClearSeats,
      }),
    [filled, handleClearSeats, handleFillBots, isFull, roomCapabilities?.canManageSeats],
  );

  const seatViewModels = useMemo(
    () => (state ? createFibSeatViewModels(state, mySeat) : []),
    [mySeat, state],
  );

  const onSeatPress = useCallback(
    (seat: number): void => {
      if (!state) throw new Error('FibRoomScreen.onSeatPress: missing state');
      const occupantUserId = state.seats[seat]?.userId ?? null;
      const result = getRoomSeatPressResult({
        status: roomStatus,
        seat,
        occupantUserId,
        mySeat,
        myUserId,
      });

      switch (result.kind) {
        case 'VIEW_PROFILE':
          profile.openProfile(result.seat, result.targetUserId);
          return;
        case 'OPEN_SEAT_OPERATION':
          openOperation({ kind: result.operationKind, seat: result.seat });
          return;
        case 'AUTH_REQUIRED':
          showAlert('入座失败', '请先登录');
          return;
        case 'NOOP':
          return;
        default: {
          const _exhaustive: never = result;
          throw new Error(`FibRoomScreen.onSeatPress: unhandled result ${_exhaustive}`);
        }
      }
    },
    [mySeat, myUserId, openOperation, profile, roomStatus, state],
  );

  const onSeatLongPress = useCallback(
    (seat: number): void => {
      const result = toggleControlledSeat(seat);
      switch (result.kind) {
        case 'controlled':
        case 'released':
        case 'ignored':
          return;
        case 'invalid_target':
          showAlert('无法接管', '只能接管机器人座位');
          return;
        default: {
          const _exhaustive: never = result;
          throw new Error(`FibRoomScreen.onSeatLongPress: unhandled result ${_exhaustive}`);
        }
      }
    },
    [toggleControlledSeat],
  );

  const handleBack = useCallback((): void => {
    if (roomCapabilities?.shouldConfirmExit === true) {
      showAlert('退出房间?', '本局进行中', [
        { text: '取消', style: 'cancel' },
        { text: '退出', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
      return;
    }
    navigation.goBack();
  }, [navigation, roomCapabilities?.shouldConfirmExit]);

  const bottomLayout = useMemo(() => {
    if (!state) return { primary: [], secondary: [], ghost: [] };
    return createFibBottomLayout({
      state,
      isHost,
      isFull,
      mySeat: effectiveSeat,
      onOpenSettings: openSettings,
      onOpenIdentity: () => setIdentityOpen(true),
      onStartRound: () => void runAction(() => facade.startRound(), '开始失败'),
      onReveal: () => void runAction(() => facade.reveal(), '公布失败'),
      onRestart: () => void runAction(() => facade.restart(), '重新开始失败'),
      onNextRound: () => void runAction(() => facade.nextRound(), '开始失败'),
    });
  }, [effectiveSeat, facade, isFull, isHost, openSettings, runAction, state]);

  const listHeader = useMemo(() => {
    if (!state) return null;
    return (
      <View style={fibStyles.listHeader}>
        <TouchableOpacity
          style={fibStyles.rulesEntry}
          activeOpacity={0.75}
          onPress={() => navigation.navigate('FibRules')}
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
  }, [filled, navigation, state]);

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
            onUserSettings={() => navigation.navigate('Settings', { roomCode })}
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
            ? `瞎掰王 · ${filled}/${state.numberOfPlayers} 人就座`
            : null
        }
        connectionStatusBarStyles={componentStyles.connectionStatusBar}
        hostGuideBannerStyles={componentStyles.hostGuideBanner}
      />

      {roomCapabilities?.canTakeOverBots === true ? (
        activeControlledSeat !== null && controlledSeatOccupant ? (
          <ControlledSeatBanner
            mode="controlled"
            controlledSeat={activeControlledSeat}
            botDisplayName={getFibDisplayName(
              state,
              activeControlledSeat,
              controlledSeatOccupant.userId,
            )}
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
        role={effectiveSeat !== null ? state.roleBySeat?.[effectiveSeat] : undefined}
        word={state.word}
        definition={state.definition}
        onClose={() => setIdentityOpen(false)}
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
          onLeaveSeat={
            roomCapabilities?.canManageSeats === true ? profile.handleLeaveSeat : undefined
          }
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
