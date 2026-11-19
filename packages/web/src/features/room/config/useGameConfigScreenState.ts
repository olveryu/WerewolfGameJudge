/**
 * State and orchestration for the schema-driven config screen.
 *
 * Owns the typed config, count drafts, inline issue, reset and submission for
 * one game. Create mode starts from the schema defaults; edit mode reads the
 * config out of the active lobby snapshot and fails fast when the session is
 * not the requested room or the lobby is no longer editable. Submission goes
 * through the shared create/edit controller.
 */

import type {
  AnyConfigFieldSpec,
  ConfigFieldValue,
} from '@game-judge/game-engine/platform/config/configSchema';
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { useAuthContext } from '@/contexts/AuthContext';
import type { StandardConfigRouteParams } from '@/features/navigation/model/standardRouteParsers';
import { useRoomConfigSubmission } from '@/features/room/controllers/useRoomConfigSubmission';
import { useRoomLinkSnapshot } from '@/features/room/controllers/useRoomLinkSnapshot';
import {
  getRememberedGameConfig,
  setRememberedGameConfigField,
} from '@/features/settings/rememberedGameConfigs';
import { isExpectedStorageError } from '@/features/settings/services/userSettingsStorage';
import type { RoomLink } from '@/platform/realtime/types';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

import {
  type CountDrafts,
  dropCountDraft,
  parseCountDraft,
  readFieldValue,
  resolveConfigIssue,
  toConfigRecord,
  withFieldValue,
} from './gameConfigFormModel';
import type { GameConfigScreenDefinition } from './GameConfigScreenDefinition';

interface UseGameConfigScreenStateParams<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
  TConfig extends object,
> {
  readonly gameType: TGameType;
  readonly definition: GameConfigScreenDefinition<TGameType, TState, TCommand, TConfig>;
  readonly session: RoomLink<TState, TCommand>;
  readonly params: StandardConfigRouteParams<TGameType>;
  readonly onEditSaved?: () => void;
}

function readInitialConfig<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
  TConfig extends object,
>(
  gameType: TGameType,
  definition: GameConfigScreenDefinition<TGameType, TState, TCommand, TConfig>,
  session: RoomLink<TState, TCommand>,
  params: StandardConfigRouteParams<TGameType>,
): TConfig {
  if (params.mode === 'create') {
    return {
      ...definition.schema.defaults,
      ...getRememberedGameConfig(gameType, definition.schema),
    };
  }
  const snapshot = session.getSnapshot();
  if (snapshot.phase !== 'ready' || snapshot.identity.room.roomCode !== params.roomCode) {
    throw new Error(`[FAIL-FAST] ${gameType} config edit requires its active room session`);
  }
  const config = definition.readConfig(snapshot.room.state);
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
  onEditSaved,
}: UseGameConfigScreenStateParams<TGameType, TState, TCommand, TConfig>) {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const { schema } = definition;
  const [config, setConfig] = useState<TConfig>(() =>
    readInitialConfig(gameType, definition, session, params),
  );
  const [initialConfig] = useState(config);
  const roomSnapshot = useRoomLinkSnapshot(session);
  const canEditSnapshot = useCallback(
    (snapshot: typeof roomSnapshot) =>
      params.mode !== 'edit' ||
      (snapshot.phase === 'ready' &&
        snapshot.identity.room.roomCode === params.roomCode &&
        user !== null &&
        snapshot.room.state.hostUserId === user.id &&
        definition.readConfig(snapshot.room.state) !== null),
    [definition, params, user],
  );
  const isEditAvailable = canEditSnapshot(roomSnapshot);
  const [countDrafts, setCountDrafts] = useState<CountDrafts>({});
  const gate = definition.useSubmitGate?.(config);

  const issue = useMemo(
    () => resolveConfigIssue(schema, config, countDrafts),
    [schema, config, countDrafts],
  );

  const setFieldValue = useCallback(
    (key: keyof TConfig, value: ConfigFieldValue) => {
      setConfig((current) => withFieldValue(current, key, value));
      setCountDrafts((current) => dropCountDraft(current, String(key)));
      const spec: AnyConfigFieldSpec = schema.fields[key];
      if (spec.kind === 'fixed' || spec.isRemembered !== true) return;
      try {
        setRememberedGameConfigField(gameType, String(key), value);
      } catch (error) {
        handleError(error, {
          label: '保存设置偏好',
          logger: configLog,
          alertMessage: '偏好未保存，请检查浏览器存储权限后重试',
          isExpected: isExpectedStorageError,
        });
      }
    },
    [gameType, schema],
  );

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
    navigate,
    getFailureMessage: definition.getFailureMessage,
    creationLabel: definition.creationLabel,
    ...(onEditSaved === undefined ? {} : { onEditSaved }),
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
        durable: false,
      }),
  });

  const submit = useCallback(() => {
    if (!canEditSnapshot(session.getSnapshot())) {
      showErrorAlert('无法保存设置', '房间状态或权限已变化，请返回房间查看。');
      return;
    }
    if (issue !== null) {
      showErrorAlert('设置有误', issue.message);
      return;
    }
    if (gate !== undefined && !gate.isReady) {
      showErrorAlert(gate.blockedTitle, gate.blockedMessage);
      return;
    }
    submission.submit();
  }, [canEditSnapshot, gate, issue, session, submission]);

  return {
    config,
    countDrafts,
    issue,
    isEditMode: params.mode === 'edit',
    isSubmitting: submission.isSubmitting,
    canSubmit: isEditAvailable && issue === null && (gate === undefined || gate.isReady),
    isEditAvailable,
    isDirty:
      JSON.stringify(config) !== JSON.stringify(initialConfig) ||
      Object.keys(countDrafts).length > 0,
    setFieldValue,
    setCountDraft,
    stepCount,
    reset,
    submit,
  };
}
