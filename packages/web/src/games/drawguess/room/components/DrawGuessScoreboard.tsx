/**
 * 计分板：座位、得分与排名。终局按竞赛排名 1、2、2、4 顺延。
 */

import {
  DRAWGUESS_BOT_TAG,
  formatDrawGuessScore,
  rankDrawGuessScores,
} from '../../model/drawGuessResults';

export interface DrawGuessScoreboardRow {
  readonly seat: number;
  readonly displayName: string;
  readonly isBot: boolean;
  readonly isDrawer: boolean;
  readonly isSelf: boolean;
  /** 本轮得分；终局榜为 null，不渲染本轮段。 */
  readonly roundScore: number | null;
  readonly totalScore: number;
}

interface DrawGuessScoreboardProps {
  readonly title: string;
  /** 按竞赛排名展示（同分并列，下一名次跳过）；false 则只按得分降序。 */
  readonly competitionRanking: boolean;
  readonly rows: readonly DrawGuessScoreboardRow[];
}

function rankLabel(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `第${rank}名`;
}

/** 总分榜：结算行显示本轮加分与总分，终局行只显示总分；自己一行高亮。 */
export function DrawGuessScoreboard({ title, competitionRanking, rows }: DrawGuessScoreboardProps) {
  const ranked = competitionRanking
    ? rankDrawGuessScores(rows)
    : [...rows]
        .sort((a, b) => b.totalScore - a.totalScore)
        .map((row, index) => ({ ...row, rank: index + 1 }));
  return (
    <section className="drawguess-panel drawguess-scoreboard" aria-label={title}>
      <h3 className="drawguess-section-title">{title}</h3>
      <ol className="drawguess-scoreboard-list">
        {ranked.map((row) => (
          <li key={row.seat} className="drawguess-scoreboard-row">
            <span className="drawguess-scoreboard-rank">
              {competitionRanking ? rankLabel(row.rank) : `${row.rank}`}
            </span>
            <span
              className="drawguess-scoreboard-name"
              data-self={row.isSelf ? '' : undefined}
              aria-current={row.isSelf ? 'true' : undefined}
            >
              {row.displayName}
              {row.isBot ? ` · ${DRAWGUESS_BOT_TAG}` : ''}
              {row.isDrawer ? ' · 画手' : ''}
            </span>
            <span className="drawguess-scoreboard-score">
              {row.roundScore === null
                ? formatDrawGuessScore(row.totalScore)
                : `+${row.roundScore} · 总分 ${row.totalScore}`}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
