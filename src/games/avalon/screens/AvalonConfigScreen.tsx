/**
 * 阿瓦隆房间设置：人数（即板子）、投票模式、否决上限（机器人填充在大厅由房主一键操作）。
 */

import {
  AVALON_BOARDS,
  AVALON_DEFAULT_VETO_LIMIT,
  AVALON_DEFAULT_VOTE_MODE,
  AVALON_LADY_MIN_PLAYERS,
  AVALON_MAX_PLAYERS,
  AVALON_MIN_PLAYERS,
  AVALON_QUEST_SIZES,
  AVALON_VETO_LIMIT_MAX,
  AVALON_VETO_LIMIT_MIN,
  type AvalonConfig,
  type AvalonPlayerCount,
  type AvalonRoleId,
  DEFAULT_AVALON_CONFIG,
  isAvalonPlayerCount,
  isAvalonVetoLimit,
} from '@game-judge/game-engine/games/avalon/public';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import type { AvalonRoomSession } from '@/games/avalon/model/AvalonRoomSession';
import { parseAvalonConfigRouteParams } from '@/games/avalon/navigation/avalonGameNavigation';
import { getAvalonRoomCommandFailureMessage } from '@/games/avalon/room/avalonRoomCommandFailureMessage';
import type { RootStackParamList } from '@/navigation/types';
import { borderRadius, colors, fixed, spacing, textStyles } from '@/theme';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

import { getAvalonRoleDisplayName } from '../model/avalonRoleDisplay';

/** 板子只读展示：按阵营分组的角色中文名。 */
function AvalonBoardPreview({ playerCount }: { readonly playerCount: AvalonPlayerCount }) {
  const roles: readonly AvalonRoleId[] = AVALON_BOARDS[playerCount];
  const questSizes = AVALON_QUEST_SIZES[playerCount];
  return (
    <View style={boardStyles.container}>
      <Text style={boardStyles.title}>本局板子（{playerCount} 人）</Text>
      <View style={boardStyles.roleRow}>
        {roles.map((role, index) => (
          <View key={`${role}-${index}`} style={boardStyles.roleChip}>
            <Text style={boardStyles.roleText}>{getAvalonRoleDisplayName(role)}</Text>
          </View>
        ))}
      </View>
      <Text style={boardStyles.hint}>
        任务人数：{questSizes.join('-')}
        {playerCount >= AVALON_LADY_MIN_PLAYERS ? ' · 含湖中仙女' : ''}
      </Text>
    </View>
  );
}

const boardStyles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.tight,
    padding: spacing.small,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  title: {
    ...textStyles.subtitleSemibold,
    color: colors.text,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.tight,
  },
  roleChip: {
    paddingVertical: spacing.tight,
    paddingHorizontal: spacing.small,
    backgroundColor: colors.surfaceHover,
    borderRadius: borderRadius.small,
  },
  roleText: {
    ...textStyles.secondary,
    color: colors.text,
  },
  hint: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
});

/** 创建/编辑设置；保存走共享建房与命令控制器。 */
export function AvalonConfigScreen({ session }: { readonly session: AvalonRoomSession }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GameConfig'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GameConfig'>>();
  const params = parseAvalonConfigRouteParams(route.params);
  const { user } = useAuthContext();
  const insets = useSafeAreaInsets();
  const creation = useRoomCreationController();
  const submission = useRoomCommandSubmission(getAvalonRoomCommandFailureMessage);
  // Worker 的 avalonCreateConfigSchema 全字段必填（无 schema 默认值），
  // 创建/更新必须永远提交完整三字段；D7/D8 的"默认"即此处 UI 预选值。
  const [config, setConfig] = useState<AvalonConfig>(() => {
    if (params.mode === 'create')
      return {
        numberOfPlayers: DEFAULT_AVALON_CONFIG.numberOfPlayers,
        voteMode: AVALON_DEFAULT_VOTE_MODE,
        vetoLimit: AVALON_DEFAULT_VETO_LIMIT,
      };
    const snapshot = session.getSnapshot();
    if (
      snapshot.phase !== 'ready' ||
      snapshot.identity.room.roomCode !== params.roomCode ||
      snapshot.snapshot.state.phase.kind !== 'lobby'
    )
      throw new Error('Avalon settings require the active lobby');
    return snapshot.snapshot.state.config;
  });
  const changePlayers = (difference: number) => {
    const count = config.numberOfPlayers + difference;
    if (!isAvalonPlayerCount(count))
      return showErrorAlert(
        '人数设置有误',
        `支持 ${AVALON_MIN_PLAYERS} 至 ${AVALON_MAX_PLAYERS} 人`,
      );
    setConfig((current) => ({ ...current, numberOfPlayers: count }));
  };
  const changeVetoLimit = (difference: number) => {
    const limit = config.vetoLimit + difference;
    if (!isAvalonVetoLimit(limit))
      return showErrorAlert(
        '否决上限设置有误',
        `支持 ${AVALON_VETO_LIMIT_MIN} 至 ${AVALON_VETO_LIMIT_MAX}`,
      );
    setConfig((current) => ({ ...current, vetoLimit: limit }));
  };
  const submit = () => {
    if (params.mode === 'edit') {
      void submission
        .submit('保存阿瓦隆设置', () =>
          session.dispatch(
            { type: 'avalon.config.update', config },
            { controlledSeat: null, label: '保存设置' },
          ),
        )
        .then((success) => {
          if (success) returnToActiveRoom(navigation, params.roomCode);
        });
      return;
    }
    if (user === null) throw new Error('Avalon creation requires authentication');
    void creation
      .createRoom({ expectedHostUserId: user.id, gameType: 'avalon', config: { ...config } })
      .then((record) => replaceWithCreatedRoom(navigation, record.roomCode))
      .catch((error: unknown) =>
        handleError(error, {
          label: '创建阿瓦隆房间',
          logger: configLog,
          alertMessage: '创建失败，请重试',
        }),
      );
  };
  return (
    <GameScreen
      testID="avalon-config"
      header={
        <ScreenHeader
          title="阿瓦隆设置"
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
            isDecrementDisabled={config.numberOfPlayers === AVALON_MIN_PLAYERS}
            testID="avalon-player-count"
          />
          <Text style={styles.hint}>人数即板子：5–10 人各对应一张固定板子。</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>组队投票模式</Text>
          <View style={voteModeStyles.row}>
            <Button
              variant={config.voteMode === 'public' ? 'primary' : 'secondary'}
              size="md"
              onPress={() => setConfig((current) => ({ ...current, voteMode: 'public' }))}
              testID="avalon-vote-mode-public"
            >
              公投
            </Button>
            <Button
              variant={config.voteMode === 'secret' ? 'primary' : 'secondary'}
              size="md"
              onPress={() => setConfig((current) => ({ ...current, voteMode: 'secret' }))}
              testID="avalon-vote-mode-secret"
            >
              暗投
            </Button>
          </View>
          <Text style={styles.hint}>
            公投：结束投票后同时亮票，每人投了什么全员可见；暗投：只公布赞成 /
            反对数量。任务出牌永远是暗投。
          </Text>
        </View>
        <View style={styles.section}>
          <GameSettingsStepper
            label="否决上限"
            value={String(config.vetoLimit)}
            onDecrement={() => changeVetoLimit(-1)}
            onIncrement={() => changeVetoLimit(1)}
            isDecrementDisabled={config.vetoLimit === AVALON_VETO_LIMIT_MIN}
            testID="avalon-veto-limit"
          />
          <Text style={styles.hint}>单轮连续否决达到上限，坏人直接获胜（官方规则为 5）。</Text>
        </View>
        <View style={styles.section}>
          <AvalonBoardPreview playerCount={config.numberOfPlayers} />
        </View>
      </GameScreenContent>
      <GameScreenFooter>
        <Button
          variant="primary"
          size="lg"
          onPress={submit}
          loading={creation.isCreating || submission.isSubmitting}
          testID="avalon-config-submit"
        >
          {params.mode === 'edit' ? '保存设置' : '创建房间'}
        </Button>
      </GameScreenFooter>
    </GameScreen>
  );
}

const voteModeStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.small,
  },
});
