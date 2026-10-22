/** Pictionary create/edit configuration hosted by the shared root navigator. */

import {
  getPictionaryRelayStepCount,
  PICTIONARY_DRAWING_DURATIONS,
  PICTIONARY_GALLERY_ITEM_DURATIONS,
  PICTIONARY_GUESS_DURATIONS,
  PICTIONARY_TRANSITION_DURATIONS,
  type PictionaryConfig,
} from '@game-judge/game-engine/games/pictionary/public';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { GameScreen, GameScreenContent, GameScreenFooter } from '@/components/GameScreen';
import { GameSettingsDurationOptions, GameSettingsStepper } from '@/components/GameSettings';
import { gameSettingsStyles } from '@/components/GameSettings.styles';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { parsePictionaryConfigRouteParams } from '@/games/pictionary/navigation/pictionaryGameNavigation';
import type { RootStackParamList } from '@/navigation/types';
import { TESTIDS } from '@/testids';

import { pictionaryConfigStyles as styles } from './PictionaryConfigScreen.styles';
import {
  type PictionaryConfigScreenState,
  usePictionaryConfigScreenState,
} from './usePictionaryConfigScreenState';

interface PictionaryConfigScreenProps {
  readonly session: PictionaryRoomSession;
}

function useDurationHandlers(state: PictionaryConfigScreenState) {
  return {
    drawing: useCallback(
      (value: PictionaryConfig['drawingDurationSeconds']) =>
        state.updateConfig('drawingDurationSeconds', value),
      [state],
    ),
    guess: useCallback(
      (value: PictionaryConfig['guessDurationSeconds']) =>
        state.updateConfig('guessDurationSeconds', value),
      [state],
    ),
    transition: useCallback(
      (value: PictionaryConfig['transitionDurationSeconds']) => {
        state.updateConfig('transitionDurationSeconds', value);
      },
      [state],
    ),
    gallery: useCallback(
      (value: PictionaryConfig['galleryItemDurationSeconds']) =>
        state.updateConfig('galleryItemDurationSeconds', value),
      [state],
    ),
  };
}

function getEstimatedMinutes(config: PictionaryConfig): string {
  const relayStepCount = getPictionaryRelayStepCount(config.numberOfPlayers);
  const answeringSeconds =
    Math.floor(relayStepCount / 2) * (config.drawingDurationSeconds ?? 0) +
    Math.ceil(relayStepCount / 2) * (config.guessDurationSeconds ?? 0) +
    relayStepCount * config.transitionDurationSeconds;
  if (
    config.drawingDurationSeconds === null ||
    config.guessDurationSeconds === null ||
    config.galleryItemDurationSeconds === null
  ) {
    return '含不限时阶段，实际时长由房主推进';
  }
  const gallerySeconds =
    config.numberOfPlayers * relayStepCount * config.galleryItemDurationSeconds;
  const answeringMinutes = Math.max(1, Math.ceil(answeringSeconds / 60));
  const galleryMinutes = Math.max(1, Math.ceil(gallerySeconds / 60));
  return `预计整局约 ${answeringMinutes + galleryMinutes} 分钟（作答 ${answeringMinutes} 分钟，揭晓 ${galleryMinutes} 分钟）`;
}

export const PictionaryConfigScreen: React.FC<PictionaryConfigScreenProps> = ({ session }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GameConfig'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GameConfig'>>();
  const insets = useSafeAreaInsets();
  const state = usePictionaryConfigScreenState({
    params: parsePictionaryConfigRouteParams(route.params),
    navigation,
    session,
  });
  const durations = useDurationHandlers(state);

  return (
    <GameScreen
      testID={TESTIDS.configScreenRoot}
      header={<ScreenHeader title="你画我猜接龙设置" onBack={state.goBack} topInset={insets.top} />}
    >
      <GameScreenContent contentContainerStyle={gameSettingsStyles.content}>
        <View style={styles.section}>
          <GameSettingsStepper
            label="玩家人数"
            onDecrement={state.decrementPlayers}
            onIncrement={state.incrementPlayers}
            isDecrementDisabled={state.config.numberOfPlayers === 4}
            value={String(state.config.numberOfPlayers)}
            testID={TESTIDS.pictionaryConfigPlayerCount}
          />
          <Text style={styles.sectionHint}>
            支持 4 至 20 人 · 共 {getPictionaryRelayStepCount(state.config.numberOfPlayers)} 棒
          </Text>
        </View>
        <GameSettingsDurationOptions
          title="绘画时间"
          hint="默认 120 秒，足够画清重点"
          values={PICTIONARY_DRAWING_DURATIONS}
          value={state.config.drawingDurationSeconds}
          onChange={durations.drawing}
          optionTestID={(value) =>
            TESTIDS.pictionaryConfigDurationOption('drawing', value ?? 'unlimited')
          }
        />
        <GameSettingsDurationOptions
          title="文字作答时间"
          hint="用于开场出题和看图猜词"
          values={PICTIONARY_GUESS_DURATIONS}
          value={state.config.guessDurationSeconds}
          onChange={durations.guess}
          optionTestID={(value) =>
            TESTIDS.pictionaryConfigDurationOption('guess', value ?? 'unlimited')
          }
        />
        <GameSettingsDurationOptions
          title="每棒间隔"
          hint="给大家留一点换手时间"
          values={PICTIONARY_TRANSITION_DURATIONS}
          value={state.config.transitionDurationSeconds}
          onChange={durations.transition}
          optionTestID={(value) =>
            TESTIDS.pictionaryConfigDurationOption('transition', value ?? 'unlimited')
          }
        />
        <GameSettingsDurationOptions
          title="结果播放"
          hint="不限时会改为房主手动翻页"
          values={PICTIONARY_GALLERY_ITEM_DURATIONS}
          value={state.config.galleryItemDurationSeconds}
          onChange={durations.gallery}
          optionTestID={(value) =>
            TESTIDS.pictionaryConfigDurationOption('gallery', value ?? 'unlimited')
          }
        />
        <Text style={styles.estimate}>{getEstimatedMinutes(state.config)}</Text>
      </GameScreenContent>
      <GameScreenFooter>
        <Text style={gameSettingsStyles.summary}>共 {state.config.numberOfPlayers} 人</Text>
        <Button
          variant="primary"
          size="lg"
          onPress={state.submit}
          loading={state.isSubmitting}
          testID={TESTIDS.pictionaryConfigSubmitButton}
        >
          {state.isEditMode ? '保存设置' : '创建房间'}
        </Button>
      </GameScreenFooter>
    </GameScreen>
  );
};
