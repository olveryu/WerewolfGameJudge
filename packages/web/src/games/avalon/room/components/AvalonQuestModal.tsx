/**
 * 阿瓦隆任务出牌弹窗：队员未出牌前不能关闭，出牌须确认。
 * 全员出完后显示揭晓倒计时（引擎武装的 deadlineAt）。
 * 出牌内容秘密：弹窗只显示自己的选择。
 */
import './AvalonStageModal.css';

import { type AvalonPlay, type AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';

import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';
import { ChoiceCard } from '@/components/ChoiceCard';
import { PendingSeatsRow } from '@/features/room/components/PendingSeatsRow';
import { StageSettleRescue } from '@/features/room/components/StageSettleRescue';
import { TESTIDS } from '@/testids';
import { showConfirmAlert } from '@/utils/alertPresets';

import { avalonVoteFailImage, avalonVoteSuccessImage } from '../../assets/avalonVoteImages';
import { formatAvalonSeatName } from '../../model/avalonSeatName';
import { formatAvalonRoundLabel, resolveQuestInstruction } from '../policy/avalonInteractionPolicy';

const PLAY_COPY: Readonly<Record<AvalonPlay, string>> = {
  success: '成功',
  fail: '失败',
};

/** 出牌弹窗：秘密点选/改牌，意图上报调用方；提交中禁用防重复提交。 */
export function AvalonQuestModal({
  viewModel,
  remainingSeconds,
  isOverdue,
  isHost,
  isSubmitting,
  onPlay,
  onRetry,
  onClose,
}: {
  readonly viewModel: AvalonViewModel;
  readonly remainingSeconds: number | null;
  readonly isOverdue: boolean;
  readonly isHost: boolean;
  readonly isSubmitting: boolean;
  readonly onPlay: (play: AvalonPlay) => void;
  readonly onRetry: () => void;
  readonly onClose: () => void;
}) {
  const instruction = resolveQuestInstruction(viewModel);
  const teamSeats = viewModel.teamSeats ?? [];
  const confirmPlay = (play: AvalonPlay) =>
    showConfirmAlert('确认出牌？', `确定打出「${PLAY_COPY[play]}」吗？`, () => onPlay(play));
  return (
    <CenterDialog
      open
      onClose={onClose}
      title={`${formatAvalonRoundLabel(viewModel.questResults.length + 1)} · 任务执行`}
      testId={TESTIDS.avalonQuestModal}
      requireConfirmation={instruction.isTeamMember && instruction.myPlay === null}
    >
      <div className="avalon-stage-team">
        <span className="avalon-stage-team-title">本轮队员</span>
        {teamSeats.map((seat) => (
          <span key={seat} className="avalon-stage-team-member">
            {formatAvalonSeatName(viewModel, seat)}
          </span>
        ))}
      </div>
      {remainingSeconds !== null && remainingSeconds > 0 && (
        <p className="avalon-stage-countdown" data-testid={TESTIDS.avalonQuestCountdown}>
          已全部出牌，{remainingSeconds} 秒后揭晓
        </p>
      )}
      {viewModel.pendingPlaySeats !== null && viewModel.pendingPlaySeats.length > 0 && (
        <PendingSeatsRow
          label="未出牌"
          seats={viewModel.pendingPlaySeats}
          testId={TESTIDS.avalonQuestPendingSeats}
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
      {instruction.isTeamMember && (
        <div className="choice-row">
          {instruction.availableCards.includes('success') && (
            <ChoiceCard
              label="成功"
              imageSrc={avalonVoteSuccessImage}
              isSelected={instruction.myPlay === 'success'}
              isDisabled={isSubmitting}
              testId={TESTIDS.avalonQuestSuccess}
              onClick={() => confirmPlay('success')}
            />
          )}
          {instruction.availableCards.includes('fail') && (
            <ChoiceCard
              label="失败"
              imageSrc={avalonVoteFailImage}
              isSelected={instruction.myPlay === 'fail'}
              isDisabled={isSubmitting}
              testId={TESTIDS.avalonQuestFail}
              onClick={() => confirmPlay('fail')}
            />
          )}
        </div>
      )}
      <p className="avalon-stage-hint">
        {instruction.isTeamMember && instruction.myPlay !== null
          ? `已出牌（${PLAY_COPY[instruction.myPlay]}），揭晓前可改牌；出了什么牌不公开。`
          : instruction.isTeamMember
            ? '秘密出牌：点选一张卡，出了什么牌不公开。'
            : '等待队员出牌…'}
      </p>
      {instruction.myPlay !== null && (
        <Button
          variant="secondary"
          size="lg"
          onClick={onClose}
          data-testid={TESTIDS.avalonQuestClose}
        >
          关闭
        </Button>
      )}
    </CenterDialog>
  );
}
