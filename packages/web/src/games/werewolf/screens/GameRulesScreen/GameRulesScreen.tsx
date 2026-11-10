/**
 * GameRulesScreen — final Werewolf config step: house rules + create/save.
 *
 * Renders WEREWOLF_RULES_SCHEMA through the shared GameConfigForm. Fields the schema marks as
 * remembered persist as soon as they are toggled; plague mode never is. Every edit is reported
 * to the flow, so going back to ConfigScreen keeps the edited rules.
 */
import '@/components/GameSettings.css';
import '@/features/room/config/GameConfigPage.css';

import {
  type GameRuleOverrides,
  WEREWOLF_RULES_SCHEMA,
  type WerewolfRules,
} from '@game-judge/game-engine/games/werewolf/public';
import type { ConfigFieldValue } from '@game-judge/game-engine/platform/config/configSchema';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { GameConfigForm } from '@/features/room/config/GameConfigForm';
import { setRememberedGameConfigField } from '@/features/settings/rememberedGameConfigs';
import { isExpectedStorageError } from '@/features/settings/services/userSettingsStorage';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import type { WerewolfRulesParams } from '@/games/werewolf/navigation/types';
import { TESTIDS } from '@/testids';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

import { useGameRulesSubmission } from './useGameRulesSubmission';

/** Resolves overrides to the explicit shape the form edits; absent keys display as off. */
function toWerewolfRules(overrides: GameRuleOverrides): WerewolfRules {
  return {
    isSheriffElectionEnabled: overrides.isSheriffElectionEnabled ?? false,
    witchCanSelfHeal: overrides.witchCanSelfHeal ?? false,
    isPlagueMode: overrides.isPlagueMode ?? false,
  };
}

function rejectCountField(key: keyof WerewolfRules): never {
  throw new Error(`[FAIL-FAST] Werewolf rule ${key} is not a count field`);
}

interface GameRulesScreenProps {
  readonly session: WerewolfRoomSession;
  readonly params: WerewolfRulesParams;
  /** Receives every rules edit so the flow hands them back to ConfigScreen. */
  readonly onRulesChange: (rules: GameRuleOverrides) => void;
}

export function GameRulesScreen({ session, params, onRulesChange }: GameRulesScreenProps) {
  const [rules, setRules] = useState<GameRuleOverrides>(params.rules);
  const { submit, isSubmitting, isEditMode } = useGameRulesSubmission({
    session,
    roles: params.roles,
    rules,
    existingRoomCode: params.existingRoomCode,
  });

  const updateRules = (next: GameRuleOverrides) => {
    setRules(next);
    onRulesChange(next);
  };

  const applyRule = (key: keyof WerewolfRules, value: ConfigFieldValue) => {
    if (typeof value !== 'boolean') {
      throw new Error(`[FAIL-FAST] Werewolf rule ${key} received a non-boolean value`);
    }
    updateRules({ ...rules, [key]: value });
    const spec = WEREWOLF_RULES_SCHEMA.fields[key];
    if (spec.kind === 'fixed' || spec.isRemembered !== true) return;
    try {
      setRememberedGameConfigField('werewolf', key, value);
    } catch (error) {
      updateRules({ ...rules, [key]: !value });
      handleError(error, {
        label: '保存规则偏好',
        logger: configLog,
        alertMessage: '偏好未保存，请检查浏览器存储权限后重试',
        isExpected: isExpectedStorageError,
      });
    }
  };

  return (
    <div className="game-config-page" data-testid={TESTIDS.gameRulesScreenRoot}>
      <ScreenHeader title="游戏规则" />
      <main className="game-config-body">
        <GameConfigForm
          gameType="werewolf"
          schema={WEREWOLF_RULES_SCHEMA}
          config={toWerewolfRules(rules)}
          countDrafts={{}}
          issue={null}
          fieldRenderers={undefined}
          onFieldChange={applyRule}
          onCountDraftChange={rejectCountField}
          onStepCount={rejectCountField}
        />
      </main>
      <footer className="game-config-footer">
        <p className="game-settings-summary">板子 {params.roles.length} 人</p>
        <Button
          size="lg"
          className="game-config-submit"
          onClick={submit}
          loading={isSubmitting}
          data-testid={TESTIDS.gameRulesSubmitButton}
        >
          {isEditMode ? '保存配置' : '创建房间'}
        </Button>
      </footer>
    </div>
  );
}
