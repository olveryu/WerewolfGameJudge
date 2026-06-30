/**
 * FibRoomScreen — 瞎掰王 房间 (Lobby / Starting / Playing / Revealed).
 *
 * Subscribes to FibFacade state, renders the seat grid + phase-specific bottom actions,
 * and the local 「查看身份」 sheet. Seat taps follow the Lobby-only policy (sit/leave/kick).
 * Server is the sole authority; every button is an HTTP action.
 */
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { FibState } from '@werewolf/game-engine/fibking/types';
import type { RosterEntry } from '@werewolf/game-engine/protocol/common';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuthContext, type User } from '@/contexts/AuthContext';
import { useFibFacade } from '@/contexts/FibFacadeContext';
import type { RootStackParamList } from '@/navigation/types';
import type { FibActionResult } from '@/services/facade/FibFacade';
import { ConnectionStatus } from '@/services/types/IGameFacade';
import { borderRadius, colors, spacing, typography } from '@/theme';
import { showAlert } from '@/utils/alert';

import { FibIdentitySheet } from './fibRoom/FibIdentitySheet';
import { FibSeatCell } from './fibRoom/FibSeatCell';

type Props = NativeStackScreenProps<RootStackParamList, 'FibRoom'>;

function userToProfile(user: User): RosterEntry {
  return {
    displayName: user.displayName ?? '玩家',
    avatarUrl: user.customAvatarUrl ?? user.avatarUrl ?? undefined,
    avatarFrame: user.avatarFrame ?? undefined,
    seatFlair: user.seatFlair ?? undefined,
    nameStyle: user.nameStyle ?? undefined,
    roleRevealEffect: user.equippedEffect ?? undefined,
    seatAnimation: user.seatAnimation ?? undefined,
  };
}

function seatedCount(state: FibState): number {
  return Object.values(state.seats).filter((s) => s !== null).length;
}

const FibRoomScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const facade = useFibFacade();
  const { user } = useAuthContext();
  const { roomCode } = route.params;

  const state = useSyncExternalStore(
    useCallback((cb: () => void) => facade.subscribe(cb), [facade]),
    useCallback(() => facade.getState(), [facade]),
  );

  const [conn, setConn] = useState<ConnectionStatus>(ConnectionStatus.Connecting);
  const [sheetOpen, setSheetOpen] = useState(false);
  const connectedRef = useRef(false);

  useEffect(() => facade.addConnectionStatusListener(setConn), [facade]);

  useEffect(() => {
    if (!user?.id || connectedRef.current) return;
    connectedRef.current = true;
    void facade.connect(roomCode, user.id);
  }, [facade, roomCode, user?.id]);

  useEffect(() => () => void facade.leave(), [facade]);

  const myUserId = user?.id ?? null;
  const isHost = myUserId !== null && state?.hostUserId === myUserId;

  const mySeat = useMemo<number | null>(() => {
    if (!state || !myUserId) return null;
    for (const [seat, occupant] of Object.entries(state.seats)) {
      if (occupant?.userId === myUserId) return Number(seat);
    }
    return null;
  }, [state, myUserId]);

  const run = useCallback(
    async (fn: () => Promise<FibActionResult>, failTitle: string): Promise<void> => {
      const result = await fn();
      if (!result.success) showAlert(failTitle, result.reason ?? '请稍后重试');
    },
    [],
  );

  const onSeatPress = useCallback(
    (seat: number): void => {
      if (!state || state.phase !== 'Lobby' || !user?.id) return; // locked outside Lobby
      const occupant = state.seats[seat];
      if (!occupant) {
        if (mySeat !== null) return; // already seated elsewhere
        showAlert(`坐到 ${seat + 1} 号位?`, undefined, [
          { text: '取消', style: 'cancel' },
          {
            text: '入座',
            onPress: () => void run(() => facade.sit(seat, userToProfile(user)), '入座失败'),
          },
        ]);
      } else if (occupant.userId === myUserId) {
        showAlert('离座?', undefined, [
          { text: '取消', style: 'cancel' },
          {
            text: '离座',
            style: 'destructive',
            onPress: () => void run(() => facade.leaveSeat(), '离座失败'),
          },
        ]);
      } else if (isHost) {
        showAlert('移出该玩家?', undefined, [
          { text: '取消', style: 'cancel' },
          {
            text: '移出',
            style: 'destructive',
            onPress: () => void run(() => facade.kick(seat), '移出失败'),
          },
        ]);
      }
    },
    [state, user, mySeat, myUserId, isHost, facade, run],
  );

  const onBack = useCallback((): void => {
    if (state && state.phase !== 'Lobby') {
      showAlert('退出房间?', '本局进行中', [
        { text: '取消', style: 'cancel' },
        { text: '退出', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
      return;
    }
    navigation.goBack();
  }, [state, navigation]);

  if (!state) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="瞎掰王" onBack={() => navigation.goBack()} topInset={insets.top} />
        <View style={styles.centered}>
          <Text style={styles.muted}>连接中…</Text>
        </View>
      </View>
    );
  }

  const filled = seatedCount(state);
  const isFull = filled === state.numberOfPlayers;
  const revealed = state.phase === 'Revealed';
  const guesserSeat =
    state.roleBySeat && Object.entries(state.roleBySeat).find(([, r]) => r === 'guesser')?.[0];

  const connText =
    conn === ConnectionStatus.Live
      ? `已连接 · ${filled}/${state.numberOfPlayers} 人就座`
      : conn === ConnectionStatus.Disconnected || conn === ConnectionStatus.Failed
        ? '重连中…'
        : '连接中…';

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={`瞎掰王 · ${roomCode}`}
        onBack={onBack}
        topInset={insets.top}
        headerRight={
          isHost && state.phase === 'Lobby' ? (
            <Pressable
              onPress={() => navigation.navigate('FibConfig', { existingRoomCode: roomCode })}
              testID="fib-settings"
            >
              <Text style={styles.headerAction}>设置</Text>
            </Pressable>
          ) : undefined
        }
      />

      <Text style={styles.ribbon}>● {connText}</Text>

      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => navigation.navigate('FibRules')} testID="fib-rules-link">
          <Text style={styles.rulesLink}>玩法说明 ⓘ</Text>
        </Pressable>

        {state.phase === 'Starting' ? (
          <Text style={styles.starting}>⟳ 出题中…（正在抽生僻词并分配身份）</Text>
        ) : null}

        {state.phase === 'Playing' && guesserSeat !== undefined ? (
          <Text style={styles.playingHint}>本轮进行中 · 大聪明:{Number(guesserSeat) + 1} 号</Text>
        ) : null}

        <View style={styles.grid}>
          {Array.from({ length: state.numberOfPlayers }, (_, seat) => (
            <FibSeatCell
              key={seat}
              seat={seat}
              occupant={state.seats[seat] ?? null}
              roster={state.seats[seat] ? state.roster[state.seats[seat].userId] : undefined}
              role={state.roleBySeat?.[seat]}
              revealed={revealed}
              isMe={mySeat === seat}
              onPress={() => onSeatPress(seat)}
            />
          ))}
        </View>

        {revealed ? (
          <View style={styles.answer}>
            <Text style={styles.answerTitle}>本轮答案</Text>
            <Text style={styles.answerWord}>{state.word}</Text>
            <Text style={styles.answerDef}>{state.definition}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.small }]}>
        {renderActions()}
      </View>

      <FibIdentitySheet
        visible={sheetOpen}
        role={mySeat !== null ? state.roleBySeat?.[mySeat] : undefined}
        word={state.word}
        definition={state.definition}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );

  function renderActions(): React.ReactNode {
    if (!state) return null;
    const primary = (
      label: string,
      onPress: () => void,
      testID: string,
      disabled = false,
    ): React.ReactNode => (
      <Pressable
        style={[styles.primaryBtn, disabled && styles.btnDisabled]}
        onPress={disabled ? () => {} : onPress}
        testID={testID}
      >
        <Text style={styles.primaryBtnText}>{label}</Text>
      </Pressable>
    );
    const ghost = (label: string, onPress: () => void, testID: string): React.ReactNode => (
      <Pressable style={styles.ghostBtn} onPress={onPress} testID={testID}>
        <Text style={styles.ghostBtnText}>{label}</Text>
      </Pressable>
    );

    switch (state.phase) {
      case 'Lobby':
        if (isHost) {
          return (
            <View style={styles.actionRow}>
              {primary(
                isFull ? '开始本轮' : '还有空位未入座',
                () => void run(() => facade.startRound(), '开始失败'),
                'fib-start-round',
                !isFull,
              )}
            </View>
          );
        }
        return (
          <Text style={styles.waiting}>{mySeat !== null ? '等待房主开始' : '点座位入座'}</Text>
        );

      case 'Starting':
        return <Text style={styles.waiting}>出题中…</Text>;

      case 'Playing':
        return (
          <View style={styles.actionRow}>
            {mySeat !== null
              ? ghost('查看身份', () => setSheetOpen(true), 'fib-view-identity')
              : null}
            {isHost
              ? primary(
                  '公布答案',
                  () =>
                    showAlert('公布答案?', '将公开真词与所有人身份', [
                      { text: '取消', style: 'cancel' },
                      { text: '公布', onPress: () => void run(() => facade.reveal(), '公布失败') },
                    ]),
                  'fib-reveal',
                )
              : null}
          </View>
        );

      case 'Revealed':
        return (
          <View style={styles.actionRow}>
            {isHost ? (
              primary(
                '下一轮',
                () => void run(() => facade.nextRound(), '开始失败'),
                'fib-next-round',
              )
            ) : (
              <Text style={styles.waiting}>等待房主</Text>
            )}
            {isHost
              ? ghost(
                  '重新开始',
                  () =>
                    showAlert('重新开始?', '将弃掉本局回到房间', [
                      { text: '取消', style: 'cancel' },
                      {
                        text: '重新开始',
                        style: 'destructive',
                        onPress: () => void run(() => facade.restart(), '重新开始失败'),
                      },
                    ]),
                  'fib-restart',
                )
              : null}
          </View>
        );
    }
  }
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: typography.body, color: colors.textMuted },
  headerAction: { fontSize: typography.body, color: colors.primary },
  ribbon: {
    paddingHorizontal: spacing.screenH,
    paddingVertical: spacing.tight,
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  content: {
    paddingHorizontal: spacing.screenH,
    paddingBottom: spacing.large,
    gap: spacing.medium,
  },
  rulesLink: { fontSize: typography.secondary, color: colors.primary },
  starting: {
    fontSize: typography.subtitle,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.large,
  },
  playingHint: { fontSize: typography.secondary, color: colors.textSecondary },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: spacing.small,
  },
  answer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    padding: spacing.medium,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.tight,
  },
  answerTitle: { fontSize: typography.caption, color: colors.textMuted },
  answerWord: {
    fontSize: typography.heading,
    fontWeight: typography.weights.bold,
    color: colors.text,
    letterSpacing: 4,
  },
  answerDef: {
    fontSize: typography.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
  },
  footer: {
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.small,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  actionRow: { flexDirection: 'row', gap: spacing.small, alignItems: 'center' },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.large,
    paddingVertical: spacing.medium,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  primaryBtnText: {
    fontSize: typography.subtitle,
    fontWeight: typography.weights.semibold,
    color: colors.textInverse,
  },
  ghostBtn: {
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.large,
    borderRadius: borderRadius.large,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghostBtnText: { fontSize: typography.body, color: colors.textSecondary },
  waiting: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.body,
    color: colors.textMuted,
    paddingVertical: spacing.small,
  },
});

export default FibRoomScreen;
