/**
 * 阿瓦隆房间交互策略：纯函数 policy 层（input → Instruction）。
 *
 * No side effects: no alerts, no navigation, no services, no hooks.
 * Orchestrators (hooks / screen) call these policies and execute the
 * returned instructions; presentational components only render them.
 */

import {
  type AvalonBallot,
  type AvalonEndReason,
  type AvalonPhase,
  type AvalonPlay,
  type AvalonViewModel,
  isAvalonGoodRole,
} from '@game-judge/game-engine/games/avalon/public';

/** Workspace content the RoomShell should render for an in-game phase. */
/** 晚上走 kind: 'seats' + 确认弹窗（对齐狼人杀丘比特），不进 workspace。 */
export type AvalonStageContentKind = 'nominate' | 'vote' | 'quest' | 'lady' | 'assassin' | 'ended';

/**
 * Maps an authoritative phase to the workspace content kind.
 * Lobby is rendered as the seats board by the screen shell, never here.
 * Night is rendered as the seats board + confirm modal (Cupid pattern), never here.
 * @throws when called with the lobby or night phase (caller error, fail fast).
 */
export function resolveAvalonStageKind(phase: AvalonPhase): AvalonStageContentKind {
  switch (phase.kind) {
    case 'lobby':
      throw new Error('[FAIL-FAST] Avalon workspace received the lobby phase');
    case 'night':
      throw new Error('[FAIL-FAST] Avalon workspace received the night phase');
    case 'nominate':
      return 'nominate';
    case 'vote':
      return 'vote';
    case 'quest':
      return 'quest';
    case 'lady':
      return 'lady';
    case 'assassin':
      return 'assassin';
    case 'ended':
      return 'ended';
  }
}

export type AvalonNightInstruction =
  | {
      readonly kind: 'evilPeers';
      readonly peers: readonly number[];
      /** 奥伯伦：互认环节看不到任何人。 */
      readonly isAlone: boolean;
    }
  | { readonly kind: 'merlin'; readonly sees: readonly number[] }
  | { readonly kind: 'percival'; readonly sees: readonly number[] }
  | { readonly kind: 'confirmed' }
  | { readonly kind: 'waiting' };

/**
 * What the night card should show for this viewer (view model is already
 * cropped by the engine per the viewer's role; UI-level privacy, D6-Q1).
 */
export function resolveNightInstruction(viewModel: AvalonViewModel): AvalonNightInstruction {
  if (viewModel.nightStep === null) return { kind: 'waiting' };
  if (viewModel.nightConfirmed) return { kind: 'confirmed' };
  if (viewModel.evilPeers !== null)
    return {
      kind: 'evilPeers',
      peers: viewModel.evilPeers,
      isAlone: viewModel.evilPeers.length === 0,
    };
  if (viewModel.merlinSees !== null) return { kind: 'merlin', sees: viewModel.merlinSees };
  if (viewModel.percivalSees !== null) return { kind: 'percival', sees: viewModel.percivalSees };
  return { kind: 'waiting' };
}

export interface AvalonNominateInstruction {
  readonly isLeader: boolean;
  readonly leaderSeat: number;
  readonly requiredSize: number;
}

/**
 * Leader nomination gating.
 * @throws when the view model carries no nominate data (caller error, fail fast).
 */
export function resolveNominateInstruction(
  viewModel: AvalonViewModel,
  mySeat: number | null,
): AvalonNominateInstruction {
  const { leaderSeat, requiredSize } = viewModel;
  if (leaderSeat === null || requiredSize === null)
    throw new Error('[FAIL-FAST] Avalon nominate instruction without nominate data');
  return {
    isLeader: mySeat !== null && mySeat === leaderSeat,
    leaderSeat,
    requiredSize,
  };
}

export interface AvalonVoteCounts {
  readonly approve: number;
  readonly reject: number;
  readonly abstain: number;
}

export interface AvalonVoteInstruction {
  readonly canVote: boolean;
  readonly myBallot: AvalonBallot | null;
  /** 公投模式亮票后全员可见；暗投为 null（D7）。 */
  readonly ballots: Readonly<Record<number, AvalonBallot>> | null;
  readonly voteCounts: AvalonVoteCounts | null;
}

/** Voting card state: ballot input plus what the settlement panel may reveal. */
export function resolveVoteInstruction(viewModel: AvalonViewModel): AvalonVoteInstruction {
  return {
    canVote: viewModel.mySeat !== null,
    myBallot: viewModel.myBallot,
    ballots: viewModel.ballots,
    voteCounts: viewModel.voteCounts,
  };
}

export interface AvalonQuestInstruction {
  readonly isTeamMember: boolean;
  readonly myPlay: AvalonPlay | null;
  /** 好人只看到成功卡（D17）；坏人看到成功/失败两张；旁观者无卡。 */
  readonly availableCards: readonly AvalonPlay[];
}

/** Secret quest play: card visibility is cropped by the viewer's faction. */
export function resolveQuestInstruction(viewModel: AvalonViewModel): AvalonQuestInstruction {
  const myRole = viewModel.myRole;
  return {
    isTeamMember:
      viewModel.mySeat !== null &&
      viewModel.teamSeats !== null &&
      viewModel.teamSeats.includes(viewModel.mySeat),
    myPlay: viewModel.myPlay,
    availableCards:
      myRole === null
        ? []
        : isAvalonGoodRole(myRole)
          ? ['success']
          : (['success', 'fail'] as const),
  };
}

export type AvalonLadyInstruction =
  | { readonly kind: 'holderPick'; readonly eligibleSeats: readonly number[] }
  | { readonly kind: 'holderWait'; readonly targetSeat: number }
  | { readonly kind: 'targetConfirm'; readonly holderSeat: number }
  | { readonly kind: 'watching'; readonly holderSeat: number; readonly targetSeat: number | null }
  | {
      readonly kind: 'result';
      readonly targetSeat: number;
      readonly faction: 'good' | 'evil';
    };

/**
 * Lady-of-the-lake flow for this viewer. Inside the lady phase the phase
 * data drives pick / wait / confirm / watching; after the phase the last
 * check result (holder-only in the view model) resolves to `result`.
 * @throws when the view model carries neither lady data nor a check
 * result (caller error, fail fast).
 */
export function resolveLadyInstruction(viewModel: AvalonViewModel): AvalonLadyInstruction {
  const lady = viewModel.lady;
  if (lady === null) {
    const result = viewModel.ladyCheckResult;
    if (result === null)
      throw new Error('[FAIL-FAST] Avalon lady instruction without lady data or result');
    return { kind: 'result', targetSeat: result.targetSeat, faction: result.faction };
  }
  const mySeat = viewModel.mySeat;
  const isHolder = mySeat !== null && mySeat === lady.holderSeat;
  const isTarget = mySeat !== null && mySeat === lady.targetSeat;
  if (lady.canCheck && isHolder) {
    const eligibleSeats = viewModel.seats
      .map((seat) => seat.seat)
      .filter((seat) => seat !== lady.holderSeat && !lady.examinedSeats.includes(seat));
    return { kind: 'holderPick', eligibleSeats };
  }
  if (lady.targetSeat !== null && isTarget)
    return { kind: 'targetConfirm', holderSeat: lady.holderSeat };
  if (lady.targetSeat !== null && isHolder)
    return { kind: 'holderWait', targetSeat: lady.targetSeat };
  return { kind: 'watching', holderSeat: lady.holderSeat, targetSeat: lady.targetSeat };
}

export type AvalonAssassinInstruction =
  | { readonly kind: 'assassinPick' }
  | { readonly kind: 'evilWait' }
  | { readonly kind: 'goodWait' };

/** Assassination stage: only the assassin picks; everyone else waits (D11 不亮牌）. */
export function resolveAssassinInstruction(viewModel: AvalonViewModel): AvalonAssassinInstruction {
  if (viewModel.isAssassin) return { kind: 'assassinPick' };
  const myRole = viewModel.myRole;
  if (myRole !== null && !isAvalonGoodRole(myRole)) return { kind: 'evilWait' };
  return { kind: 'goodWait' };
}

/** 刺杀目标：除刺客自己外的任意座位（D14；指认坏人/奥伯伦也算刺错）。 */
export function eligibleStrikeTargets(viewModel: AvalonViewModel): readonly number[] {
  return viewModel.seats.map((seat) => seat.seat).filter((seat) => seat !== viewModel.mySeat);
}

export interface AvalonEndedInstruction {
  readonly winner: 'good' | 'evil';
  readonly reason: AvalonEndReason;
  readonly accusedSeat: number | null;
}

/**
 * Ended settlement content.
 * @throws when the view model carries no winner (caller error, fail fast).
 */
export function resolveEndedInstruction(viewModel: AvalonViewModel): AvalonEndedInstruction {
  if (viewModel.winner === null || viewModel.endReason === null)
    throw new Error('[FAIL-FAST] Avalon ended instruction without winner');
  return {
    winner: viewModel.winner,
    reason: viewModel.endReason,
    accusedSeat: viewModel.accusedSeat,
  };
}

/** 终局横幅文案（中文）。 */
export const AVALON_END_REASON_COPY: Readonly<
  Record<AvalonEndReason, { readonly title: string; readonly description: string }>
> = {
  threeFail: { title: '坏人获胜', description: '三个任务失败' },
  vetoLimitReached: { title: '坏人获胜', description: '单轮连续否决达到上限' },
  assassinationHit: { title: '坏人获胜', description: '刺客指认出了梅林' },
  assassinationMiss: { title: '好人获胜', description: '刺客未能找到梅林' },
  earlyAssassinationHit: { title: '坏人获胜', description: '提前刺杀命中梅林' },
  earlyAssassinationMiss: { title: '好人获胜', description: '提前刺杀失手' },
};

/** 第 N 轮文案。 */
export function formatAvalonRoundLabel(round: number): string {
  return `第 ${round} 轮`;
}
