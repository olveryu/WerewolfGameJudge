/**
 * useRoomHostDialogs - Hook for Host dialog callbacks in WerewolfRoomScreen
 *
 * Centralizes all Host-related dialog logic and alert text.
 * WerewolfRoomScreen only needs to call these returned functions.
 */
import {
  GameStatus,
  type WerewolfMvpSelection,
} from '@game-judge/game-engine/games/werewolf/public';
import { getMvpGoldenDraws } from '@game-judge/game-engine/product/rewards';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';

import { isSuccessfulRoomCommand } from '@/features/room/session/roomCommandResult';
import type { WerewolfCommandDispatchOutcome } from '@/games/werewolf/runtime/WerewolfGameClient';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';
import type { RootStackParamList } from '@/navigation/types';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import type { HookAlertState } from './hookAlert';

interface UseRoomHostDialogsParams {
  gameState: LocalGameState;
  assignRoles: () => Promise<void>;
  startGame: () => Promise<void>;
  restartGame: () => Promise<void>;
  selectMvp: (selection: WerewolfMvpSelection) => Promise<WerewolfCommandDispatchOutcome>;
  /** Share night review report. Returns true on success, false on failure. */
  shareNightReviewReport: () => Promise<boolean>;

  setIsStartingGame: React.Dispatch<React.SetStateAction<boolean>>;

  navigation: NativeStackNavigationProp<RootStackParamList, 'Room'>;
  roomCode: string;
}

interface UseRoomHostDialogsResult {
  mvpSelection: {
    participants: readonly {
      userId: string;
      seat: number;
      displayName: string;
      hasLeft: boolean;
    }[];
    goldenDraws: number;
    roleRevealRandomNonce: string | null;
    onSelect: (userId: string) => Promise<void>;
  } | null;
  showMvpSelection: () => void;
  closeMvpSelection: () => void;
  showPrepareToFlipDialog: () => void;
  showStartGameDialog: () => void;
  showRestartDialog: () => void;
  handleSettingsPress: () => void;
  /** True while any host action (assign/start/restart) is in-flight. */
  isHostActionSubmitting: boolean;
  /** Alert state rendered by the screen via <AlertModal> (hooks cannot render JSX). */
  alert: HookAlertState | null;
  clearAlert: () => void;
}

/** Host action dialog hook (assign / start / restart). */
export const useRoomHostDialogs = ({
  gameState,
  assignRoles,
  startGame,
  restartGame,
  selectMvp,
  shareNightReviewReport,
  setIsStartingGame,
  navigation,
  roomCode,
}: UseRoomHostDialogsParams): UseRoomHostDialogsResult => {
  const submittingRef = useRef(false);
  const [isHostActionSubmitting, setIsHostActionSubmitting] = useState(false);
  const [mvpSelection, setMvpSelection] = useState<UseRoomHostDialogsResult['mvpSelection']>(null);
  /** Alert state rendered by the screen via <AlertModal> (hooks cannot render JSX). */
  const [alert, setAlert] = useState<HookAlertState | null>(null);
  const clearAlert = useCallback(() => setAlert(null), []);
  const closeMvpSelection = useCallback(() => {
    if (!submittingRef.current) setMvpSelection(null);
  }, []);

  /** Mark submission start (ref + state). */
  const markSubmitting = useCallback((v: boolean) => {
    submittingRef.current = v;
    setIsHostActionSubmitting(v);
  }, []);

  const showPrepareToFlipDialog = useCallback(() => {
    let seatedCount = 0;
    gameState.players.forEach((player) => {
      if (player !== null) seatedCount++;
    });
    const totalSeats = gameState.template.numberOfPlayers;

    if (seatedCount !== totalSeats) {
      roomScreenLog.warn('Cannot prepare to flip — seats not full', {
        seatedCount,
        totalSeats,
      });
      setAlert({
        title: '无法开始游戏',
        message: '还有空位未入座',
        buttons: [{ text: '知道了', style: 'default', onPress: () => setAlert(null) }],
      });
      return;
    }

    setAlert({
      title: '分配角色？',
      message: '所有座位已满，将洗牌并分配角色',
      buttons: [
        { text: '取消', style: 'cancel', onPress: () => setAlert(null) },
        {
          text: '确定',
          style: 'default',
          // Return promise so AlertModal shows loading; on rejection it recovers for retry
          onPress: async () => {
            if (submittingRef.current) return;
            markSubmitting(true);
            roomScreenLog.debug('Assigning roles');
            try {
              await assignRoles();
            } catch (err) {
              handleError(err, {
                label: '分配角色',
                logger: roomScreenLog,
                feedback: 'toast',
              });
              throw err;
            } finally {
              markSubmitting(false);
            }
          },
        },
      ],
    });
  }, [gameState, assignRoles, markSubmitting]);

  const handleStartGame = useCallback(async () => {
    if (submittingRef.current) return;
    markSubmitting(true);
    roomScreenLog.debug('Starting game');
    try {
      setIsStartingGame(true);
      await startGame();
    } catch (err) {
      handleError(err, {
        label: '开始游戏',
        logger: roomScreenLog,
        feedback: 'toast',
      });
      throw err;
    } finally {
      markSubmitting(false);
      setIsStartingGame(false);
    }
  }, [markSubmitting, setIsStartingGame, startGame]);

  const showStartGameDialog = useCallback(() => {
    setAlert({
      title: '开始游戏？',
      message: '请将手机音量调到最大',
      buttons: [
        { text: '取消', style: 'cancel', onPress: () => setAlert(null) },
        {
          text: '确定',
          style: 'default',
          onPress: () => handleStartGame(),
        },
      ],
    });
  }, [handleStartGame]);

  const handleRestart = useCallback(async () => {
    if (submittingRef.current) return;
    markSubmitting(true);
    roomScreenLog.debug('Restarting game');
    try {
      await restartGame();
    } catch (err) {
      handleError(err, {
        label: '重新开始',
        logger: roomScreenLog,
        feedback: 'toast',
      });
      throw err;
    } finally {
      markSubmitting(false);
    }
  }, [restartGame, markSubmitting]);

  const showRestartDialog = useCallback(() => {
    if (gameState.status !== GameStatus.Ended) {
      // Game not ended — no complete report to share, plain restart
      setAlert({
        title: '重新开始游戏？',
        message: '使用相同配置开始新一局',
        buttons: [
          { text: '取消', style: 'cancel', onPress: () => setAlert(null) },
          {
            text: '确定',
            style: 'default',
            onPress: () => handleRestart(),
          },
        ],
      });
      return;
    }

    setAlert({
      title: '重新开始游戏？',
      message: '重新开始后本局复盘将无法查看，是否先分享战报？',
      buttons: [
        { text: '取消', style: 'cancel', onPress: () => setAlert(null) },
        {
          text: '分享战报',
          style: 'default',
          onPress: () => {
            void shareNightReviewReport();
          },
        },
        {
          text: '重新开始',
          style: 'default',
          onPress: () => handleRestart(),
        },
      ],
    });
  }, [gameState.status, shareNightReviewReport, handleRestart]);

  const showMvpSelection = useCallback(() => {
    if (submittingRef.current) return;
    if (gameState.status !== GameStatus.Ended || gameState.mvpUserId !== undefined) return;
    const participants = gameState.startingParticipants;
    if (participants === undefined) {
      setAlert({
        title: '无法评选 MVP',
        message: '本局缺少开局真人名单',
        buttons: [{ text: '知道了', style: 'default', onPress: () => setAlert(null) }],
      });
      return;
    }
    const roleRevealRandomNonce = gameState.roleRevealRandomNonce ?? null;
    setMvpSelection({
      participants: participants.map((participant) => {
        const player = gameState.players.get(participant.seat);
        const hasLeft = player?.userId !== participant.userId;
        return {
          ...participant,
          displayName: hasLeft ? '' : (player.displayName ?? ''),
          hasLeft,
        };
      }),
      goldenDraws: getMvpGoldenDraws(participants.length),
      roleRevealRandomNonce,
      onSelect: async (mvpUserId) => {
        if (submittingRef.current) return;
        markSubmitting(true);
        try {
          const result = await selectMvp({ roleRevealRandomNonce, mvpUserId });
          if (isSuccessfulRoomCommand(result)) setMvpSelection(null);
        } catch (err) {
          handleError(err, { label: '评选 MVP', logger: roomScreenLog, feedback: 'toast' });
        } finally {
          markSubmitting(false);
        }
      },
    });
  }, [gameState, markSubmitting, selectMvp]);

  const handleSettingsPress = useCallback(() => {
    navigation.navigate('GameConfig', {
      gameType: 'werewolf',
      mode: 'edit',
      roomCode,
    });
  }, [navigation, roomCode]);

  return {
    mvpSelection:
      gameState.status === GameStatus.Ended &&
      gameState.mvpUserId === undefined &&
      mvpSelection?.roleRevealRandomNonce === (gameState.roleRevealRandomNonce ?? null)
        ? mvpSelection
        : null,
    showMvpSelection,
    closeMvpSelection,
    showPrepareToFlipDialog,
    showStartGameDialog,
    showRestartDialog,
    handleSettingsPress,
    isHostActionSubmitting,
    alert,
    clearAlert,
  };
};
