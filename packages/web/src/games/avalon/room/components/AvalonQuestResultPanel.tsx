/**
 * 阿瓦隆任务结算面板：任务揭晓时刻的全员展示（与投票结算面板同范式）。
 *
 * 横幅（任务成功 / 任务失败）+ 公开汇总（成功牌/失败牌数量；个人出牌永不公开）。
 * 6 秒自动关闭，也可手动点"知道了"关闭。
 */
import type { AvalonQuestHistoryView } from '@game-judge/game-engine/games/avalon/public';

import { formatAvalonRoundLabel } from '../policy/avalonInteractionPolicy';
import { AvalonResultDialog } from './AvalonResultDialog';

/** 任务结算面板；挂载即开始 6 秒倒计时，到时或手动"知道了"都走 onClose。 */
export function AvalonQuestResultPanel({
  entry,
  onClose,
}: {
  readonly entry: AvalonQuestHistoryView;
  readonly onClose: () => void;
}) {
  const succeeded = entry.result === 'success';
  return (
    <AvalonResultDialog
      banner={`${formatAvalonRoundLabel(entry.round)} · ${succeeded ? '任务成功' : '任务失败'}`}
      outcome={succeeded ? 'positive' : 'negative'}
      testIdPrefix="avalon-quest-result"
      onClose={onClose}
    >
      <p className="avalon-result-counts" data-testid="avalon-quest-result-counts">
        成功牌 {entry.successCount} · 失败牌 {entry.failCount}
      </p>
    </AvalonResultDialog>
  );
}
