/**
 * 阿瓦隆对局记录口径：对局记录浮层（AvalonRecord* 共享件）、房间摘要与
 * 本局复盘文档读同一份文案，不各写一份——投票模式、任务人数、任务结论
 * 与牌面、提案票数、终局时没有任务结论的轮（否决终局 / 被提前刺杀打断）、
 * 湖仙查验句与未发生原因。
 */

import {
  AVALON_QUEST_SIZES,
  type AvalonLadyCheckRecordView,
  type AvalonPlay,
  type AvalonPlayerCount,
  type AvalonProposalRecordView,
  type AvalonQuestRecord,
  type AvalonRoundRecordView,
  type AvalonVoteMode,
} from '@game-judge/game-engine/games/avalon/public';

/** 组队投票模式：公投 / 暗投。 */
export function formatAvalonVoteMode(voteMode: AvalonVoteMode): string {
  return voteMode === 'public' ? '公投' : '暗投';
}

/** 五轮任务人数「3 / 4 / 4 / 5 / 5」。 */
export function formatAvalonQuestSizes(playerCount: AvalonPlayerCount): string {
  return AVALON_QUEST_SIZES[playerCount].join(' / ');
}

/** 任务结论：成功 / 失败。 */
export const AVALON_QUEST_RESULT_LABELS: Readonly<Record<AvalonQuestRecord['result'], string>> = {
  success: '成功',
  fail: '失败',
};

/** 任务牌面：成功牌 / 失败牌（只有张数，出牌人永不揭晓）。 */
export const AVALON_QUEST_CARD_LABELS: Readonly<Record<AvalonPlay, string>> = {
  success: '成功牌',
  fail: '失败牌',
};

/** 提案票数「赞成 4 · 反对 1」，有弃权时追加「 · 弃权 N」。 */
export function formatAvalonVoteTally(
  proposal: Pick<AvalonProposalRecordView, 'approveCount' | 'rejectCount' | 'abstainCount'>,
): string {
  const abstain = proposal.abstainCount > 0 ? ` · 弃权 ${proposal.abstainCount}` : '';
  return `赞成 ${proposal.approveCount} · 反对 ${proposal.rejectCount}${abstain}`;
}

/** 否决终局轮的结论：组队失败。 */
export const AVALON_VETO_ENDED_LABEL = '组队失败';

/** 否决终局轮的说明「N 次否决达上限，本轮无任务」。 */
export function formatAvalonVetoEndedNote(proposalCount: number): string {
  return `${proposalCount} 次否决达上限，本轮无任务`;
}

/** 终局时仍未结算的轮：未完成（被打断，不是进行中）。 */
export const AVALON_INTERRUPTED_LABEL = '未完成';

/** 未完成轮的说明：否决终局另有结论，走到这里的只能是提前刺杀。 */
export const AVALON_INTERRUPTED_NOTE = '提前刺杀打断，无结算结果';

/** 已完成查验的公开句「2 号查验了 4 号」：查验结果不在句中。 */
export function formatAvalonLadyCheck(check: AvalonLadyCheckRecordView): string {
  return `${check.holderSeat + 1} 号查验了 ${check.targetSeat + 1} 号`;
}

/** 查验后的 token 移交「→ 新持有人 4 号」：新持有人即被查验者。 */
export function formatAvalonLadyHandover(check: AvalonLadyCheckRecordView): string {
  return `→ 新持有人 ${check.targetSeat + 1} 号`;
}

/**
 * 终局时未发生的湖仙查验「未发生（原因）」，原因按该轮记录推导：没有
 * 记录（任务未开始）/ 否决达上限终局 / 本轮结算后即终局（湖仙未轮到）/
 * 未结算轮被提前刺杀打断。未 acknowledge 即终局的查验不进公开历史，
 * 同按未发生处理，不写成已完成。
 */
export function formatAvalonLadySkipped(record: AvalonRoundRecordView | undefined): string {
  const reason =
    record === undefined
      ? '任务未开始'
      : record.vetoEnded
        ? '否决达上限终局'
        : record.quest !== null
          ? '本轮结算后即终局，湖仙未进行'
          : '提前刺杀打断';
  return `未发生（${reason}）`;
}
