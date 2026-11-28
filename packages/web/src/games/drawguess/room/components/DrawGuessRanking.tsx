import { BottomSheet } from '@/components/BottomSheet';
import { IconButton } from '@/components/IconButton';
import IconClose from '~icons/ion/close';

import { DrawGuessScoreboard, type DrawGuessScoreboardRow } from './DrawGuessScoreboard';

/**
 * The live cumulative ranking, opened from the room information bar without pausing the round.
 * The bar draws the entry; this sheet is only what it opens.
 */
export function DrawGuessRankingSheet({
  rows,
  onClose,
}: {
  readonly rows: readonly DrawGuessScoreboardRow[];
  readonly onClose: () => void;
}) {
  return (
    <BottomSheet title="本局总排名" onClose={onClose}>
      <header className="drawguess-ranking-header">
        <div>
          <h2>本局总排名</h2>
          <p>累计总分排名 · 同分并列</p>
        </div>
        <IconButton label="关闭总排名" icon={<IconClose aria-hidden />} onClick={onClose} />
      </header>
      <div className="drawguess-ranking-body">
        <DrawGuessScoreboard
          title="玩家积分"
          competitionRanking
          rows={rows.map((row) => ({ ...row, roundScore: null }))}
        />
      </div>
    </BottomSheet>
  );
}
