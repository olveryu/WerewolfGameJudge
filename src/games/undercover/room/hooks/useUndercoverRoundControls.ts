/** Local card visibility and command orchestration; the server decides eliminations and winners. */
import {
  getUndercoverWordCard,
  type UndercoverPublicCommand,
  type UndercoverState,
  type UndercoverWordCard,
} from '@game-judge/game-engine/games/undercover/public';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import { showConfirmAlert } from '@/utils/alertPresets';

import type { UndercoverRoomSession } from '../../model/UndercoverRoomSession';
import { getUndercoverRoomCommandFailureMessage } from '../undercoverRoomCommandFailureMessage';

function requestUndercoverRestart(
  state: UndercoverState,
  submit: (label: string, command: UndercoverPublicCommand) => Promise<boolean>,
  closeCard: () => void,
  clearSelection: () => void,
) {
  if (state.phase === 'lobby') throw new Error('Restart requires an existing Undercover round');
  const roundId =
    state.phase === 'preparing' || state.phase === 'preparationFailed'
      ? state.pendingRound.roundId
      : (state.round?.roundId ?? null);
  const restart = async () => {
    closeCard();
    if (await submit('重新开始', { type: 'undercover.round.restart', roundId })) clearSelection();
  };
  if (state.phase === 'ended' || state.phase === 'aborted') void restart();
  else
    showConfirmAlert(
      '重新开始？',
      '当前未结束的对局不计胜负，保留座位和设置，重新分配词语与身份。',
      restart,
    );
}

/**
 * 卧底回合控制的显式契约（P-2b）：词卡可见性、揭晓选择与回合命令的唯一出口，
 * 由 useUndercoverRoomScreenState 的接口以 controls 字段引用。
 */
export interface UndercoverRoundControls {
  readonly isSubmitting: boolean;
  readonly controlledSeat: number | null;
  /** 当前可见词卡；不可见或无权查看时为 null。 */
  readonly card: UndercoverWordCard | null;
  readonly canViewCard: boolean;
  /** 身份查看协议：reading 阶段且本座位未在服务端确认时，词卡需要确认动作。 */
  readonly shouldConfirm: boolean;
  readonly openCard: () => void;
  readonly closeCard: () => void;
  readonly confirmCard: () => void;
  readonly markAllBotsViewed: () => void;
  readonly isSelecting: boolean;
  readonly selectedSeat: number | null;
  readonly reveal: () => void;
  readonly selectSeat: (seat: number) => void;
  readonly beginSelection: () => void;
  readonly cancelRevelation: () => void;
  readonly cancelSelection: () => void;
  readonly start: () => void;
  readonly retry: () => void;
  readonly abort: () => void;
  readonly restart: () => void;
  readonly returnToLobby: () => void;
  readonly allowRepeated: () => void;
}

export function useUndercoverRoundControls(
  state: UndercoverState,
  session: UndercoverRoomSession,
  userId: string,
  controlledSeat: number | null,
): UndercoverRoundControls {
  const submission = useRoomCommandSubmission(getUndercoverRoomCommandFailureMessage);
  const [visibleCardKey, setVisibleCardKey] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ roundId: string; seat: number | null } | null>(null);
  const isHost = state.hostUserId === userId;
  const card = getUndercoverWordCard(state, userId, controlledSeat);
  const cardKey =
    card === null ? null : `${state.round!.roundId}:${userId}:${card.seat}:${state.hostUserId}`;
  const isSelecting =
    isHost && state.phase === 'ongoing' && selection?.roundId === state.round.roundId;
  const selectedSeat =
    isSelecting && !state.round.revelations.some((entry) => entry.seat === selection.seat)
      ? selection.seat
      : null;
  const closeCard = () => setVisibleCardKey(null);
  useEffect(() => {
    setVisibleCardKey(null);
  }, [cardKey]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') setVisibleCardKey(null);
    });
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') setVisibleCardKey(null);
    };
    if (typeof document !== 'undefined')
      document.addEventListener('visibilitychange', onVisibility);
    return () => {
      subscription.remove();
      if (typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  const submit = (label: string, command: UndercoverPublicCommand, control: number | null = null) =>
    submission.submit(label, () => session.dispatch(command, { controlledSeat: control, label }));
  const roundId =
    state.phase === 'preparing' || state.phase === 'preparationFailed'
      ? state.pendingRound.roundId
      : state.round?.roundId;
  const returnToLobby = () => {
    closeCard();
    void submit('返回大厅', { type: 'undercover.game.returnToLobby' });
  };
  const abort = () => {
    if (roundId === undefined) throw new Error('Abort requires an active Undercover round');
    showConfirmAlert('中止本局？', '本局不计胜负，不公开未揭晓身份和词语。', async () => {
      closeCard();
      await submit('中止本局', { type: 'undercover.round.abort', roundId });
    });
  };
  const confirmCard = () => {
    if (state.phase !== 'reading' || card === null)
      throw new Error('Card confirmation requires a reading participant');
    closeCard();
    void submit(
      '确认词卡',
      { type: 'undercover.round.confirm', roundId: state.round.roundId },
      controlledSeat,
    );
  };
  const reveal = () => {
    if (state.phase !== 'ongoing' || selectedSeat === null)
      throw new Error('Reveal requires a selected live seat');
    void submit('揭晓并出局', {
      type: 'undercover.round.reveal',
      roundId: state.round.roundId,
      seat: selectedSeat,
    }).then((success) => {
      if (success) setSelection(null);
    });
  };
  const allowRepeated = () =>
    showConfirmAlert(
      '仅下一局允许重复词对？',
      '当前分类没有未使用词对。本次授权不会改变之后各局的去重设置。',
      async () => {
        if (await submit('返回大厅', { type: 'undercover.game.returnToLobby' }))
          await submit('开始本局', { type: 'undercover.round.start', shouldAllowRepeated: true });
      },
    );
  return {
    isSubmitting: submission.isSubmitting,
    controlledSeat,
    card: visibleCardKey !== null && visibleCardKey === cardKey ? card : null,
    canViewCard: card !== null,
    shouldConfirm:
      card !== null && state.phase === 'reading' && !state.round.confirmedSeats.includes(card.seat),
    openCard: () => {
      if (cardKey === null) throw new Error('No permitted Undercover word card');
      setVisibleCardKey(cardKey);
    },
    closeCard,
    confirmCard,
    markAllBotsViewed: () => {
      if (state.phase !== 'reading') throw new Error('Bot confirmation requires reading phase');
      void submit('标记机器人已查看', {
        type: 'undercover.round.markAllBotsViewed',
        roundId: state.round.roundId,
      });
    },
    isSelecting,
    selectedSeat,
    reveal,
    selectSeat: (seat: number) => {
      if (
        submission.isSubmitting ||
        !isSelecting ||
        state.phase !== 'ongoing' ||
        state.round.revelations.some((entry) => entry.seat === seat)
      )
        return;
      setSelection({ roundId: state.round.roundId, seat });
    },
    beginSelection: () => {
      if (state.phase !== 'ongoing' || !isHost)
        throw new Error('Only the host can select an elimination');
      closeCard();
      setSelection({ roundId: state.round.roundId, seat: null });
    },
    cancelRevelation: () => {
      if (!submission.isSubmitting && isSelecting)
        setSelection({ roundId: state.round.roundId, seat: null });
    },
    cancelSelection: () => setSelection(null),
    start: () => {
      void submit('开始本局', { type: 'undercover.round.start', shouldAllowRepeated: false });
    },
    retry: () => {
      if (roundId === undefined) throw new Error('Retry requires a pending round');
      void submit('重新准备', { type: 'undercover.round.retry', roundId });
    },
    abort,
    restart: () => requestUndercoverRestart(state, submit, closeCard, () => setSelection(null)),
    returnToLobby,
    allowRepeated,
  };
}
