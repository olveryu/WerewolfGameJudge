import { BottomSheet } from '@/components/BottomSheet';

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
    <BottomSheet
      title="本局总排名"
      onClose={onClose}
      header={{ description: '累计总分排名 · 同分并列', closeLabel: '关闭总排名' }}
    >
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
