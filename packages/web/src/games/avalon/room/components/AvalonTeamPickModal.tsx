/**
 * 阿瓦隆组队选人弹窗：组队阶段的唯一选人入口（板子点选已停用）。
 * 从底部弹起的 bottom sheet：名单多选、满员才能确认，确认即提交——
 * 预选 modal 确认后记预选锁定记录，最终 modal 打开时预选那套已勾好、
 * 只改差量。选人过程是 modal 本地状态，取消不留痕；确认后由调用方
 * 先同步草稿再发预选 / 提交，服务端回声才是全房可见的阵容。
 */
import './AvalonTeamPickModal.css';

import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { useState } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import IconCheckmark from '~icons/ion/checkmark';

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
  const [selection, setSelection] = useState<readonly number[]>(() =>
    kind === 'final' ? preselected : [],
  );
  const [fullHint, setFullHint] = useState<string | null>(null);
  const isFull = selection.length === requiredSize;
  const title = kind === 'preselect' ? '预选队伍' : '最终队伍';
  const hint =
    kind === 'preselect'
      ? '确认后预选即锁定、全房可见；随后可调整最终队伍，预选记录不动。'
      : `提交后立即进入投票，无法再改；本轮被否决会计入否决串，累计 ${viewModel.vetoLimit} 次否决坏人直接获胜。`;

  const toggle = (seat: number) => {
    if (selection.includes(seat)) {
      setSelection(selection.filter((picked) => picked !== seat));
      setFullHint(null);
      return;
    }
    if (selection.length >= requiredSize) {
      setFullHint('已满员，取消已选座位后再选。');
      return;
    }
    setSelection([...selection, seat]);
    setFullHint(null);
  };

  return (
    <BottomSheet title={title} onClose={onClose} testId="avalon-team-pick-modal">
      <div className="avalon-team-pick">
        <header className="avalon-team-pick-header">
          <h2 className="avalon-team-pick-title">{title}</h2>
          <span className="avalon-team-pick-count" data-testid="avalon-team-pick-count">
            已选 {selection.length}/{requiredSize}
          </span>
        </header>
        <p className="avalon-team-pick-hint">{hint}</p>
        <div className="avalon-team-pick-list" role="group" aria-label={title}>
          {viewModel.seats.map((seatView) => {
            const seat = seatView.seat;
            const checked = selection.includes(seat);
            return (
              <button
                key={seat}
                type="button"
                role="checkbox"
                aria-checked={checked}
                className="avalon-team-pick-row"
                disabled={isSubmitting}
                data-testid={`avalon-team-pick-row-${seat}`}
                onClick={() => toggle(seat)}
              >
                <span className="avalon-team-pick-checkbox" aria-hidden>
                  {checked && <IconCheckmark />}
                </span>
                <span className="avalon-team-pick-label">
                  {formatAvalonSeatName(viewModel, seat)}
                </span>
                {seat === viewModel.leaderSeat && (
                  <span className="avalon-team-pick-tag">队长</span>
                )}
                {kind === 'final' && preselected.includes(seat) && (
                  <span className="avalon-team-pick-tag" data-preselected>
                    预选
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {fullHint !== null && (
          <p className="avalon-team-pick-full" role="status">
            {fullHint}
          </p>
        )}
        <footer className="avalon-team-pick-footer">
          <Button
            variant="secondary"
            size="lg"
            onClick={onClose}
            data-testid="avalon-team-pick-cancel"
          >
            取消
          </Button>
          <Button
            size="lg"
            disabled={!isFull || isSubmitting}
            onClick={() => onConfirm(selection)}
            data-testid="avalon-team-pick-confirm"
          >
            {kind === 'preselect' ? '确认预选' : '确认提交'}
          </Button>
        </footer>
      </div>
    </BottomSheet>
  );
}
