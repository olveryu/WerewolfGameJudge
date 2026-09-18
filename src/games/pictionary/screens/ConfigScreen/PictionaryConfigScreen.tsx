/** Pictionary create/edit configuration hosted by the shared root navigator. */

import Ionicons from '@expo/vector-icons/Ionicons';
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
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { parsePictionaryConfigRouteParams } from '@/games/pictionary/navigation/pictionaryConfigRoute';
import type { RootStackParamList } from '@/navigation/types';
import { TESTIDS } from '@/testids';
import { colors, componentSizes } from '@/theme';

import { pictionaryConfigStyles as styles } from './PictionaryConfigScreen.styles';
import {
  type PictionaryConfigScreenState,
  usePictionaryConfigScreenState,
} from './usePictionaryConfigScreenState';

interface PictionaryConfigScreenProps {
  readonly session: PictionaryRoomSession;
}

interface DurationOptionProps<TDuration extends number | null> {
  readonly value: TDuration;
  readonly selected: boolean;
  readonly testID: string;
  readonly onSelect: (value: TDuration) => void;
}

function DurationOption<TDuration extends number | null>({
  value,
  selected,
  testID,
  onSelect,
}: DurationOptionProps<TDuration>): React.ReactElement {
  const handlePress = useCallback(() => onSelect(value), [onSelect, value]);
  return (
    <Pressable
      onPress={handlePress}
      testID={testID}
      style={[styles.option, selected && styles.optionSelected]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
        {value === null ? '不限时' : `${value} 秒`}
      </Text>
    </Pressable>
  );
}

interface DurationSectionProps<TDuration extends number | null> {
  readonly setting: 'drawing' | 'guess' | 'transition' | 'gallery';
  readonly title: string;
  readonly hint: string;
  readonly values: readonly TDuration[];
  readonly selected: TDuration;
  readonly onSelect: (value: TDuration) => void;
}

function DurationSection<TDuration extends number | null>({
  setting,
  title,
  hint,
  values,
  selected,
  onSelect,
}: DurationSectionProps<TDuration>): React.ReactElement {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionHint}>{hint}</Text>
      <View style={styles.optionRow}>
        {values.map((value) => (
          <DurationOption
            key={value ?? 'unlimited'}
            value={value}
            selected={value === selected}
            testID={TESTIDS.pictionaryConfigDurationOption(setting, value ?? 'unlimited')}
            onSelect={onSelect}
          />
        ))}
      </View>
    </View>
  );
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
    <SafeAreaView
      style={styles.container}
      edges={['left', 'right']}
      testID={TESTIDS.configScreenRoot}
    >
      <ScreenHeader title="接龙设置" onBack={state.goBack} topInset={insets.top} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>{state.isEditMode ? '房间设置' : '创建房间'}</Text>
        <Text style={styles.title}>让每一棒都来不及想太多</Text>
        <Text style={styles.description}>
          4–20 人，默认 6 人。N 人共 N 棒，文字和绘画交替，每人只参与同一本画册一次。
        </Text>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>玩家人数</Text>
          <View style={styles.playerRow}>
            <Button
              variant="icon"
              size="lg"
              onPress={state.decrementPlayers}
              disabled={state.config.numberOfPlayers === 4}
              accessibilityLabel="减少人数"
            >
              <Ionicons name="remove" size={componentSizes.icon.md} color={colors.text} />
            </Button>
            <Text style={styles.count} testID={TESTIDS.pictionaryConfigPlayerCount}>
              {state.config.numberOfPlayers} 人
            </Text>
            <Button
              variant="icon"
              size="lg"
              onPress={state.incrementPlayers}
              accessibilityLabel="增加人数"
            >
              <Ionicons name="add" size={componentSizes.icon.md} color={colors.text} />
            </Button>
          </View>
        </View>
        <DurationSection
          setting="drawing"
          title="绘画时间"
          hint="默认 120 秒，足够画清重点"
          values={PICTIONARY_DRAWING_DURATIONS}
          selected={state.config.drawingDurationSeconds}
          onSelect={durations.drawing}
        />
        <DurationSection
          setting="guess"
          title="文字作答时间"
          hint="用于开场出题和看图猜词"
          values={PICTIONARY_GUESS_DURATIONS}
          selected={state.config.guessDurationSeconds}
          onSelect={durations.guess}
        />
        <DurationSection
          setting="transition"
          title="每棒间隔"
          hint="给大家留一点换手时间"
          values={PICTIONARY_TRANSITION_DURATIONS}
          selected={state.config.transitionDurationSeconds}
          onSelect={durations.transition}
        />
        <DurationSection
          setting="gallery"
          title="结果播放"
          hint="不限时会改为房主手动翻页"
          values={PICTIONARY_GALLERY_ITEM_DURATIONS}
          selected={state.config.galleryItemDurationSeconds}
          onSelect={durations.gallery}
        />
        <Text style={styles.estimate}>{getEstimatedMinutes(state.config)}</Text>
      </ScrollView>
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom }]}>
        <Button
          variant="primary"
          size="lg"
          onPress={state.submit}
          loading={state.isSubmitting}
          style={styles.submit}
          testID={TESTIDS.pictionaryConfigSubmitButton}
        >
          {state.isEditMode ? '保存设置' : '创建房间'}
        </Button>
      </View>
    </SafeAreaView>
  );
};
