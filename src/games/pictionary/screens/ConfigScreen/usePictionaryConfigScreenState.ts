/** Pictionary config form and create/edit command orchestration. */

import {
  DEFAULT_PICTIONARY_CONFIG,
  PICTIONARY_MAX_PLAYERS,
  PICTIONARY_MIN_PLAYERS,
  type PictionaryConfig,
} from '@game-judge/game-engine/games/pictionary/public';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';

import { useAuthContext } from '@/contexts/AuthContext';
import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import { useRoomCreationController } from '@/features/room/controllers/useRoomCreationController';
import {
  replaceWithCreatedRoom,
  returnToActiveRoom,
} from '@/features/room/navigation/roomFlowNavigation';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import type { PictionaryConfigRouteParams } from '@/games/pictionary/navigation/types';
import { getPictionaryRoomCommandFailureMessage } from '@/games/pictionary/room/pictionaryRoomCommandFailureMessage';
import type { RootStackParamList } from '@/navigation/types';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

interface UsePictionaryConfigScreenStateParams {
  readonly params: PictionaryConfigRouteParams;
  readonly navigation: NativeStackNavigationProp<RootStackParamList, 'GameConfig'>;
  readonly session: PictionaryRoomSession;
}

export interface PictionaryConfigScreenState {
  readonly config: PictionaryConfig;
  readonly isSubmitting: boolean;
  readonly isEditMode: boolean;
  readonly decrementPlayers: () => void;
  readonly incrementPlayers: () => void;
  readonly updateConfig: <TKey extends keyof PictionaryConfig>(
    key: TKey,
    value: PictionaryConfig[TKey],
  ) => void;
  readonly submit: () => void;
  readonly goBack: () => void;
}

function readInitialConfig(
  params: PictionaryConfigRouteParams,
  session: PictionaryRoomSession,
): PictionaryConfig {
  if (params.mode === 'create') return DEFAULT_PICTIONARY_CONFIG;
  const snapshot = session.getSnapshot();
  if (snapshot.phase !== 'ready' || snapshot.identity.room.roomCode !== params.roomCode) {
    throw new Error('[FAIL-FAST] Pictionary edit config requires its active room session');
  }
  if (snapshot.snapshot.state.phase !== 'lobby') {
    throw new Error('[FAIL-FAST] Pictionary config can only be edited in the lobby');
  }
  return snapshot.snapshot.state.config;
}

export function usePictionaryConfigScreenState({
  params,
  navigation,
  session,
}: UsePictionaryConfigScreenStateParams): PictionaryConfigScreenState {
  const { user } = useAuthContext();
  const { createRoom, isCreating } = useRoomCreationController();
  const command = useRoomCommandSubmission(getPictionaryRoomCommandFailureMessage);
  const [config, setConfig] = useState(() => readInitialConfig(params, session));

  const updateConfig = useCallback(
    <TKey extends keyof PictionaryConfig>(key: TKey, value: PictionaryConfig[TKey]) => {
      setConfig((current) => ({ ...current, [key]: value }));
    },
    [],
  );
  const decrementPlayers = useCallback(() => {
    if (config.numberOfPlayers === PICTIONARY_MIN_PLAYERS) return;
    updateConfig('numberOfPlayers', config.numberOfPlayers - 1);
  }, [config.numberOfPlayers, updateConfig]);
  const incrementPlayers = useCallback(() => {
    if (config.numberOfPlayers === PICTIONARY_MAX_PLAYERS) {
      showErrorAlert('人数设置有误', `最多支持 ${PICTIONARY_MAX_PLAYERS} 人`);
      return;
    }
    updateConfig('numberOfPlayers', config.numberOfPlayers + 1);
  }, [config.numberOfPlayers, updateConfig]);

  const submit = useCallback(() => {
    if (params.mode === 'edit') {
      void command
        .submit('保存接龙设置', () =>
          session.dispatch(
            { type: 'pictionary.config.update', config },
            { controlledSeat: null, label: 'updatePictionaryConfig' },
          ),
        )
        .then((success) => {
          if (success) returnToActiveRoom(navigation, params.roomCode);
        });
      return;
    }
    if (user === null) {
      throw new Error('[FAIL-FAST] Pictionary room creation requires an authenticated user');
    }
    void createRoom({ expectedHostUserId: user.id, gameType: 'pictionary', config: { ...config } })
      .then((record) => replaceWithCreatedRoom(navigation, record.roomCode))
      .catch((error: unknown) => {
        handleError(error, {
          label: '创建你画我猜接龙房间',
          logger: configLog,
          alertMessage: '创建房间失败，请重试',
        });
      });
  }, [command, config, createRoom, navigation, params, session, user]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  }, [navigation]);

  return {
    config,
    isSubmitting: isCreating || command.isSubmitting,
    isEditMode: params.mode === 'edit',
    decrementPlayers,
    incrementPlayers,
    updateConfig,
    submit,
    goBack,
  };
}
