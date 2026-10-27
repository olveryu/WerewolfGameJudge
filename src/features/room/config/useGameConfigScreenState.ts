/**
 * State and orchestration for the schema-driven config screen.
 *
 * Owns the typed config, count drafts, inline issue, reset and submission for
 * one game. Create mode starts from the schema defaults; edit mode reads the
 * config out of the active lobby snapshot and fails fast when the session is
 * not the requested room or the lobby is no longer editable. Submission goes
 * through the shared create/edit controller.
 */

import type { ConfigFieldValue } from '@game-judge/game-engine/platform/config/configSchema';
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';

import { useAuthContext } from '@/contexts/AuthContext';
import type { StandardConfigRouteParams } from '@/features/navigation/model/standardRouteParsers';
import { useRoomConfigSubmission } from '@/features/room/controllers/useRoomConfigSubmission';
import type { RoomSessionClient } from '@/features/room/session/types';
import type { RootStackParamList } from '@/navigation/types';
import { showErrorAlert } from '@/utils/alertPresets';

import {
  type CountDrafts,
  parseCountDraft,
  readFieldValue,
  resolveConfigIssue,
  toConfigRecord,
  withFieldValue,
} from './gameConfigFormModel';
import type { GameConfigScreenDefinition } from './GameConfigScreenDefinition';

export type ConfigNavigation = NativeStackNavigationProp<RootStackParamList, 'GameConfig'>;

interface UseGameConfigScreenStateParams<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
  TConfig extends object,
> {
  readonly gameType: TGameType;
  readonly definition: GameConfigScreenDefinition<TGameType, TState, TCommand, TConfig>;
  readonly session: RoomSessionClient<TState, TCommand>;
  readonly params: StandardConfigRouteParams<TGameType>;
  readonly navigation: ConfigNavigation;
}

function readInitialConfig<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
  TConfig extends object,
>(
  gameType: TGameType,
  definition: GameConfigScreenDefinition<TGameType, TState, TCommand, TConfig>,
  session: RoomSessionClient<TState, TCommand>,
  params: StandardConfigRouteParams<TGameType>,
): TConfig {
  if (params.mode === 'create') return definition.schema.defaults;
  const snapshot = session.getSnapshot();
  if (snapshot.phase !== 'ready' || snapshot.identity.room.roomCode !== params.roomCode) {
    throw new Error(`[FAIL-FAST] ${gameType} config edit requires its active room session`);
  }
  const config = definition.readConfig(snapshot.snapshot.state);
  if (config === null) {
    throw new Error(`[FAIL-FAST] ${gameType} config can only be edited in the lobby`);
  }
  return config;
}

export function useGameConfigScreenState<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
  TConfig extends object,
>({
  gameType,
  definition,
  session,
  params,
  navigation,
}: UseGameConfigScreenStateParams<TGameType, TState, TCommand, TConfig>) {
  const { user } = useAuthContext();
  const { schema } = definition;
  const [config, setConfig] = useState<TConfig>(() =>
    readInitialConfig(gameType, definition, session, params),
  );
  const [countDrafts, setCountDrafts] = useState<CountDrafts>({});
  const gate = definition.useSubmitGate?.();

  const issue = useMemo(
    () => resolveConfigIssue(schema, config, countDrafts),
    [schema, config, countDrafts],
  );

  const setFieldValue = useCallback((key: keyof TConfig, value: ConfigFieldValue) => {
    setConfig((current) => withFieldValue(current, key, value));
    setCountDrafts((current) => {
      if (!(String(key) in current)) return current;
      const { [String(key)]: _dropped, ...rest } = current;
      return rest;
    });
  }, []);

  const setCountDraft = useCallback((key: keyof TConfig, text: string) => {
    setCountDrafts((current) => ({ ...current, [String(key)]: text }));
    const parsed = parseCountDraft(text);
    if (parsed !== null) setConfig((current) => withFieldValue(current, key, parsed));
  }, []);

  const stepCount = useCallback(
    (key: keyof TConfig, delta: number) => {
      const current = readFieldValue(config, key);
      if (typeof current !== 'number') {
        throw new Error(`[FAIL-FAST] ${String(key)} is not a count field`);
      }
      setFieldValue(key, current + delta);
    },
    [config, setFieldValue],
  );

  const reset = useCallback(() => {
    setConfig(readInitialConfig(gameType, definition, session, params));
    setCountDrafts({});
  }, [definition, gameType, params, session]);

  const submission = useRoomConfigSubmission({
    params,
    navigation,
    getFailureMessage: definition.getFailureMessage,
    creationLabel: definition.creationLabel,
    createRequest: () => {
      if (user === null) {
        throw new Error(`[FAIL-FAST] ${gameType} room creation requires an authenticated user`);
      }
      const buildCreateConfig = definition.buildCreateConfig;
      return {
        expectedHostUserId: user.id,
        gameType,
        config:
          buildCreateConfig === undefined ? toConfigRecord(config) : buildCreateConfig(config),
      };
    },
    updateConfig: () =>
      session.dispatch(definition.buildUpdateCommand(config), {
        controlledSeat: null,
        label: '保存设置',
      }),
  });

  const submit = useCallback(() => {
    if (issue !== null) {
      showErrorAlert('设置有误', issue.message);
      return;
    }
    if (gate !== undefined && !gate.isReady) {
      showErrorAlert(gate.blockedTitle, gate.blockedMessage);
      return;
    }
    submission.submit();
  }, [gate, issue, submission]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  }, [navigation]);

  return {
    config,
    countDrafts,
    issue,
    isEditMode: params.mode === 'edit',
    isSubmitting: submission.isSubmitting,
    canSubmit: issue === null && (gate === undefined || gate.isReady),
    setFieldValue,
    setCountDraft,
    stepCount,
    reset,
    submit,
    goBack,
  };
}
