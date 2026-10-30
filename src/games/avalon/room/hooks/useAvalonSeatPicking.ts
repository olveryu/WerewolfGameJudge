/**
 * 阿瓦隆对局中的座位盘点选：提前刺杀选人模式（优先、独占）→ 湖仙持有人查验 →
 * 刺客指认，三份 useSeatPicking 配置合成一个 handleSeatTap，供共享座位点按
 * 处理器的 inGameAction 消费。资格集由 avalonInteractionPolicy 产出，点选只
 * 产出待二次确认的目标（刺杀确认 / 湖仙查验确认），命令由 Screen 的确认弹窗发出。
 */

import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';

import { useSeatPicking } from '@/features/room/hooks/useSeatPicking';

import type { AvalonStrikeConfirmation } from '../components/AvalonStrikeConfirmModal';
import {
  eligibleStrikeTargets,
  resolveAssassinInstruction,
  resolveLadyInstruction,
} from '../policy/avalonInteractionPolicy';

export interface AvalonSeatPicking {
  /** 刺杀二次确认（指认 / 提前刺杀）；null 为关闭。 */
  readonly strikeConfirm: AvalonStrikeConfirmation | null;
  readonly setStrikeConfirm: Dispatch<SetStateAction<AvalonStrikeConfirmation | null>>;
  /** 湖仙查验二次确认目标；null 为关闭。 */
  readonly ladyCheckTarget: number | null;
  readonly setLadyCheckTarget: Dispatch<SetStateAction<number | null>>;
  /** 返回 true 表示本次点按已被点选消费。 */
  readonly handleSeatTap: (seat: number) => boolean;
}

export function useAvalonSeatPicking({
  viewModel,
  strikePickMode,
  setStrikePickMode,
}: {
  readonly viewModel: AvalonViewModel | null;
  readonly strikePickMode: boolean;
  readonly setStrikePickMode: Dispatch<SetStateAction<boolean>>;
}): AvalonSeatPicking {
  const [strikeConfirm, setStrikeConfirm] = useState<AvalonStrikeConfirmation | null>(null);
  const [ladyCheckTarget, setLadyCheckTarget] = useState<number | null>(null);
  useEffect(() => {
    if (viewModel?.phase !== 'lady') setLadyCheckTarget(null);
    if (viewModel === null || !viewModel.canEarlyStrike) setStrikePickMode(false);
  }, [viewModel, setStrikePickMode]);

  const ladyInstruction =
    viewModel !== null && viewModel.phase === 'lady' ? resolveLadyInstruction(viewModel) : null;
  const assassinInstruction =
    viewModel !== null && viewModel.phase === 'assassin'
      ? resolveAssassinInstruction(viewModel)
      : null;
  const strikePickActive = strikePickMode && viewModel !== null && viewModel.canEarlyStrike;
  const strikePicking = useSeatPicking({
    active: strikePickActive,
    mode: 'trigger',
    eligibleSeats: viewModel === null ? [] : eligibleStrikeTargets(viewModel),
    storage: { kind: 'local' },
    onPick: (seat) => {
      setStrikePickMode(false);
      setStrikeConfirm({ seat, mode: 'earlyStrike' });
    },
  });
  const ladyPicking = useSeatPicking({
    active: ladyInstruction?.kind === 'holderPick',
    mode: 'trigger',
    eligibleSeats: ladyInstruction?.kind === 'holderPick' ? ladyInstruction.eligibleSeats : [],
    storage: { kind: 'local' },
    onPick: setLadyCheckTarget,
  });
  const assassinPicking = useSeatPicking({
    active: assassinInstruction?.kind === 'assassinPick',
    mode: 'trigger',
    eligibleSeats: viewModel === null ? [] : eligibleStrikeTargets(viewModel),
    storage: { kind: 'local' },
    onPick: (seat) => setStrikeConfirm({ seat, mode: 'accuse' }),
  });
  const handleSeatTap = (seat: number): boolean => {
    if (viewModel === null) return false;
    // 提前刺杀选人模式独占点按；其余按湖仙 → 刺杀指认逐个尝试消费。
    if (strikePickActive) return strikePicking.handleSeatTap(seat);
    return ladyPicking.handleSeatTap(seat) || assassinPicking.handleSeatTap(seat);
  };
  return { strikeConfirm, setStrikeConfirm, ladyCheckTarget, setLadyCheckTarget, handleSeatTap };
}
