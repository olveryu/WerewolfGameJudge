/**
 * 对局摘要条的阶段语境（「任务二 · 第1次提案」「本局结束」等）：纯公开信息，
 * 与 createAvalonCurrentStatus 拼成摘要条首行。
 */
import type { AvalonState } from '@game-judge/game-engine/games/avalon/public';

import { formatAvalonQuestLabel } from './policy/avalonInteractionPolicy';

export function createAvalonStatusContext(state: AvalonState): string | null {
  const phase = state.phase;
  switch (phase.kind) {
    case 'nominate':
    case 'vote': {
      const proposals =
        state.roundHistory.find((record) => record.round === phase.round)?.proposals.length ?? 0;
      return `${formatAvalonQuestLabel(phase.round)} · 第${Math.min(proposals + 1, state.config.vetoLimit)}次提案`;
    }
    case 'voteResult':
    case 'quest':
    case 'questResult':
      return formatAvalonQuestLabel(phase.round);
    case 'lady':
      return formatAvalonQuestLabel(phase.afterRound);
    case 'ended':
      return '本局结束';
    case 'lobby':
    case 'viewing':
    case 'night':
    case 'assassin':
      return null;
  }
}
