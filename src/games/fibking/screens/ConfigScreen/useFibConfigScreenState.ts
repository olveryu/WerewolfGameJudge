/** FibKing config form and create/edit command orchestration. */

import {
  FIB_DEFAULT_PLAYERS,
  FIB_MAX_PLAYERS,
  FIB_MIN_PLAYERS,
} from '@game-judge/game-engine/games/fibking/public';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';

import { useAuthContext } from '@/contexts/AuthContext';
import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import { useRoomCreationController } from '@/features/room/controllers/useRoomCreationController';
import {
  replaceWithCreatedRoom,
  returnToActiveRoom,
} from '@/features/room/navigation/roomFlowNavigation';
import type { FibRoomSession } from '@/games/fibking/model/FibRoomSession';
import type { FibConfigRouteParams } from '@/games/fibking/navigation/types';
import type { RootStackParamList } from '@/navigation/types';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

import { getFibRoomCommandFailureMessage } from '../../room/fibRoomCommandFailureMessage';
import { parseFibPlayerCountInput } from './fibPlayerCount';

interface UseFibConfigScreenStateParams {
  readonly params: FibConfigRouteParams;
  readonly navigation: NativeStackNavigationProp<RootStackParamList, 'GameConfig'>;
  readonly session: FibRoomSession;
}

export interface FibConfigScreenState {
  readonly playerCountText: string;
  readonly isSubmitting: boolean;
  readonly isEditMode: boolean;
  readonly canDecrement: boolean;
  readonly onPlayerCountChange: (value: string) => void;
  readonly decrement: () => void;
  readonly increment: () => void;
  readonly submit: () => void;
  readonly goBack: () => void;
}

export function useFibConfigScreenState({
  params,
  navigation,
  session,
}: UseFibConfigScreenStateParams): FibConfigScreenState {
  const { user } = useAuthContext();
  const { createRoom, isCreating } = useRoomCreationController();
  const { isSubmitting: isCommandSubmitting, submit: submitRoomCommand } = useRoomCommandSubmission(
    getFibRoomCommandFailureMessage,
  );
  const initialCount = (() => {
    if (params.mode === 'create') return FIB_DEFAULT_PLAYERS;
    const snapshot = session.getSnapshot();
    if (snapshot.phase !== 'ready') {
      throw new Error('[FAIL-FAST] FibKing edit config requires a ready room session');
    }
    if (snapshot.identity.room.roomCode !== params.roomCode) {
      throw new Error('[FAIL-FAST] FibKing edit config room does not match active session');
    }
    return snapshot.snapshot.state.numberOfPlayers;
  })();
  const [playerCountText, setPlayerCountText] = useState(String(initialCount));

  const getPlayerCount = useCallback((): number | null => {
    const result = parseFibPlayerCountInput(playerCountText);
    if (result.kind === 'valid') return result.value;
    showErrorAlert('人数设置有误', result.reason);
    return null;
  }, [playerCountText]);

  const decrement = useCallback(() => {
    const count = getPlayerCount();
    if (count === null) return;
    if (count === FIB_MIN_PLAYERS) {
      throw new Error('[FAIL-FAST] FibKing decrement was enabled at its minimum player count');
    }
    setPlayerCountText(String(count - 1));
  }, [getPlayerCount]);

  const increment = useCallback(() => {
    const count = getPlayerCount();
    if (count === null) return;
    if (count === FIB_MAX_PLAYERS) {
      showErrorAlert('人数设置有误', `最多支持 ${FIB_MAX_PLAYERS} 人`);
      return;
    }
    setPlayerCountText(String(count + 1));
  }, [getPlayerCount]);

  const returnFromEdit = useCallback(() => {
    if (params.mode !== 'edit') {
      throw new Error('[FAIL-FAST] FibKing create config cannot return to an edited room');
    }
    returnToActiveRoom(navigation, params.roomCode);
  }, [navigation, params]);

  const submit = useCallback(() => {
    const numberOfPlayers = getPlayerCount();
    if (numberOfPlayers === null) return;

    if (params.mode === 'edit') {
      void submitRoomCommand('更新房间设置', () =>
        session.dispatch(
          { type: 'fib.config.update', numberOfPlayers },
          { controlledSeat: null, label: 'updateFibConfig' },
        ),
      ).then((success) => {
        if (success) returnFromEdit();
      });
      return;
    }

    if (user === null) {
      throw new Error('[FAIL-FAST] FibKing room creation requires an authenticated user');
    }

    void createRoom({
      expectedHostUserId: user.id,
      gameType: 'fibking',
      config: { numberOfPlayers },
    })
      .then((record) => {
        replaceWithCreatedRoom(navigation, record.roomCode);
      })
      .catch((error: unknown) => {
        handleError(error, {
          label: '创建瞎掰王房间',
          logger: configLog,
          alertMessage: '创建房间失败，请重试',
        });
      });
  }, [
    createRoom,
    getPlayerCount,
    navigation,
    params.mode,
    returnFromEdit,
    session,
    submitRoomCommand,
    user,
  ]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Home');
  }, [navigation]);

  const parsedCount = parseFibPlayerCountInput(playerCountText);

  return {
    playerCountText,
    isSubmitting: isCreating || isCommandSubmitting,
    isEditMode: params.mode === 'edit',
    canDecrement: parsedCount.kind === 'valid' && parsedCount.value > FIB_MIN_PLAYERS,
    onPlayerCountChange: setPlayerCountText,
    decrement,
    increment,
    submit,
    goBack,
  };
}
