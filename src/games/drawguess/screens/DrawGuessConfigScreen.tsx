/**
 * 你画我猜房间设置：人数与预计时长（机器人填充在大厅由房主一键操作）。
 */

import {
  DEFAULT_DRAWGUESS_CONFIG,
  DRAWGUESS_DRAWING_DURATION_SECONDS,
  DRAWGUESS_MAX_PLAYERS,
  DRAWGUESS_MIN_PLAYERS,
  DRAWGUESS_ROUND_END_SECONDS,
  DRAWGUESS_ROUNDS_PER_DRAWER,
  DRAWGUESS_WORD_SELECT_SECONDS,
  type DrawGuessConfig,
} from '@game-judge/game-engine/games/drawguess/public';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { GameScreen, GameScreenContent, GameScreenFooter } from '@/components/GameScreen';
import { GameSettingsStepper } from '@/components/GameSettings';
import { gameSettingsStyles as styles } from '@/components/GameSettings.styles';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuthContext } from '@/contexts/AuthContext';
import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import { useRoomCreationController } from '@/features/room/controllers/useRoomCreationController';
import {
  replaceWithCreatedRoom,
  returnToActiveRoom,
} from '@/features/room/navigation/roomFlowNavigation';
import type { DrawGuessRoomSession } from '@/games/drawguess/model/DrawGuessRoomSession';
import { parseDrawGuessConfigRouteParams } from '@/games/drawguess/navigation/drawGuessGameNavigation';
import { getDrawGuessRoomCommandFailureMessage } from '@/games/drawguess/room/drawGuessRoomCommandFailureMessage';
import type { RootStackParamList } from '@/navigation/types';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

/** 单轮固定耗时：选词 15 秒 + 作画 90 秒 + 结算 8 秒；总轮数 = 人数 × 2。 */
function estimateTotalMinutes(numberOfPlayers: number): number {
  const secondsPerTurn =
    DRAWGUESS_WORD_SELECT_SECONDS +
    DRAWGUESS_DRAWING_DURATION_SECONDS +
    DRAWGUESS_ROUND_END_SECONDS;
  return Math.round((numberOfPlayers * DRAWGUESS_ROUNDS_PER_DRAWER * secondsPerTurn) / 60);
}

/** 创建/编辑设置；保存走共享建房与命令控制器。 */
export function DrawGuessConfigScreen({ session }: { readonly session: DrawGuessRoomSession }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GameConfig'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GameConfig'>>();
  const params = parseDrawGuessConfigRouteParams(route.params);
  const { user } = useAuthContext();
  const insets = useSafeAreaInsets();
  const creation = useRoomCreationController();
  const submission = useRoomCommandSubmission(getDrawGuessRoomCommandFailureMessage);
  const [config, setConfig] = useState<DrawGuessConfig>(() => {
    if (params.mode === 'create') return DEFAULT_DRAWGUESS_CONFIG;
    const snapshot = session.getSnapshot();
    if (
      snapshot.phase !== 'ready' ||
      snapshot.identity.room.roomCode !== params.roomCode ||
      snapshot.snapshot.state.phase.kind !== 'lobby'
    )
      throw new Error('DrawGuess settings require the active lobby');
    return snapshot.snapshot.state.config;
  });
  const update = <TKey extends keyof DrawGuessConfig>(key: TKey, value: DrawGuessConfig[TKey]) =>
    setConfig((current) => ({ ...current, [key]: value }));
  const changePlayers = (difference: number) => {
    const count = config.numberOfPlayers + difference;
    if (count < DRAWGUESS_MIN_PLAYERS || count > DRAWGUESS_MAX_PLAYERS)
      return showErrorAlert('人数设置有误', '支持 4 至 12 人');
    update('numberOfPlayers', count);
  };
  const submit = () => {
    if (params.mode === 'edit') {
      void submission
        .submit('保存你画我猜设置', () =>
          session.dispatch(
            { type: 'drawguess.config.update', config },
            { controlledSeat: null, label: '保存设置' },
          ),
        )
        .then((success) => {
          if (success) returnToActiveRoom(navigation, params.roomCode);
        });
      return;
    }
    if (user === null) throw new Error('DrawGuess creation requires authentication');
    void creation
      .createRoom({ expectedHostUserId: user.id, gameType: 'drawguess', config: { ...config } })
      .then((record) => replaceWithCreatedRoom(navigation, record.roomCode))
      .catch((error: unknown) =>
        handleError(error, {
          label: '创建你画我猜房间',
          logger: configLog,
          alertMessage: '创建失败，请重试',
        }),
      );
  };
  return (
    <GameScreen
      testID="drawguess-config"
      header={
        <ScreenHeader
          title="你画我猜设置"
          topInset={insets.top}
          onBack={() =>
            navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')
          }
        />
      }
    >
      <GameScreenContent contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <GameSettingsStepper
            label="玩家人数"
            value={String(config.numberOfPlayers)}
            onDecrement={() => changePlayers(-1)}
            onIncrement={() => changePlayers(1)}
            isDecrementDisabled={config.numberOfPlayers === DRAWGUESS_MIN_PLAYERS}
            testID="drawguess-player-count"
          />
          <Text style={styles.hint}>
            每人画 {DRAWGUESS_ROUNDS_PER_DRAWER} 轮 · 共{' '}
            {config.numberOfPlayers * DRAWGUESS_ROUNDS_PER_DRAWER} 轮
          </Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>预计时长</Text>
          <Text style={styles.hint}>
            约 {estimateTotalMinutes(config.numberOfPlayers)} 分钟（选词{' '}
            {DRAWGUESS_WORD_SELECT_SECONDS} 秒 + 作画 {DRAWGUESS_DRAWING_DURATION_SECONDS} 秒 + 结算{' '}
            {DRAWGUESS_ROUND_END_SECONDS} 秒）。全员提前猜中或画手放弃会缩短。
          </Text>
        </View>
      </GameScreenContent>
      <GameScreenFooter>
        <Button
          variant="primary"
          size="lg"
          onPress={submit}
          loading={creation.isCreating || submission.isSubmitting}
          testID="drawguess-config-submit"
        >
          {params.mode === 'edit' ? '保存设置' : '创建房间'}
        </Button>
      </GameScreenFooter>
    </GameScreen>
  );
}
