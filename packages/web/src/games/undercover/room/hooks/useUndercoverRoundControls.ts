/** Local card visibility and command orchestration; the server decides eliminations and winners. */
import {
  getUndercoverWordCard,
  type UndercoverPublicCommand,
  type UndercoverState,
  type UndercoverWordCard,
} from '@game-judge/game-engine/games/undercover/public';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { ReadyRoomSession } from '@/features/room/controllers/useReadyRoomSession';
import { useSeatPicking } from '@/features/room/hooks/useSeatPicking';
import { showConfirmAlert } from '@/utils/alertPresets';

async function requestUndercoverRestart(
  state: UndercoverState,
  submit: (label: string, command: UndercoverPublicCommand) => Promise<boolean>,
  closeCard: () => void,
  clearSelection: () => void,
) {
  if (state.phase === 'lobby') throw new Error('Restart requires an existing Undercover round');
  const roundId =
    state.phase === 'preparing' || state.phase === 'preparationFailed'
      ? state.pendingRound.roundId
      : state.phase === 'aborted'
        ? state.abortedRoundId
        : state.round.roundId;
  closeCard();
  if (
    await submit('重新开始', {
      type: 'undercover.game.restart',
      roundId,
      wasEnded: state.phase === 'ended',
    })
  )
    clearSelection();
}

/**
 * 卧底回合控制的显式契约（P-2b）：词卡可见性、揭晓选择与回合命令的唯一出口，
 * 由 useUndercoverRoomState 的接口以 controls 字段引用。
 */
export interface UndercoverRoundControls {
  readonly isSubmitting: boolean;
  readonly controlledSeat: number | null;
  /** 当前可见词卡；不可见或无权查看时为 null。 */
  readonly card: UndercoverWordCard | null;
  readonly canViewCard: boolean;
  /** 身份查看协议：viewing 阶段且本座位未在服务端确认时，词卡需要确认动作。 */
  readonly shouldConfirm: boolean;
  readonly openCard: () => void;
  readonly closeCard: () => void;
  readonly confirmCard: () => void;
  readonly markAllBotsViewed: () => void;
  readonly begin: () => void;
  readonly isSelecting: boolean;
  readonly selectedSeat: number | null;
  readonly reveal: () => void;
  readonly selectSeat: (seat: number) => void;
  readonly beginSelection: () => void;
  readonly cancelRevelation: () => void;
  readonly cancelSelection: () => void;
  readonly start: () => void;
  readonly retry: () => void;
  readonly restart: () => Promise<void>;
  readonly allowRepeated: () => void;
}

export interface UndercoverRoundControlsInput {
  readonly state: UndercoverState;
  readonly userId: string;
  readonly controlledSeat: number | null;
  /** The ready session's single-flight submit (useReadyRoomSession). */
  readonly submit: ReadyRoomSession<UndercoverState, UndercoverPublicCommand>['submit'];
  readonly isSubmitting: boolean;
}

export function useUndercoverRoundControls({
  state,
  userId,
  controlledSeat,
  submit,
  isSubmitting,
}: UndercoverRoundControlsInput): UndercoverRoundControls {
  const [visibleCardKey, setVisibleCardKey] = useState<string | null>(null);
  // 选人模式本身（锚定的 roundId）是本家的模式状态；选中的座位经共享
  // 点选机制持有（replace 模式，锚 = selectionRoundId，换锚自动清空）。
  const [selectionRoundId, setSelectionRoundId] = useState<string | null>(null);
  const isHost = state.hostUserId === userId;
  const card = getUndercoverWordCard(state, userId, controlledSeat);
  const cardKey =
    card === null ? null : `${state.round!.roundId}:${userId}:${card.seat}:${state.hostUserId}`;
  const latestCardKey = useRef(cardKey);
  useEffect(() => {
    latestCardKey.current = cardKey;
  }, [cardKey]);
  const isSelecting =
    isHost && state.phase === 'ongoing' && selectionRoundId === state.round.roundId;
  // 资格 = 尚未揭晓的座位（与原 selectSeat 的静默守卫同集）：已揭晓座位
  // 的点按被机制吞掉（swallow），不落回默认座位行为。
  const picking = useSeatPicking({
    active: isSelecting && !isSubmitting,
    mode: 'replace',
    eligibleSeats:
      state.phase === 'ongoing'
        ? Array.from({ length: state.config.numberOfPlayers }, (_, seat) => seat).filter(
            (seat) => !state.round.revelations.some((entry) => entry.seat === seat),
          )
        : [],
    ineligibleTap: 'swallow',
    anchorKey: selectionRoundId,
    storage: { kind: 'local' },
  });
  const pickedSeat = picking.selection[0] ?? null;
  const selectedSeat =
    isSelecting &&
    pickedSeat !== null &&
    !state.round.revelations.some((entry) => entry.seat === pickedSeat)
      ? pickedSeat
      : null;
  const exitSelection = () => {
    setSelectionRoundId(null);
    picking.reset();
  };
  const closeCard = () => setVisibleCardKey(null);
  // A new card identity (round, viewer, seat or host) hides the open card.
  const [renderedCardKey, setRenderedCardKey] = useState(cardKey);
  if (renderedCardKey !== cardKey) {
    setRenderedCardKey(cardKey);
    setVisibleCardKey(null);
  }
  // Hiding the page hides the word, so a backgrounded tab never shows it to onlookers.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') setVisibleCardKey(null);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  const roundId =
    state.phase === 'preparing' || state.phase === 'preparationFailed'
      ? state.pendingRound.roundId
      : state.round?.roundId;
  const confirmCard = () => {
    if (state.phase !== 'viewing' || card === null)
      throw new Error('Card confirmation requires a viewing participant');
    void submit(
      '确认词卡',
      { type: 'undercover.role.viewed', roundId: state.round.roundId },
      { controlledSeat },
    ).then((success) => {
      if (success && latestCardKey.current === cardKey) closeCard();
    });
  };
  const reveal = () => {
    if (state.phase !== 'ongoing' || selectedSeat === null)
      throw new Error('Reveal requires a selected live seat');
    void submit('揭晓并出局', {
      type: 'undercover.round.reveal',
      roundId: state.round.roundId,
      seat: selectedSeat,
    }).then((success) => {
      if (success) exitSelection();
    });
  };
  const allowRepeated = () =>
    showConfirmAlert(
      '仅下一局允许重复词对？',
      '当前分类没有未使用词对。本次授权不会改变之后各局的去重设置。',
      async () => {
        if (state.phase !== 'preparationFailed' || state.failureCode !== 'inventoryExhausted')
          throw new Error('Allowing repeated words requires exhausted inventory');
        await submit('允许重复词对', {
          type: 'undercover.round.allowRepeated',
          roundId: state.pendingRound.roundId,
        });
      },
    );
  return {
    isSubmitting,
    controlledSeat,
    card: visibleCardKey !== null && visibleCardKey === cardKey ? card : null,
    canViewCard: card !== null,
    shouldConfirm:
      card !== null && state.phase === 'viewing' && !state.round.confirmedSeats.includes(card.seat),
    openCard: () => {
      if (cardKey === null) throw new Error('No permitted Undercover word card');
      showConfirmAlert(
        '查看词卡？',
        '确定现在查看你的词卡吗？',
        () => {
          if (latestCardKey.current !== cardKey) {
            toast.error('词卡已变化，请重新查看。');
            return;
          }
          setVisibleCardKey(cardKey);
        },
        { confirmText: '查看' },
      );
    },
    closeCard,
    confirmCard,
    markAllBotsViewed: () => {
      if (state.phase !== 'viewing') throw new Error('Bot confirmation requires viewing phase');
      void submit('标记机器人已查看', {
        type: 'undercover.bots.markAllBotsViewed',
        roundId: state.round.roundId,
      });
    },
    begin: () => {
      if (state.phase !== 'viewing') throw new Error('Begin requires the viewing phase');
      void submit('开始游戏', { type: 'undercover.game.begin', roundId: state.round.roundId });
    },
    isSelecting,
    selectedSeat,
    reveal,
    selectSeat: (seat: number) => {
      // 守卫已编码进机制：active（选人中且未提交中）+ 资格集（未揭晓）。
      picking.handleSeatTap(seat);
    },
    beginSelection: () => {
      if (state.phase !== 'ongoing' || !isHost)
        throw new Error('Only the host can select an elimination');
      closeCard();
      setSelectionRoundId(state.round.roundId);
      picking.reset();
    },
    cancelRevelation: () => {
      if (!isSubmitting && isSelecting) picking.reset();
    },
    cancelSelection: exitSelection,
    start: () => {
      void submit('分配角色', { type: 'undercover.roles.assign', shouldAllowRepeated: false });
    },
    retry: () => {
      if (roundId === undefined) throw new Error('Retry requires a pending round');
      void submit('重新准备', { type: 'undercover.round.retry', roundId });
    },
    restart: () => requestUndercoverRestart(state, submit, closeCard, exitSelection),
    allowRepeated,
  };
}
