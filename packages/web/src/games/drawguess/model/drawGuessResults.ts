/**
 * 你画我猜的结果呈现：房间内计分板与本局复盘共用的一份竞赛排名、得分文案、
 * 机器人标注与全员猜中清零说明。
 */

/** 机器人席位在榜单上的标注。 */
export const DRAWGUESS_BOT_TAG = '机器人';

/** 全员猜中致画手本轮收入清零：提示的标题。 */
export const DRAWGUESS_DRAWER_ZEROED_TITLE = '全员猜中';

/** 全员猜中致画手本轮收入清零：提示的说明。 */
export const DRAWGUESS_DRAWER_ZEROED_DETAIL = '画得太简单了，画手本轮 0 分';

/** 榜单得分文案，如「120 分」。 */
export function formatDrawGuessScore(score: number): string {
  return `${score} 分`;
}

/** 按总分降序排列；同分并列，下一名次顺延（竞赛排名 1、2、2、4），并列者保持传入顺序。 */
export function rankDrawGuessScores<TEntry extends { readonly totalScore: number }>(
  entries: readonly TEntry[],
): readonly (TEntry & { readonly rank: number })[] {
  const sorted = [...entries].sort((a, b) => b.totalScore - a.totalScore);
  let rank = 0;
  let previousScore: number | null = null;
  return sorted.map((entry, index) => {
    if (previousScore === null || entry.totalScore !== previousScore) rank = index + 1;
    previousScore = entry.totalScore;
    return { ...entry, rank };
  });
}
