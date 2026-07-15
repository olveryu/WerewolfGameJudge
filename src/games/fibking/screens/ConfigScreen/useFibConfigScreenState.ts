/** FibKing config form and create/edit command orchestration. */

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FIB_DEFAULT_PLAYERS, FIB_MIN_PLAYERS } from '@werewolf/game-engine/games/fibking/public';
import { useCallback, useRef, useState } from 'react';

import { useAuthContext } from '@/contexts/AuthContext';
import { useRoomOperationSubmission } from '@/features/room/controllers/useRoomOperationSubmission';
import {
  replaceWithCreatedRoom,
  returnToActiveRoom,
} from '@/features/room/navigation/roomFlowNavigation';
import { dispatchRoomOperation } from '@/features/room/session/roomOperationCommandClient';
import type { FibRoomSession } from '@/games/fibking/model/FibRoomSession';
import type { FibConfigRouteParams } from '@/games/fibking/navigation/types';
import { useCreateRoomSaga } from '@/hooks/mutations/useRoomMutations';
import type { RootStackParamList } from '@/navigation/types';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

import { getFibRoomOperationFailureMessage } from '../../room/fibRoomOperationFailureMessage';
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
  const { createRoom } = useCreateRoomSaga();
  const { isSubmitting: isOperationSubmitting, submit: submitOperation } =
    useRoomOperationSubmission(getFibRoomOperationFailureMessage);
  const createSubmissionRef = useRef<Promise<void> | null>(null);
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
  const [isCreating, setIsCreating] = useState(false);

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
    if (count === Number.MAX_SAFE_INTEGER) {
      showErrorAlert('人数设置有误', '人数超出当前设备可精确表示的范围');
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
      void submitOperation('更新房间设置', () =>
        dispatchRoomOperation(
          session,
          { type: 'fib.config.update', numberOfPlayers },
          'updateFibConfig',
        ),
      ).then((success) => {
        if (success) returnFromEdit();
      });
      return;
    }

    if (createSubmissionRef.current !== null) {
      throw new Error('[FAIL-FAST] FibKing room creation is already in progress');
    }
    if (user === null) {
      throw new Error('[FAIL-FAST] FibKing room creation requires an authenticated user');
    }

    const creation = (async (): Promise<void> => {
      setIsCreating(true);
      try {
        const record = await createRoom({
          expectedHostUserId: user.id,
          gameType: 'fibking',
          config: { numberOfPlayers },
        });
        replaceWithCreatedRoom(navigation, record.roomCode);
      } catch (error) {
        handleError(error, {
          label: '创建瞎掰王房间',
          logger: configLog,
          alertMessage: '创建房间失败，请重试',
        });
      } finally {
        createSubmissionRef.current = null;
        setIsCreating(false);
      }
    })();
    createSubmissionRef.current = creation;
  }, [
    createRoom,
    getPlayerCount,
    navigation,
    params.mode,
    returnFromEdit,
    session,
    submitOperation,
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
    isSubmitting: isCreating || isOperationSubmitting,
    isEditMode: params.mode === 'edit',
    canDecrement: parsedCount.kind === 'valid' && parsedCount.value > FIB_MIN_PLAYERS,
    onPlayerCountChange: setPlayerCountText,
    decrement,
    increment,
    submit,
    goBack,
  };
}
