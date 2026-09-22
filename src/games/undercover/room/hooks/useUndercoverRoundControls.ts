/** Local card visibility and command orchestration; the server decides eliminations and winners. */
import {
  getUndercoverWordCard,
  type UndercoverPublicCommand,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import { showConfirmAlert } from '@/utils/alertPresets';

import type { UndercoverRoomSession } from '../../model/UndercoverRoomSession';
import { getUndercoverRoomCommandFailureMessage } from '../undercoverRoomCommandFailureMessage';

export function useUndercoverRoundControls(
  state: UndercoverState,
  session: UndercoverRoomSession,
  userId: string,
  controlledSeat: number | null,
) {
  const submission = useRoomCommandSubmission(getUndercoverRoomCommandFailureMessage);
  const [visibleCardKey, setVisibleCardKey] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ roundId: string; seat: number | null } | null>(null);
  const isHost = state.hostUserId === userId;
  const card = getUndercoverWordCard(state, userId, controlledSeat);
  const cardKey =
    card === null ? null : `${state.round!.roundId}:${userId}:${card.seat}:${state.hostUserId}`;
  const isSelecting =
    isHost && state.phase === 'ongoing' && selection?.roundId === state.round.roundId;
  const selectedSeat = isSelecting ? selection.seat : null;
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
    showConfirmAlert(
      `揭晓 ${selectedSeat + 1} 号并出局？`,
      '此操作不可撤销，揭晓后该玩家立即出局。',
      async () => {
        if (
          await submit('揭晓并出局', {
            type: 'undercover.round.reveal',
            roundId: state.round.roundId,
            seat: selectedSeat,
          })
        )
          setSelection(null);
      },
    );
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
    isSelecting,
    selectedSeat,
    reveal,
    selectSeat: (seat: number) => {
      if (
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
    clearBots: () =>
      showConfirmAlert('清除所有机器人？', '真人座位会保留。', async () => {
        await submit('清除机器人', { type: 'undercover.bots.clear' });
      }),
    abort,
    returnToLobby,
    allowRepeated,
  };
}
