/**
 * Demo房间设置：人数（机器人填充在大厅由房主一键操作）。
 */

import {
  DEFAULT_DEMO_CONFIG,
  DEMO_MAX_PLAYERS,
  DEMO_MIN_PLAYERS,
  type DemoConfig,
} from '@game-judge/game-engine/games/demo/public';
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
import type { DemoRoomSession } from '@/games/demo/model/DemoRoomSession';
import { parseDemoConfigRouteParams } from '@/games/demo/navigation/demoGameNavigation';
import { getDemoRoomCommandFailureMessage } from '@/games/demo/room/demoRoomCommandFailureMessage';
import type { RootStackParamList } from '@/navigation/types';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

// TODO(gameplay): 玩法配置项（时长、模式等）按设计文档加进本页与引擎 Config。

/** 创建/编辑设置；保存走共享建房与命令控制器。 */
export function DemoConfigScreen({ session }: { readonly session: DemoRoomSession }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GameConfig'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GameConfig'>>();
  const params = parseDemoConfigRouteParams(route.params);
  const { user } = useAuthContext();
  const insets = useSafeAreaInsets();
  const creation = useRoomCreationController();
  const submission = useRoomCommandSubmission(getDemoRoomCommandFailureMessage);
  const [config, setConfig] = useState<DemoConfig>(() => {
    if (params.mode === 'create') return DEFAULT_DEMO_CONFIG;
    const snapshot = session.getSnapshot();
    if (
      snapshot.phase !== 'ready' ||
      snapshot.identity.room.roomCode !== params.roomCode ||
      snapshot.snapshot.state.phase.kind !== 'lobby'
    )
      throw new Error('Demo settings require the active lobby');
    return snapshot.snapshot.state.config;
  });
  const changePlayers = (difference: number) => {
    const count = config.numberOfPlayers + difference;
    if (count < DEMO_MIN_PLAYERS || count > DEMO_MAX_PLAYERS)
      return showErrorAlert('人数设置有误', `支持 ${DEMO_MIN_PLAYERS} 至 ${DEMO_MAX_PLAYERS} 人`);
    setConfig((current) => ({ ...current, numberOfPlayers: count }));
  };
  const submit = () => {
    if (params.mode === 'edit') {
      void submission
        .submit('保存Demo设置', () =>
          session.dispatch(
            { type: 'demo.config.update', config },
            { controlledSeat: null, label: '保存设置' },
          ),
        )
        .then((success) => {
          if (success) returnToActiveRoom(navigation, params.roomCode);
        });
      return;
    }
    if (user === null) throw new Error('Demo creation requires authentication');
    void creation
      .createRoom({ expectedHostUserId: user.id, gameType: 'demo', config: { ...config } })
      .then((record) => replaceWithCreatedRoom(navigation, record.roomCode))
      .catch((error: unknown) =>
        handleError(error, {
          label: '创建Demo房间',
          logger: configLog,
          alertMessage: '创建失败，请重试',
        }),
      );
  };
  return (
    <GameScreen
      testID="demo-config"
      header={
        <ScreenHeader
          title="Demo设置"
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
            isDecrementDisabled={config.numberOfPlayers === DEMO_MIN_PLAYERS}
            testID="demo-player-count"
          />
          <Text style={styles.hint}>
            支持 {DEMO_MIN_PLAYERS} 至 {DEMO_MAX_PLAYERS}
            人；开局要求坐满全部座位（可填充机器人）。
          </Text>
        </View>
      </GameScreenContent>
      <GameScreenFooter>
        <Button
          variant="primary"
          size="lg"
          onPress={submit}
          loading={creation.isCreating || submission.isSubmitting}
          testID="demo-config-submit"
        >
          {params.mode === 'edit' ? '保存设置' : '创建房间'}
        </Button>
      </GameScreenFooter>
    </GameScreen>
  );
}
