/**
 * 阿瓦隆组队投票弹窗：轮到投票时自动弹出一次，可关（去看座位盘），
 * 阶段条有重开入口。全员投完后显示揭晓倒计时（引擎武装的 deadlineAt）。
 */
import './AvalonStageModal.css';

import {
  type AvalonBallot,
  type AvalonViewModel,
} from '@game-judge/game-engine/games/avalon/public';

import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';
import { PendingSeatsRow } from '@/features/room/components/PendingSeatsRow';
import { StageSettleRescue } from '@/features/room/components/StageSettleRescue';
import { TESTIDS } from '@/testids';
import IconCheckmarkCircleOutline from '~icons/ion/checkmark-circle-outline';
import IconCloseCircleOutline from '~icons/ion/close-circle-outline';

import { formatAvalonSeatName } from '../../model/avalonSeatName';
import { formatAvalonRoundLabel, resolveVoteInstruction } from '../policy/avalonInteractionPolicy';
import { AvalonChoiceCard } from './AvalonChoiceCard';

const BALLOT_COPY: Readonly<Record<AvalonBallot, string>> = {
  approve: '赞成',
  reject: '反对',
};

/** 投票弹窗：大卡片点选/改票，意图上报调用方；提交中禁用防重复提交。 */
export function AvalonVoteModal({
  viewModel,
  remainingSeconds,
  isOverdue,
  isHost,
  isSubmitting,
  onVote,
  onRetry,
  onClose,
}: {
  readonly viewModel: AvalonViewModel;
  readonly remainingSeconds: number | null;
  readonly isOverdue: boolean;
  readonly isHost: boolean;
  readonly isSubmitting: boolean;
  readonly onVote: (vote: AvalonBallot) => void;
  readonly onRetry: () => void;
  readonly onClose: () => void;
}) {
  const instruction = resolveVoteInstruction(viewModel);
  const proposed = viewModel.proposedSeats ?? [];
  return (
    <CenterDialog
      open
      onClose={onClose}
      title={`${formatAvalonRoundLabel(viewModel.questResults.length + 1)} · 组队投票`}
      testId={TESTIDS.avalonVoteModal}
    >
      <div className="avalon-stage-team">
        <span className="avalon-stage-team-title">待表决的队伍</span>
        {proposed.map((seat) => (
          <span
            key={seat}
            className="avalon-stage-team-member"
            data-testid={TESTIDS.avalonVoteTeam(seat)}
          >
            {formatAvalonSeatName(viewModel, seat)}
          </span>
        ))}
      </div>
      {remainingSeconds !== null && remainingSeconds > 0 && (
        <p className="avalon-stage-countdown" data-testid={TESTIDS.avalonVoteCountdown}>
          已全部投票，{remainingSeconds} 秒后揭晓
        </p>
      )}
      {viewModel.pendingVoteSeats !== null && viewModel.pendingVoteSeats.length > 0 && (
        <PendingSeatsRow
          label="未投票"
          seats={viewModel.pendingVoteSeats}
          testId={TESTIDS.avalonVotePendingSeats}
        />
      )}
      <StageSettleRescue
        remainingSeconds={remainingSeconds}
        isOverdue={isOverdue}
        isHost={isHost}
        isRetrying={isSubmitting}
        onRetry={onRetry}
        waitingLabel="等待推进…"
      />
      {instruction.canVote && (
        <div className="avalon-choice-row">
          <AvalonChoiceCard
            label="赞成"
            icon={<IconCheckmarkCircleOutline className="avalon-choice-icon" aria-hidden />}
            tone="light"
            isSelected={instruction.myBallot === 'approve'}
            isDisabled={isSubmitting}
            testId={TESTIDS.avalonVoteApprove}
            onClick={() => onVote('approve')}
          />
          <AvalonChoiceCard
            label="反对"
            icon={<IconCloseCircleOutline className="avalon-choice-icon" aria-hidden />}
            tone="dark"
            isSelected={instruction.myBallot === 'reject'}
            isDisabled={isSubmitting}
            testId={TESTIDS.avalonVoteReject}
            onClick={() => onVote('reject')}
          />
        </div>
      )}
      <p className="avalon-stage-hint">
        {instruction.myBallot !== null
          ? `已投票（${BALLOT_COPY[instruction.myBallot]}），揭晓前可点另一张改票。`
          : instruction.canVote
            ? '请选择赞成或反对；揭晓前可改票。'
            : '你不在座位上，无法投票。'}
      </p>
      <Button variant="secondary" size="lg" onClick={onClose} data-testid={TESTIDS.avalonVoteClose}>
        关闭
      </Button>
    </CenterDialog>
  );
}
