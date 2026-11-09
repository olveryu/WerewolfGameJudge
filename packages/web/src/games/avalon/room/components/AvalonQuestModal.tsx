/**
 * 阿瓦隆任务出牌弹窗：队员在任务阶段自动弹出一次，可关（去看座位盘），
 * 阶段条有重开入口。全员出完后显示揭晓倒计时（引擎武装的 deadlineAt）。
 * 出牌内容秘密：弹窗只显示自己的选择。
 */
import './AvalonStageModal.css';

import { type AvalonPlay, type AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';

import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';
import { PendingSeatsRow } from '@/features/room/components/PendingSeatsRow';
import { StageSettleRescue } from '@/features/room/components/StageSettleRescue';
import IconSkullOutline from '~icons/ion/skull-outline';
import IconTrophyOutline from '~icons/ion/trophy-outline';

import { formatAvalonSeatName } from '../../model/avalonSeatName';
import { formatAvalonRoundLabel, resolveQuestInstruction } from '../policy/avalonInteractionPolicy';
import { AvalonChoiceCard } from './AvalonChoiceCard';

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
  return (
    <CenterDialog
      open
      onClose={onClose}
      title={`${formatAvalonRoundLabel(viewModel.questResults.length + 1)} · 任务执行`}
      testId="avalon-quest-modal"
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
        <p className="avalon-stage-countdown" data-testid="avalon-quest-countdown">
          已全部出牌，{remainingSeconds} 秒后揭晓
        </p>
      )}
      {viewModel.pendingPlaySeats !== null && viewModel.pendingPlaySeats.length > 0 && (
        <PendingSeatsRow
          label="未出牌"
          seats={viewModel.pendingPlaySeats}
          testId="avalon-quest-pending-seats"
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
        <div className="avalon-choice-row">
          {instruction.availableCards.includes('success') && (
            <AvalonChoiceCard
              label="成功"
              icon={<IconTrophyOutline className="avalon-choice-icon" aria-hidden />}
              tone="gold"
              isSelected={instruction.myPlay === 'success'}
              isDisabled={isSubmitting}
              testId="avalon-quest-success"
              onClick={() => onPlay('success')}
            />
          )}
          {instruction.availableCards.includes('fail') && (
            <AvalonChoiceCard
              label="失败"
              icon={<IconSkullOutline className="avalon-choice-icon" aria-hidden />}
              tone="dark"
              isSelected={instruction.myPlay === 'fail'}
              isDisabled={isSubmitting}
              testId="avalon-quest-fail"
              onClick={() => onPlay('fail')}
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
      <Button variant="secondary" size="lg" onClick={onClose} data-testid="avalon-quest-close">
        关闭
      </Button>
    </CenterDialog>
  );
}
