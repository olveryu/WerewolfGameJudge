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
import { PlayerProfileCard } from '@/components/room/PlayerProfileCard';
import { QRCodeModal } from '@/components/room/QRCodeModal';
import { RoomBottomActionPanel } from '@/components/room/RoomBottomActionPanel';
import { createRoomComponentStyles } from '@/components/room/roomComponentStyles';
import { RoomHeaderActions } from '@/components/room/RoomHeaderActions';
import { RoomSeatBoard } from '@/components/room/RoomSeatBoard';
import { RoomSeatConfirmModal } from '@/components/room/RoomSeatConfirmModal';
import { createRoomShellStyles } from '@/components/room/roomShellStyles';
import { RoomStatusRibbon } from '@/components/room/RoomStatusRibbon';
import { useAuthContext } from '@/contexts/AuthContext';
import { useFibFacade } from '@/contexts/FibFacadeContext';
import { usePlayerProfileController } from '@/hooks/usePlayerProfileController';
import { useRoomActionRunner } from '@/hooks/useRoomActionRunner';
import { useRoomConnectionLifecycle } from '@/hooks/useRoomConnectionLifecycle';
import { type RoomSeatOperation, useRoomSeatOperations } from '@/hooks/useRoomSeatOperations';
import { useRoomShareActions } from '@/hooks/useRoomShareActions';
import type { RootStackParamList } from '@/navigation/types';
import { ConnectionStatus } from '@/services/types/IGameFacade';
import { TESTIDS } from '@/testids';
import { borderRadius, colors, componentSizes, spacing, textStyles, typography } from '@/theme';
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
import {
  countFibSeatedPlayers,
  createFibSeatViewModels,
  findFibSeatByUserId,
  getFibDisplayName,
  getFibReasonMessage,
  getFibSummaryBody,
  getFibSummaryTitle,
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
  const isLobby = state?.phase === 'Lobby';

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

  const actionItems = useMemo(
    () =>
      createFibHeaderActionItems({
        isHost,
        isLobby,
        onShareRoom: share.openQRCode,
        onOpenSettings: openSettings,
      }),
    [isHost, isLobby, openSettings, share.openQRCode],
  );

  const operationItems = useMemo(
    () =>
      createFibHeaderOperationItems({
        isHost,
        isLobby,
        filled,
        onClearSeats: handleClearSeats,
      }),
    [filled, handleClearSeats, isHost, isLobby],
  );

  const seatViewModels = useMemo(
    () => (state ? createFibSeatViewModels(state, mySeat) : []),
    [mySeat, state],
  );

  const onSeatPress = useCallback(
    (seat: number): void => {
      if (!state) throw new Error('FibRoomScreen.onSeatPress: missing state');
      const occupant = state.seats[seat] ?? null;
      if (occupant) {
        profile.openProfile(seat, occupant.userId);
        return;
      }
      if (state.phase !== 'Lobby') return;
      if (!user) {
        showAlert('入座失败', '请先登录');
        return;
      }
      openOperation({ kind: mySeat === null ? 'enter' : 'move', seat });
    },
    [mySeat, openOperation, profile, state, user],
  );

  const handleBack = useCallback((): void => {
    if (state && state.phase !== 'Lobby') {
      showAlert('退出房间?', '本局进行中', [
        { text: '取消', style: 'cancel' },
        { text: '退出', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
      return;
    }
    navigation.goBack();
  }, [navigation, state]);

  const bottomLayout = useMemo(() => {
    if (!state) return { primary: [], secondary: [], ghost: [] };
    return createFibBottomLayout({
      state,
      isHost,
      isFull,
      mySeat,
      onOpenSettings: openSettings,
      onOpenIdentity: () => setIdentityOpen(true),
      onStartRound: () => void runAction(() => facade.startRound(), '开始失败'),
      onReveal: () => void runAction(() => facade.reveal(), '公布失败'),
      onRestart: () => void runAction(() => facade.restart(), '重新开始失败'),
      onNextRound: () => void runAction(() => facade.nextRound(), '开始失败'),
    });
  }, [facade, isFull, isHost, mySeat, openSettings, runAction, state]);

  const listHeader = useMemo(() => {
    if (!state) return null;
    return (
      <View style={fibStyles.listHeader}>
        <TouchableOpacity onPress={() => navigation.navigate('FibRules')} testID="fib-rules-link">
          <Text style={fibStyles.rulesLink}>玩法说明 ⓘ</Text>
        </TouchableOpacity>
        <View style={fibStyles.summaryPanel}>
          <Text style={fibStyles.summaryTitle}>{getFibSummaryTitle(state, filled)}</Text>
          <Text style={fibStyles.summaryBody}>{getFibSummaryBody(state)}</Text>
        </View>
        {state.phase === 'Revealed' ? (
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

      <RoomSeatBoard
        seats={seatViewModels}
        onSeatPress={onSeatPress}
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
        role={mySeat !== null ? state.roleBySeat?.[mySeat] : undefined}
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
          onKick={profile.handleKick}
          onLeaveSeat={profile.handleLeaveSeat}
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
  rulesLink: {
    ...textStyles.secondarySemibold,
    color: colors.primary,
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
