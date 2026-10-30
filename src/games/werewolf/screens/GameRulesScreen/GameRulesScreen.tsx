/**
 * GameRulesScreen — final Werewolf config step: house rules + create/save.
 *
 * Receives validated roles and current rule overrides via route params and renders
 * WEREWOLF_RULES_SCHEMA through the shared GameConfigForm. Fields the schema marks as
 * remembered persist as soon as they are toggled; plague mode never is. Only keys the
 * user has set travel as overrides so absent keys keep the engine defaults. Back returns
 * the edited overrides to ConfigScreen so re-entering keeps them.
 */
import {
  type GameRuleOverrides,
  WEREWOLF_RULES_SCHEMA,
  type WerewolfRules,
} from '@game-judge/game-engine/games/werewolf/public';
import type { ConfigFieldValue } from '@game-judge/game-engine/platform/config/configSchema';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { type FC, useCallback, useState } from 'react';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { GameScreen, GameScreenContent, GameScreenFooter } from '@/components/GameScreen';
import { gameSettingsStyles as styles } from '@/components/GameSettings.styles';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useServices } from '@/contexts/ServiceContext';
import { GameConfigForm } from '@/features/room/config/GameConfigForm';
import { isExpectedStorageError } from '@/features/settings/services/SettingsService';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import type { WerewolfConfigStackParamList } from '@/games/werewolf/navigation/types';
import { TESTIDS } from '@/testids';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

import { useGameRulesSubmission } from './useGameRulesSubmission';

type NavigationProp = NativeStackNavigationProp<WerewolfConfigStackParamList, 'Rules'>;
type ScreenRouteProp = RouteProp<WerewolfConfigStackParamList, 'Rules'>;

/** Resolves overrides to the explicit shape the form edits; absent keys display as off. */
function toWerewolfRules(overrides: GameRuleOverrides): WerewolfRules {
  return {
    isSheriffElectionEnabled: overrides.isSheriffElectionEnabled ?? false,
    witchCanSelfHeal: overrides.witchCanSelfHeal ?? false,
    isPlagueMode: overrides.isPlagueMode ?? false,
  };
}

interface GameRulesScreenProps {
  readonly session: WerewolfRoomSession;
  readonly onExitFlow: () => void;
  readonly onRoomCreated: (roomCode: string) => void;
}

export const GameRulesScreen: FC<GameRulesScreenProps> = ({
  session,
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
    session,
    roles,
    existingRoomCode,
    onExitFlow,
    onRoomCreated,
  });

  const handleGoBack = useCallback(() => {
    navigation.popTo('Config', { updatedRules: rules }, { merge: true });
  }, [navigation, rules]);

  const applyRule = useCallback(
    (key: keyof WerewolfRules, value: ConfigFieldValue) => {
      if (typeof value !== 'boolean') {
        throw new Error(`[FAIL-FAST] Werewolf rule ${key} received a non-boolean value`);
      }
      setRules((prev) => ({ ...prev, [key]: value }));
      const spec = WEREWOLF_RULES_SCHEMA.fields[key];
      if (spec.kind === 'fixed' || spec.isRemembered !== true) return;
      settingsService
        .setRememberedGameConfigField('werewolf', key, value)
        .catch((error: unknown) => {
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

  return (
    <GameScreen
      testID={TESTIDS.gameRulesScreenRoot}
      header={<ScreenHeader title="游戏规则" onBack={handleGoBack} topInset={insets.top} />}
    >
      <GameScreenContent contentContainerStyle={styles.content}>
        <GameConfigForm
          gameType="werewolf"
          schema={WEREWOLF_RULES_SCHEMA}
          config={toWerewolfRules(rules)}
          countDrafts={{}}
          issue={null}
          onFieldChange={applyRule}
        />
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
