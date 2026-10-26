/**
 * GameRulesScreen — final Werewolf config step: house rules + create/save.
 *
 * Receives validated roles and current rules via route params. Sheriff election and witch
 * self-heal are remembered locally as soon as they are toggled; plague mode never is.
 * Back returns the edited rules to ConfigScreen so re-entering keeps them.
 */
import type { GameRuleOverrides } from '@game-judge/game-engine/games/werewolf/public';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { type FC, useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { GameScreen, GameScreenContent, GameScreenFooter } from '@/components/GameScreen';
import { GameSettingsSwitch } from '@/components/GameSettings';
import { gameSettingsStyles as styles } from '@/components/GameSettings.styles';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useServices } from '@/contexts/ServiceContext';
import {
  isExpectedStorageError,
  isRememberedWerewolfRuleKey,
} from '@/features/settings/services/SettingsService';
import type { WerewolfConfigStackParamList } from '@/games/werewolf/navigation/types';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';
import { showConfirmAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

import { useGameRulesSubmission } from './useGameRulesSubmission';

type NavigationProp = NativeStackNavigationProp<WerewolfConfigStackParamList, 'Rules'>;
type ScreenRouteProp = RouteProp<WerewolfConfigStackParamList, 'Rules'>;

interface RuleItemConfig {
  readonly key: keyof GameRuleOverrides;
  readonly label: string;
  readonly hint: string;
  readonly accentColor?: string;
  /** If set, enabling requires confirmation first. */
  readonly confirmOnEnable?: {
    readonly title: string;
    readonly message: string;
    readonly confirmText: string;
  };
}

const RULES: readonly RuleItemConfig[] = [
  {
    key: 'isSheriffElectionEnabled',
    label: '首日警长竞选',
    hint: '首夜结束后先进行警长竞选，再公布夜间结果。',
  },
  {
    key: 'witchCanSelfHeal',
    label: '女巫可自救',
    hint: '允许女巫对自己使用解药（默认规则：女巫不能自救）。',
  },
  {
    key: 'isPlagueMode',
    label: '黑死病模式',
    hint: '所有狼人牌暗中替换为平民，玩家看到的板子仍显示有狼。此项每局单独选择，不会记住。',
    accentColor: colors.warning,
    confirmOnEnable: {
      title: '💀 黑死病模式',
      message:
        '• 发牌时，所有狼人牌将暗中替换为平民\n• 玩家看到的板子配置仍显示有狼\n• 发牌后请由房主担任真人法官主持后续流程\n• 建议提前线下安排好"演员"',
      confirmText: '确认开启',
    },
  },
];

interface GameRulesScreenProps {
  readonly client: WerewolfGameClient;
  readonly onExitFlow: () => void;
  readonly onRoomCreated: (roomCode: string) => void;
}

export const GameRulesScreen: FC<GameRulesScreenProps> = ({
  client,
  onExitFlow,
  onRoomCreated,
}) => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const { settingsService } = useServices();
  const { roles, existingRoomCode } = route.params;

  const [rules, setRules] = useState<GameRuleOverrides>(route.params.rules);

  const { submit, isSubmitting, isEditMode } = useGameRulesSubmission({
    client,
    roles,
    existingRoomCode,
    onExitFlow,
    onRoomCreated,
  });

  const handleGoBack = useCallback(() => {
    navigation.popTo('Config', { updatedRules: rules }, { merge: true });
  }, [navigation, rules]);

  const applyRule = useCallback(
    (key: keyof GameRuleOverrides, value: boolean) => {
      setRules((prev) => ({ ...prev, [key]: value }));
      if (!isRememberedWerewolfRuleKey(key)) return;
      settingsService.setRememberedWerewolfRule(key, value).catch((error: unknown) => {
        setRules((prev) => ({ ...prev, [key]: !value }));
        handleError(error, {
          label: '保存规则偏好',
          logger: configLog,
          alertMessage: '偏好未保存，请检查浏览器存储权限后重试',
          isExpected: isExpectedStorageError,
        });
      });
    },
    [settingsService],
  );

  const handleToggle = useCallback(
    (item: RuleItemConfig, value: boolean) => {
      if (value && item.confirmOnEnable) {
        showConfirmAlert(
          item.confirmOnEnable.title,
          item.confirmOnEnable.message,
          () => applyRule(item.key, true),
          { confirmText: item.confirmOnEnable.confirmText },
        );
        return;
      }
      applyRule(item.key, value);
    },
    [applyRule],
  );

  return (
    <GameScreen
      testID={TESTIDS.gameRulesScreenRoot}
      header={<ScreenHeader title="游戏规则" onBack={handleGoBack} topInset={insets.top} />}
    >
      <GameScreenContent contentContainerStyle={styles.content}>
        {RULES.map((item) => (
          <View key={item.key} style={styles.section}>
            <GameSettingsSwitch
              label={item.label}
              value={rules[item.key] === true}
              onValueChange={(value) => handleToggle(item, value)}
              accentColor={item.accentColor}
              testID={TESTIDS.gameRuleSwitch(item.key)}
            />
            <Text style={styles.hint}>{item.hint}</Text>
          </View>
        ))}
      </GameScreenContent>
      <GameScreenFooter>
        <Text style={styles.summary}>板子 {roles.length} 人</Text>
        <Button
          variant="primary"
          size="lg"
          onPress={() => {
            void submit(rules);
          }}
          loading={isSubmitting}
          testID={TESTIDS.gameRulesSubmitButton}
        >
          {isEditMode ? '保存配置' : '创建房间'}
        </Button>
      </GameScreenFooter>
    </GameScreen>
  );
};
