/** Undercover configuration orchestrates shared creation and authoritative config updates. */
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  getUndercoverRoleCounts,
  isValidUndercoverConfig,
  UNDERCOVER_DEFAULT_PLAYERS,
  UNDERCOVER_MAX_PLAYERS,
  UNDERCOVER_MIN_PLAYERS,
  type UndercoverConfig,
} from '@game-judge/game-engine/games/undercover/public';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  type ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { Button } from '@/components/Button';
import { GameScreen, GameScreenContent, GameScreenFooter } from '@/components/GameScreen';
import { GameSettingsStepper } from '@/components/GameSettings';
import { gameSettingsStyles } from '@/components/GameSettings.styles';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuthContext } from '@/contexts/AuthContext';
import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import { useRoomCreationController } from '@/features/room/controllers/useRoomCreationController';
import {
  replaceWithCreatedRoom,
  returnToActiveRoom,
} from '@/features/room/navigation/roomFlowNavigation';
import type { RootStackParamList } from '@/navigation/types';
import { colors, spacing, withAlpha } from '@/theme';
import { componentSizes } from '@/theme/tokens';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

import type { UndercoverRoomSession } from '../model/UndercoverRoomSession';
import { parseUndercoverConfigRouteParams } from '../navigation/undercoverGameNavigation';
import { UNDERCOVER_CATEGORY_NAMES } from '../room/undercoverRoomAdapter';
import { getUndercoverRoomCommandFailureMessage } from '../room/undercoverRoomCommandFailureMessage';
import { undercoverInventoryOptions } from '../services/undercoverInventory';

export function UndercoverConfigScreen({ session }: { readonly session: UndercoverRoomSession }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GameConfig'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GameConfig'>>();
  const params = parseUndercoverConfigRouteParams(route.params);
  const { user } = useAuthContext();
  const insets = useSafeAreaInsets();
  const creation = useRoomCreationController();
  const inventory = useQuery(undercoverInventoryOptions);
  const categories: readonly UndercoverConfig['category'][] =
    inventory.isSuccess && inventory.data.length > 0 ? ['all', ...inventory.data] : [];
  useEffect(() => {
    if (inventory.error !== null) {
      handleError(inventory.error, {
        label: '读取词语分类',
        logger: configLog,
        alertMessage: '读取词语分类失败，请重试',
      });
    }
  }, [inventory.error]);
  const submission = useRoomCommandSubmission(getUndercoverRoomCommandFailureMessage);
  const [config, setConfig] = useState<UndercoverConfig>(() => {
    if (params.mode === 'create')
      return {
        numberOfPlayers: UNDERCOVER_DEFAULT_PLAYERS,
        hasBlank: false,
        category: 'all',
      };
    const snapshot = session.getSnapshot();
    if (snapshot.phase !== 'ready' || snapshot.identity.room.roomCode !== params.roomCode)
      throw new Error('Undercover config requires the matching active room');
    return snapshot.snapshot.state.config;
  });
  const [playerCountText, setPlayerCountText] = useState(String(config.numberOfPlayers));
  const [isCategoryVisible, setIsCategoryVisible] = useState(false);
  const selectedConfig = { ...config, numberOfPlayers: Number(playerCountText) };
  const counts =
    /^\d+$/.test(playerCountText) && isValidUndercoverConfig(selectedConfig)
      ? getUndercoverRoleCounts(selectedConfig.numberOfPlayers, selectedConfig.hasBlank)
      : null;
  const submit = async () => {
    if (!inventory.isSuccess) {
      showErrorAlert('分类尚未就绪', '请等待分类加载完成，或重试读取分类');
      return;
    }
    if (!categories.includes(config.category)) {
      showErrorAlert('暂无可用词语', '请选择有可用词语的分类，或稍后重试');
      return;
    }
    if (counts === null) {
      showErrorAlert('设置有误', '人数需为 4 至 12 人；启用白板至少需要 6 人');
      return;
    }
    if (params.mode === 'edit') {
      if (
        await submission.submit('保存设置', () =>
          session.dispatch(
            { type: 'undercover.config.update', config: selectedConfig },
            { controlledSeat: null, label: '保存设置' },
          ),
        )
      )
        returnToActiveRoom(navigation, params.roomCode);
      return;
    }
    if (user === null) throw new Error('Undercover creation requires authentication');
    try {
      const room = await creation.createRoom({
        expectedHostUserId: user.id,
        gameType: 'undercover',
        config: selectedConfig,
      });
      replaceWithCreatedRoom(navigation, room.roomCode);
    } catch (error) {
      handleError(error, {
        label: '创建谁是卧底房间',
        logger: configLog,
        alertMessage: '创建房间失败，请稍后重试',
      });
    }
  };
  const stepCount = (delta: number) => {
    const count = Number(playerCountText) + delta;
    if (
      !Number.isSafeInteger(count) ||
      count < UNDERCOVER_MIN_PLAYERS ||
      count > UNDERCOVER_MAX_PLAYERS
    ) {
      showErrorAlert('人数设置有误', '支持 4 至 12 人');
      return;
    }
    setPlayerCountText(String(count));
  };
  const renderCategory = useCallback(
    ({ item }: ListRenderItemInfo<UndercoverConfig['category']>) => (
      <Pressable
        style={gameSettingsStyles.row}
        accessibilityRole="radio"
        accessibilityLabel={UNDERCOVER_CATEGORY_NAMES[item]}
        accessibilityState={{ checked: config.category === item }}
        onPress={() => {
          setConfig((previous) => ({ ...previous, category: item }));
          setIsCategoryVisible(false);
        }}
      >
        <Text style={gameSettingsStyles.label}>{UNDERCOVER_CATEGORY_NAMES[item]}</Text>
        <Ionicons
          name={config.category === item ? 'radio-button-on' : 'radio-button-off'}
          size={componentSizes.icon.sm}
          color={config.category === item ? colors.primary : colors.textSecondary}
        />
      </Pressable>
    ),
    [config.category],
  );
  return (
    <GameScreen
      header={
        <ScreenHeader
          title="谁是卧底设置"
          topInset={insets.top}
          onBack={() =>
            navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')
          }
        />
      }
    >
      <GameScreenContent contentContainerStyle={gameSettingsStyles.content}>
        <View style={gameSettingsStyles.section}>
          <GameSettingsStepper
            label="玩家人数"
            onDecrement={() => stepCount(-1)}
            onIncrement={() => stepCount(1)}
            value={playerCountText}
            onChangeText={setPlayerCountText}
            testID="undercover-player-count"
          />
          <Text style={gameSettingsStyles.hint}>支持 4 至 12 人，启用白板至少需要 6 人</Text>
        </View>
        <View style={gameSettingsStyles.section}>
          <View style={gameSettingsStyles.row}>
            <Text style={gameSettingsStyles.label}>白板</Text>
            <Switch
              accessibilityLabel="启用白板"
              value={config.hasBlank}
              onValueChange={(hasBlank) => setConfig({ ...config, hasBlank })}
              trackColor={{ false: colors.border, true: withAlpha(colors.primary, 0.4) }}
              thumbColor={config.hasBlank ? colors.primary : colors.textSecondary}
            />
          </View>
          <Text style={gameSettingsStyles.hint}>白板没有词语，替换一名平民。</Text>
        </View>
        <View style={gameSettingsStyles.section}>
          <Pressable
            style={gameSettingsStyles.row}
            accessibilityRole="button"
            accessibilityLabel={`词语分类：${UNDERCOVER_CATEGORY_NAMES[config.category]}`}
            onPress={() => setIsCategoryVisible(true)}
            testID="undercover-category"
          >
            <Text style={gameSettingsStyles.label}>词语分类</Text>
            <View style={styles.categoryValue}>
              <Text style={gameSettingsStyles.hint}>
                {UNDERCOVER_CATEGORY_NAMES[config.category]}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={componentSizes.icon.sm}
                color={colors.textSecondary}
              />
            </View>
          </Pressable>
        </View>
      </GameScreenContent>
      <GameScreenFooter>
        {counts !== null && (
          <Text style={gameSettingsStyles.summary}>
            平民 {counts.civilian} 人 · 卧底 {counts.undercover} 人 · 白板 {counts.blank} 人
          </Text>
        )}
        <Button
          variant="primary"
          size="lg"
          onPress={() => void submit()}
          loading={creation.isCreating || submission.isSubmitting}
          testID="undercover-config-submit"
        >
          {params.mode === 'edit' ? '保存设置' : '创建房间'}
        </Button>
      </GameScreenFooter>
      {isCategoryVisible && (
        <BaseCenterModal
          visible
          onClose={() => setIsCategoryVisible(false)}
          dismissOnOverlayPress
          contentStyle={styles.modal}
        >
          <Text style={gameSettingsStyles.label} accessibilityRole="header">
            词语分类
          </Text>
          {inventory.isPending ? (
            <Text style={gameSettingsStyles.hint}>正在读取分类</Text>
          ) : inventory.isError ? (
            <Button variant="secondary" onPress={() => void inventory.refetch()}>
              重试读取分类
            </Button>
          ) : categories.length === 0 ? (
            <Text style={gameSettingsStyles.hint}>暂无可用词语</Text>
          ) : (
            <FlatList
              data={categories}
              renderItem={renderCategory}
              keyExtractor={(category) => category}
            />
          )}
          <Button variant="ghost" onPress={() => setIsCategoryVisible(false)}>
            关闭
          </Button>
        </BaseCenterModal>
      )}
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  categoryValue: { flexDirection: 'row', alignItems: 'center', gap: spacing.small },
  modal: { width: 440, maxWidth: '94%', maxHeight: '85%', gap: spacing.medium },
});
