// Fashion Shadow first-round room UI over the shared room session and redacted server state.

import {
  FASHION_PLAYER_COUNT,
  FASHION_ROUND_BY_NUMBER,
  type FashionPublicCommand,
  type FashionPublicState,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuthContext } from '@/contexts/AuthContext';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import { useRoomSessionSnapshot } from '@/features/room/controllers/useRoomSessionSnapshot';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { FashionRoomSession } from '@/games/fashion-shadow/model/FashionRoomSession';
import type { RootStackParamList } from '@/navigation/types';
import { borderRadius, colors, fixed, spacing, typography } from '@/theme';

import { getFashionRoomCommandFailureMessage } from './fashionRoomCommandFailureMessage';
import { useFashionSeatCommands } from './useFashionSeatCommands';

interface FashionRoomScreenProps extends GameRoomScreenProps<'fashion-shadow'> {
  readonly session: FashionRoomSession;
}

const PHASE_LABELS: Readonly<Record<FashionPublicState['phase'], string>> = {
  lobby: '等待 7 人入座',
  roleReveal: '确认身份',
  event: '事件公开',
  crossExamination: '交叉质询',
  discussion: '自由讨论',
  vote: '调查投票',
  ended: '第 1 轮结束',
};

function findUserSeat(state: FashionPublicState, userId: string): number | null {
  for (let seat = 0; seat < state.numberOfPlayers; seat += 1) {
    if (state.realSeats[seat]?.userId === userId) return seat;
  }
  return null;
}

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutesPart = Math.floor(seconds / 60);
  const secondsPart = seconds % 60;
  return `${minutesPart}:${String(secondsPart).padStart(2, '0')}`;
}

export const FashionRoomScreen: React.FC<FashionRoomScreenProps> = ({
  room,
  entryReason,
  navigation,
  session,
}) => {
  const handleExit = useCallback(() => exitRoomFlow(navigation), [navigation]);
  return (
    <RoomEntryBoundary room={room} session={session} onExit={handleExit}>
      {(entryController) => (
        <FashionRoomContent
          room={room}
          entryReason={entryReason}
          navigation={navigation}
          session={session}
          entryController={entryController}
        />
      )}
    </RoomEntryBoundary>
  );
};

interface FashionRoomContentProps extends FashionRoomScreenProps {
  readonly entryController: RoomEntryController;
}

const FashionRoomContent: React.FC<FashionRoomContentProps> = ({
  room,
  navigation,
  session,
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  if (user === null) {
    throw new Error('[FAIL-FAST] Ready Fashion Shadow room requires an authenticated user');
  }
  const sessionSnapshot = useRoomSessionSnapshot(session);
  if (sessionSnapshot.phase !== 'ready') {
    throw new Error('[FAIL-FAST] Fashion Shadow room content requires a ready room session');
  }
  const state = sessionSnapshot.snapshot.state;
  const mySeat = findUserSeat(state, user.id);
  const isHost = state.hostUserId === user.id;
  const occupiedCount = Object.values(state.realSeats).filter((seat) => seat !== undefined).length;
  const seatCommands = useFashionSeatCommands({ session, user });
  const { isSubmitting, submit } = useRoomCommandSubmission(getFashionRoomCommandFailureMessage);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    if (state.phase !== 'crossExamination' || state.interrogation === null) return undefined;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.interrogation, state.phase]);

  const submitCommand = useCallback(
    (label: string, command: FashionPublicCommand): Promise<boolean> =>
      submit(label, () => session.dispatch(command, { controlledSeat: null, label })),
    [session, submit],
  );

  const round = FASHION_ROUND_BY_NUMBER[state.currentRound];
  const remainingMs =
    state.interrogation === null ? 0 : Math.max(0, state.interrogation.endsAt - nowMs);
  const hasConfirmedRole = mySeat !== null && state.roleConfirmedSeats.includes(mySeat);
  const hasVoted = mySeat !== null && state.votedSeats.includes(mySeat);
  const myTokens = mySeat === null ? null : state.actionTokens[mySeat] ?? null;
  const mySpeakCount = mySeat === null ? 0 : state.discussionSpeakCounts[mySeat] ?? 0;

  const seatCards = useMemo(
    () => Array.from({ length: FASHION_PLAYER_COUNT }, (_, seat) => {
      const occupant = state.realSeats[seat];
      const isSelf = occupant?.userId === user.id;
      const canTake = state.phase === 'lobby' && occupant === undefined && !isSubmitting;
      const label = occupant === undefined
        ? `${seat + 1}号 · 空位`
        : `${seat + 1}号 · ${occupant.profile.displayName}${isSelf ? '（你）' : ''}`;
      return (
        <View key={seat} style={styles.seatCell}>
          {canTake ? (
            <Button
              variant="secondary"
              size="md"
              onPress={() => void submit('入座', () => seatCommands.takeSeat(seat))}
            >
              {label}
            </Button>
          ) : (
            <Button variant={isSelf ? 'primary' : 'secondary'} size="md" disabled>
              {label}
            </Button>
          )}
        </View>
      );
    }),
    [isSubmitting, seatCommands, state.phase, state.realSeats, submit, user.id],
  );

  const renderIdentity = () => {
    if (state.privateIdentity === null) return null;
    const identity = state.privateIdentity;
    return (
      <View style={[styles.card, styles.privateCard]}>
        <Text style={styles.eyebrow}>仅你可见</Text>
        <Text style={styles.cardTitle}>{identity.roleName}</Text>
        <Text style={styles.label}>公开立场</Text>
        <Text style={styles.body}>{identity.publicStance}</Text>
        <Text style={styles.label}>隐藏秘密</Text>
        <Text style={styles.body}>{identity.secret}</Text>
        <Text style={styles.label}>独立胜利条件</Text>
        <Text style={styles.body}>{identity.victoryCondition}</Text>
        {myTokens !== null ? <Text style={styles.tokenText}>行动代币：{myTokens}</Text> : null}
      </View>
    );
  };

  const renderPhaseAction = () => {
    switch (state.phase) {
      case 'lobby':
        return (
          <View style={styles.actions}>
            {mySeat !== null ? (
              <Button variant="secondary" onPress={() => void submit('离座', seatCommands.leaveSeat)}>
                离开座位
              </Button>
            ) : null}
            {isHost ? (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  onPress={() => void submitCommand('开始游戏', { type: 'fashion.game.start' })}
                  disabled={occupiedCount !== FASHION_PLAYER_COUNT || isSubmitting}
                >
                  开始第 1 轮
                </Button>
                {occupiedCount > 0 ? (
                  <Button variant="ghost" onPress={() => void submit('清空座位', seatCommands.clearSeats)}>
                    清空座位
                  </Button>
                ) : null}
              </>
            ) : null}
          </View>
        );
      case 'roleReveal':
        return (
          <View style={styles.actions}>
            {mySeat !== null && !hasConfirmedRole ? (
              <Button
                variant="primary"
                size="lg"
                onPress={() => void submitCommand('确认身份', { type: 'fashion.role.confirm' })}
                loading={isSubmitting}
              >
                我已阅读身份与秘密
              </Button>
            ) : (
              <Text style={styles.statusText}>已确认：{state.roleConfirmedSeats.length}/7</Text>
            )}
            {isHost ? (
              <Button
                variant="secondary"
                onPress={() => void submitCommand('公开事件', { type: 'fashion.event.reveal' })}
                disabled={state.roleConfirmedSeats.length !== FASHION_PLAYER_COUNT || isSubmitting}
              >
                全员确认后公开 E1
              </Button>
            ) : null}
          </View>
        );
      case 'event':
        return isHost ? (
          <Button
            variant="primary"
            size="lg"
            onPress={() => void submitCommand('开始交叉质询', { type: 'fashion.crossExam.start' })}
            loading={isSubmitting}
          >
            开始 3 分钟交叉质询
          </Button>
        ) : <Text style={styles.statusText}>等待房主开始交叉质询</Text>;
      case 'crossExamination':
        return (
          <View style={styles.actions}>
            <Text style={styles.timer}>{formatRemaining(remainingMs)}</Text>
            <Text style={styles.statusText}>
              {state.interrogation === null
                ? '质询状态同步中'
                : `${state.interrogation.attackerSeat + 1}号质询 ${state.interrogation.defenderSeat + 1}号`}
            </Text>
            {isHost ? (
              <Button
                variant="primary"
                onPress={() => void submitCommand('结束交叉质询', { type: 'fashion.crossExam.finish' })}
                disabled={remainingMs > 0 || isSubmitting}
              >
                时间结束，进入讨论
              </Button>
            ) : null}
          </View>
        );
      case 'discussion':
        return (
          <View style={styles.actions}>
            <Text style={styles.statusText}>主动发言会消耗 1 枚行动代币。你本轮已主动发言 {mySpeakCount} 次。</Text>
            {mySeat !== null ? (
              <Button
                variant="secondary"
                onPress={() => void submitCommand('主动发言', { type: 'fashion.discussion.speak' })}
                disabled={(myTokens ?? 0) < 1 || isSubmitting}
              >
                消耗 1 枚代币主动发言
              </Button>
            ) : null}
            {isHost ? (
              <Button
                variant="primary"
                onPress={() => void submitCommand('结束讨论', { type: 'fashion.discussion.finish' })}
                loading={isSubmitting}
              >
                结束讨论，开始投票
              </Button>
            ) : null}
          </View>
        );
      case 'vote':
        return (
          <View style={styles.actions}>
            <Text style={styles.statusText}>已投票：{state.votedSeats.length}/7</Text>
            {mySeat !== null && !hasVoted ? (
              <View style={styles.voteRow}>
                <Button
                  variant="primary"
                  onPress={() => void submitCommand('赞成调查', { type: 'fashion.vote.cast', vote: 'approve' })}
                >
                  赞成调查
                </Button>
                <Button
                  variant="secondary"
                  onPress={() => void submitCommand('反对调查', { type: 'fashion.vote.cast', vote: 'reject' })}
                >
                  反对调查
                </Button>
              </View>
            ) : hasVoted ? <Text style={styles.statusText}>你的投票已提交，具体选择不会在投票结束前公开。</Text> : null}
            {isHost ? (
              <Button
                variant="primary"
                onPress={() => void submitCommand('结算投票', { type: 'fashion.vote.finish' })}
                disabled={state.votedSeats.length !== FASHION_PLAYER_COUNT || isSubmitting}
              >
                全员投票后结算 V1
              </Button>
            ) : null}
          </View>
        );
      case 'ended': {
        const isPublic = state.publicEvidence.includes(round.evidenceId);
        return (
          <View style={[styles.card, isPublic ? styles.resultPublic : styles.resultDestroyed]}>
            <Text style={styles.cardTitle}>{isPublic ? '调查通过' : '调查失败'}</Text>
            <Text style={styles.body}>
              {isPublic
                ? `${round.evidenceId}「${round.evidenceTitle}」已进入公共证据区。`
                : `${round.evidenceId}「${round.evidenceTitle}」已永久销毁。`}
            </Text>
            <Text style={styles.statusText}>第 1 轮 Vertical Slice 完成。</Text>
          </View>
        );
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScreenHeader
        title="时尚追凶"
        onBack={() => exitRoomFlow(navigation)}
        topInset={insets.top}
        headerRight={
          <Button
            variant="ghost"
            onPress={() => navigation.navigate('GameGuide', { gameType: 'fashion-shadow', roomCode: room.roomCode })}
          >
            规则
          </Button>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>房间 {room.roomCode} · 第 {state.currentRound} 轮</Text>
          <Text style={styles.heroTitle}>{PHASE_LABELS[state.phase]}</Text>
          <Text style={styles.body}>真人入座 {occupiedCount}/7</Text>
        </View>

        {state.phase === 'lobby' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>座位</Text>
            <View style={styles.seatGrid}>{seatCards}</View>
          </View>
        ) : null}

        {renderIdentity()}

        {state.currentEvent !== null ? (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>{round.location} · {round.esg}</Text>
            <Text style={styles.cardTitle}>{round.eventId} · {round.eventTitle}</Text>
            <Text style={styles.body}>{round.eventDescription}</Text>
            {state.voteQuestion !== null ? (
              <>
                <Text style={styles.label}>本轮调查议题</Text>
                <Text style={styles.body}>{state.voteQuestion}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>当前操作</Text>
          {renderPhaseAction()}
        </View>

        {state.publicEvidence.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>公共证据区</Text>
            {state.publicEvidence.map((evidenceId) => (
              <Text key={evidenceId} style={styles.body}>{evidenceId} · {round.evidenceTitle}</Text>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenH, gap: spacing.medium, paddingBottom: spacing.xxlarge },
  hero: { gap: spacing.tight },
  heroTitle: {
    color: colors.text,
    fontSize: typography.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.bold,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    padding: spacing.large,
    gap: spacing.small,
  },
  privateCard: { borderColor: colors.primary },
  resultPublic: { borderColor: colors.success },
  resultDestroyed: { borderColor: colors.error },
  cardTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: typography.weights.bold,
  },
  label: {
    marginTop: spacing.small,
    color: colors.text,
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
  },
  body: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
  },
  tokenText: {
    marginTop: spacing.small,
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: typography.weights.bold,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
  },
  timer: {
    color: colors.text,
    fontSize: typography.display,
    lineHeight: typography.lineHeights.display,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
  seatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small },
  seatCell: { width: '48%' },
  actions: { gap: spacing.small },
  voteRow: { gap: spacing.small },
});
