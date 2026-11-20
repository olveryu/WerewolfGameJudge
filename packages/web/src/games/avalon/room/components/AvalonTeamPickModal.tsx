/**
 * 阿瓦隆组队选人弹窗：组队阶段的唯一选人入口（板子点选已停用）。
 * 从底部弹起的 bottom sheet：名单多选、满员才能确认，确认即提交——
 * 预选 modal 确认后记预选锁定记录，最终 modal 打开时预选那套已勾好、
 * 只改差量。选人过程是 modal 本地状态，取消不留痕；确认后由调用方
 * 先同步草稿再发预选 / 提交，服务端回声才是全房可见的阵容。
 */
import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';

import { RoomPlayerPickModal } from '@/features/room/components/RoomPlayerPickModal';
import { TESTIDS } from '@/testids';

import { formatAvalonSeatName } from '../../model/avalonSeatName';

export type AvalonTeamPickKind = 'preselect' | 'final';

/** 组队选人弹窗：名单多选、满员确认，意图上报调用方；提交中禁用防重复提交。 */
export function AvalonTeamPickModal({
  viewModel,
  kind,
  isSubmitting,
  onConfirm,
  onClose,
}: {
  readonly viewModel: AvalonViewModel;
  readonly kind: AvalonTeamPickKind;
  readonly isSubmitting: boolean;
  readonly onConfirm: (seats: readonly number[]) => void;
  readonly onClose: () => void;
}) {
  const requiredSize = viewModel.requiredSize ?? 0;
  const preselected = viewModel.preselectedSeats ?? [];
  const isFinalAttempt = viewModel.rejectStreak >= viewModel.vetoLimit - 1;
  const title = kind === 'preselect' ? '预选队伍' : '最终队伍';
  const hint =
    kind === 'preselect'
      ? '确认后预选即锁定、全房可见；随后可调整最终队伍，预选记录不动。'
      : isFinalAttempt
        ? '这是最后一次组队，提交后自动通过，不再投票。'
        : `提交后进入投票，无法再改；第 ${viewModel.vetoLimit} 次组队将自动通过。`;

  return (
    <RoomPlayerPickModal
      title={title}
      hint={hint}
      requiredSize={requiredSize}
      initialSelection={kind === 'final' ? preselected : []}
      players={viewModel.seats.map(({ seat }) => ({
        seat,
        label: formatAvalonSeatName(viewModel, seat),
        tag: seat === viewModel.leaderSeat ? '队长' : null,
        isPreselected: kind === 'final' && preselected.includes(seat),
        disabledReason: null,
      }))}
      isSubmitting={isSubmitting}
      confirmLabel={
        kind === 'preselect' ? '确认预选' : isFinalAttempt ? '确认并自动通过' : '确认提交'
      }
      onConfirm={onConfirm}
      onClose={onClose}
      testIds={{
        modal: TESTIDS.avalonTeamPickModal,
        count: TESTIDS.avalonTeamPickCount,
        row: TESTIDS.avalonTeamPickRow,
        cancel: TESTIDS.avalonTeamPickCancel,
        confirm: TESTIDS.avalonTeamPickConfirm,
      }}
    />
  );
}
