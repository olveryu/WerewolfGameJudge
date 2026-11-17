/**
 * 计分板：座位、得分与排名。终局按竞赛排名 1、2、2、4 顺延。
 */

import type { DrawGuessViewModel } from '@game-judge/game-engine/games/drawguess/public';

import { RoomRanking } from '@/features/room/components/RoomRanking';

import {
  type DrawGuessReactionCounts,
  formatDrawGuessReactionCounts,
} from '../../model/drawGuessReactionCounts';
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
  readonly reactionCounts?: DrawGuessReactionCounts;
}

/** Reuses the authoritative seat projection for live, settlement and final scoreboards. */
export function buildDrawGuessScoreboardRows(
  viewModel: DrawGuessViewModel,
  effectiveSeat: number | null,
  readScores: (seat: number) => {
    readonly roundScore: number | null;
    readonly totalScore: number;
  },
): DrawGuessScoreboardRow[] {
  return viewModel.seats.map((seat) => ({
    seat: seat.seat,
    displayName: seat.displayName,
    isBot: seat.isBot,
    isDrawer: seat.isDrawer,
    isSelf: seat.seat === effectiveSeat,
    ...readScores(seat.seat),
  }));
}

interface DrawGuessScoreboardProps {
  readonly title: string;
  /** 按竞赛排名展示（同分并列，下一名次跳过）；false 则只按得分降序。 */
  readonly competitionRanking: boolean;
  readonly rows: readonly DrawGuessScoreboardRow[];
  readonly reactionCountLabel?: string;
}

function rankLabel(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `第${rank}名`;
}

/** 总分榜：结算行显示本轮加分与总分，终局行只显示总分；自己一行高亮。 */
export function DrawGuessScoreboard({
  title,
  competitionRanking,
  rows,
  reactionCountLabel,
}: DrawGuessScoreboardProps) {
  const ranked = competitionRanking
    ? rankDrawGuessScores(rows)
    : rows
        .toSorted((a, b) => b.totalScore - a.totalScore)
        .map((row, index) => ({ ...row, rank: index + 1 }));
  return (
    <RoomRanking
      title={title}
      rows={ranked.map((row) => ({
        seat: row.seat,
        rank: row.rank,
        rankLabel: competitionRanking ? rankLabel(row.rank) : `${row.rank}`,
        displayName: `${row.displayName}${row.isBot ? ` · ${DRAWGUESS_BOT_TAG}` : ''}${row.isDrawer ? ' · 画手' : ''}`,
        isSelf: row.isSelf,
        detail:
          row.reactionCounts !== undefined && reactionCountLabel !== undefined
            ? `${reactionCountLabel}：${formatDrawGuessReactionCounts(row.reactionCounts)}`
            : null,
        value:
          row.roundScore === null
            ? formatDrawGuessScore(row.totalScore)
            : `+${row.roundScore} · 总分 ${row.totalScore}`,
      }))}
    />
  );
}
