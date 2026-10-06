/** Story Relay settings using the shared compact settings controls and authoritative room session. */

import Ionicons from '@expo/vector-icons/Ionicons';
import {
  DEFAULT_STORY_RELAY_CONFIG,
  STORY_RELAY_GALLERY_DURATIONS,
  STORY_RELAY_MAX_PLAYERS,
  STORY_RELAY_MIN_PLAYERS,
  STORY_RELAY_TRANSITION_DURATIONS,
  STORY_RELAY_WRITING_DURATIONS,
  type StoryRelayConfig,
} from '@game-judge/game-engine/games/storyrelay/public';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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
import type { StoryRelayRoomSession } from '@/games/storyrelay/model/StoryRelayRoomSession';
import { parseStoryRelayConfigRouteParams } from '@/games/storyrelay/navigation/storyRelayGameNavigation';
import { getStoryRelayRoomCommandFailureMessage } from '@/games/storyrelay/room/storyRelayRoomCommandFailureMessage';
import type { RootStackParamList } from '@/navigation/types';
import { colors, componentSizes } from '@/theme';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

function DurationOptions<TDuration extends number | null>({
  title,
  values,
  value,
  onChange,
  nullLabel = '不限时',
}: {
  readonly title: string;
  readonly values: readonly TDuration[];
  readonly value: TDuration;
  readonly onChange: (value: TDuration) => void;
  readonly nullLabel?: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{title}</Text>
      <View style={styles.optionRow}>
        {values.map((option) => (
          <Pressable
            key={option ?? 'unlimited'}
            onPress={() => onChange(option)}
            accessibilityRole="radio"
            accessibilityLabel={`${title} ${option === null ? nullLabel : `${option} 秒`}`}
            accessibilityState={{ checked: option === value }}
            aria-checked={option === value}
            style={[styles.option, option === value && styles.optionSelected]}
          >
            <Ionicons
              name={option === value ? 'radio-button-on' : 'radio-button-off'}
              size={componentSizes.icon.sm}
              color={option === value ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.optionText, option === value && styles.optionTextSelected]}>
              {option === null ? nullLabel : `${option} 秒`}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Renders create/edit settings, saving through shared creation and command controllers. */
export function StoryRelayConfigScreen({ session }: { readonly session: StoryRelayRoomSession }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GameConfig'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GameConfig'>>();
  const params = parseStoryRelayConfigRouteParams(route.params);
  const { user } = useAuthContext();
  const insets = useSafeAreaInsets();
  const creation = useRoomCreationController();
  const submission = useRoomCommandSubmission(getStoryRelayRoomCommandFailureMessage);
  const [config, setConfig] = useState<StoryRelayConfig>(() => {
    if (params.mode === 'create') return DEFAULT_STORY_RELAY_CONFIG;
    const snapshot = session.getSnapshot();
    if (
      snapshot.phase !== 'ready' ||
      snapshot.identity.room.roomCode !== params.roomCode ||
      snapshot.snapshot.state.phase !== 'lobby'
    )
      throw new Error('Story Relay settings require the active lobby');
    return snapshot.snapshot.state.config;
  });
  const update = <TKey extends keyof StoryRelayConfig>(key: TKey, value: StoryRelayConfig[TKey]) =>
    setConfig((current) => ({ ...current, [key]: value }));
  const changePlayers = (difference: number) => {
    const count = config.numberOfPlayers + difference;
    if (count < STORY_RELAY_MIN_PLAYERS || count > STORY_RELAY_MAX_PLAYERS)
      return showErrorAlert('人数设置有误', '支持 4 至 20 人');
    update('numberOfPlayers', count);
  };
  const submit = () => {
    if (params.mode === 'edit') {
      void submission
        .submit('保存故事接龙设置', () =>
          session.dispatch(
            { type: 'storyrelay.config.update', config },
            { controlledSeat: null, label: '保存设置' },
          ),
        )
        .then((success) => {
          if (success) returnToActiveRoom(navigation, params.roomCode);
        });
      return;
    }
    if (user === null) throw new Error('Story Relay creation requires authentication');
    void creation
      .createRoom({ expectedHostUserId: user.id, gameType: 'storyrelay', config: { ...config } })
      .then((record) => replaceWithCreatedRoom(navigation, record.roomCode))
      .catch((error: unknown) =>
        handleError(error, {
          label: '创建故事接龙房间',
          logger: configLog,
          alertMessage: '创建失败，请重试',
        }),
      );
  };
  return (
    <GameScreen
      testID="storyrelay-config"
      header={
        <ScreenHeader
          title="故事接龙设置"
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
            isDecrementDisabled={config.numberOfPlayers === STORY_RELAY_MIN_PLAYERS}
            testID="storyrelay-player-count"
          />
          <Text style={styles.hint}>
            {config.numberOfPlayers} 个故事 · 每人 {config.numberOfPlayers} 棒
          </Text>
        </View>
        <DurationOptions
          title="写作时间"
          values={STORY_RELAY_WRITING_DURATIONS}
          value={config.writingDurationSeconds}
          onChange={(value) => update('writingDurationSeconds', value)}
        />
        <DurationOptions
          title="每棒间隔"
          values={STORY_RELAY_TRANSITION_DURATIONS}
          value={config.transitionDurationSeconds}
          onChange={(value) => update('transitionDurationSeconds', value)}
        />
        <DurationOptions
          title="每段回放"
          values={STORY_RELAY_GALLERY_DURATIONS}
          value={config.galleryItemDurationSeconds}
          onChange={(value) => update('galleryItemDurationSeconds', value)}
          nullLabel="手动翻页"
        />
      </GameScreenContent>
      <GameScreenFooter>
        <Button
          variant="primary"
          size="lg"
          onPress={submit}
          loading={creation.isCreating || submission.isSubmitting}
          testID="storyrelay-config-submit"
        >
          {params.mode === 'edit' ? '保存设置' : '创建房间'}
        </Button>
      </GameScreenFooter>
    </GameScreen>
  );
}
