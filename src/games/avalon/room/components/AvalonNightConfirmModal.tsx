/**
 * 阿瓦隆晚上确认信息弹窗：对齐狼人杀丘比特 groupConfirm 模式。
 *
 * 座位盘保持可见（背景），私密信息用 AlertModal 弹窗展示，
 * "确认信息"按钮发送 avalon.night.confirm。
 */

import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';

import { AlertModal } from '@/components/AlertModal';

import {
  type AvalonNightInstruction,
  resolveNightInstruction,
} from '../policy/avalonInteractionPolicy';

export function AvalonNightConfirmModal({
  viewModel,
  isSubmitting,
  onConfirm,
  onClose,
}: {
  readonly viewModel: AvalonViewModel;
  readonly isSubmitting: boolean;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}) {
  const instruction = resolveNightInstruction(viewModel);
  const dialog = toConfirmDialog(instruction, viewModel);
  if (dialog === null) return null;
  return (
    <AlertModal
      visible
      title={dialog.title}
      message={dialog.message}
      onClose={onClose}
      buttons={[
        {
          text: '确认信息',
          onPress: onConfirm,
          disabled: isSubmitting,
        },
      ]}
    />
  );
}

interface NightConfirmDialog {
  readonly title: string;
  readonly message: string;
}

/** 只有需要确认的指令才弹窗；已确认/等待不弹窗。 */
function toConfirmDialog(
  instruction: AvalonNightInstruction,
  viewModel: AvalonViewModel,
): NightConfirmDialog | null {
  switch (instruction.kind) {
    case 'evilPeers':
      return {
        title: '坏人互认',
        message: instruction.isAlone
          ? '无人可认：你看不见其他坏人，他们也看不见你。'
          : `你看到的坏人同伴：${instruction.peers.map((seat) => formatSeat(viewModel, seat)).join('、')}`,
      };
    case 'merlin':
      return {
        title: '梅林的视野',
        message: `你看到的坏人（莫德雷德不在其中）：${instruction.sees.map((seat) => formatSeat(viewModel, seat)).join('、')}`,
      };
    case 'percival':
      return {
        title: '派西维尔的视野',
        message: `你看到的两个人，其中一个是梅林，另一个是莫甘娜：${instruction.sees.map((seat) => formatSeat(viewModel, seat)).join('、')}`,
      };
    case 'confirmed':
    case 'waiting':
      return null;
  }
}

function formatSeat(viewModel: AvalonViewModel, seat: number): string {
  const name = viewModel.seats.find((entry) => entry.seat === seat)?.displayName;
  return `${seat + 1}号${name ? `·${name}` : ''}`;
}
