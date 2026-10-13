/**
 * 查看阶段视图：牌已发、对局未开始。共享 ViewingStageScaffold 骨架，
 * 本组件只提供阿瓦隆的进度口径与提示文案；实际查看走底部「查看身份」
 * 按钮（打开角色卡即落记录），开始游戏在房主管理区。
 */

import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';

import { ViewingStageScaffold } from '@/features/room/components/ViewingStageScaffold';

export function AvalonViewingView({
  viewModel,
  totalSeats,
  isHost,
}: {
  readonly viewModel: AvalonViewModel;
  readonly totalSeats: number;
  readonly isHost: boolean;
}) {
  const viewedCount = totalSeats - viewModel.unviewedRoleSeats.length;
  const hint = !viewModel.hasViewedRole
    ? '点击下方「查看身份」，查看你的角色。'
    : viewedCount === totalSeats
      ? isHost
        ? '全员已查看，在房主管理中点「开始游戏」进入夜晚。'
        : '全员已查看，等待房主开始游戏。'
      : '你已查看，等待其他玩家查看身份。';
  return (
    <ViewingStageScaffold
      title="身份查看"
      progressLabel={`已查看 ${viewedCount}/${totalSeats}`}
      hint={hint}
      testID="avalon-viewing"
    />
  );
}
