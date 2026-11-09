/**
 * 阿瓦隆湖仙确认展示弹窗：被查验者轮到确认时自动弹出一次，
 * 可关（去看座位盘），阶段条有重开入口。确认后持有人将看到其阵营。
 */
import './AvalonDialogs.css';

import { type AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';

import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';

import { formatAvalonSeatName } from '../../model/avalonSeatName';
import { resolveLadyInstruction } from '../policy/avalonInteractionPolicy';

/** 确认展示弹窗：确认意图上报调用方；提交中禁用防重复提交。 */
export function AvalonLadyAcknowledgeModal({
  viewModel,
  isSubmitting,
  onAcknowledge,
  onClose,
}: {
  readonly viewModel: AvalonViewModel;
  readonly isSubmitting: boolean;
  readonly onAcknowledge: () => void;
  readonly onClose: () => void;
}) {
  const instruction = resolveLadyInstruction(viewModel);
  const holderSeat = instruction.kind === 'targetConfirm' ? instruction.holderSeat : null;
  // 渲染门控已保证 targetConfirm；竞态下指令已变则不渲染空名文案。
  if (holderSeat === null) return null;
  const holderName = formatAvalonSeatName(viewModel, holderSeat);
  return (
    <CenterDialog
      open
      onClose={onClose}
      title="湖中仙女查验"
      testId="avalon-lady-acknowledge-modal"
    >
      <p className="avalon-dialog-body">
        {holderName} 要查验你的阵营。确认展示后，对方将看到你是好人还是坏人。
      </p>
      <div className="avalon-dialog-actions">
        <Button
          size="lg"
          loading={isSubmitting}
          onClick={onAcknowledge}
          data-testid="avalon-lady-acknowledge"
        >
          确认展示
        </Button>
        <Button variant="secondary" size="lg" onClick={onClose} data-testid="avalon-lady-ack-close">
          稍后再说
        </Button>
      </div>
    </CenterDialog>
  );
}
