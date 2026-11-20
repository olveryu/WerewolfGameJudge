/**
 * 阿瓦隆任务结算面板：任务揭晓时刻的全员展示（与投票结算面板同范式）。
 *
 * 横幅（任务成功 / 任务失败）+ 公开汇总（成功牌/失败牌数量；个人出牌永不公开）。
 * 等待所有座位确认后推进。
 */
import type { AvalonQuestHistoryView } from '@game-judge/game-engine/games/avalon/public';

import { TESTIDS } from '@/testids';

import { avalonVoteFailImage, avalonVoteSuccessImage } from '../../assets/avalonVoteImages';
import { formatAvalonRoundLabel } from '../policy/avalonInteractionPolicy';
import { AvalonResultDialog } from './AvalonResultDialog';

/** 任务结算面板：显示结果与确认进度。 */
export function AvalonQuestResultPanel({
  entry,
  remainingSeconds,
}: {
  readonly entry: AvalonQuestHistoryView;
  readonly remainingSeconds: number | null;
}) {
  const succeeded = entry.result === 'success';
  return (
    <AvalonResultDialog
      banner={`${formatAvalonRoundLabel(entry.round)} · ${succeeded ? '任务成功' : '任务失败'}`}
      bannerImageSrc={succeeded ? avalonVoteSuccessImage : avalonVoteFailImage}
      outcome={succeeded ? 'positive' : 'negative'}
      kind="quest"
      remainingSeconds={remainingSeconds}
    >
      <p className="avalon-result-counts" data-testid={TESTIDS.avalonQuestResultCounts}>
        成功牌 {entry.successCount} · 失败牌 {entry.failCount}
      </p>
    </AvalonResultDialog>
  );
}
