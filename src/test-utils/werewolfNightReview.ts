/**
 * Review-oriented Werewolf GameState fixtures for client tests.
 *
 * The night-report components render the engine's review projection, so
 * tests build a complete GameState here and call getWerewolfNightReview;
 * players are given as a seat map for fixture brevity.
 */

import type {
  GameState,
  Player,
  RoleId,
  SheriffElectionResult,
  SheriffElectionState,
} from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import { buildWerewolfTestState } from './werewolfState';

export type ReviewPlayers = Map<number, Player | null>;

export function makeReviewPlayer(seat: number, role: RoleId | null): Player {
  return { seat, role };
}

export interface ReviewStateOverrides {
  readonly currentNightResults?: NonNullable<GameState['currentNightResults']>;
  readonly lastNightDeaths?: number[];
  readonly deathReasons?: GameState['deathReasons'];
  readonly players?: ReviewPlayers;
  readonly seerReveal?: GameState['seerReveal'];
  readonly bottomCards?: GameState['bottomCards'];
  readonly sheriffElection?: SheriffElectionState;
  readonly sheriffElectionResult?: SheriffElectionResult;
  readonly resolvedWolfKillTarget?: number | null;
  readonly resolvedWolfKillVerdict?: GameState['resolvedWolfKillVerdict'];
  readonly roleRevealRandomNonce?: string;
}

/** A settled (Day) GameState carrying only the review-relevant facts. */
export function makeReviewState(overrides: ReviewStateOverrides = {}): GameState {
  const players = overrides.players ?? new Map<number, Player | null>();
  const playersRecord: Record<number, Player | null> = {};
  const roster: Record<number, GameState['roster'][number]> = {};
  for (const [seat, player] of players) {
    playersRecord[seat] = player;
    if (player)
      roster[seat] = { seat, userId: `uid-${seat}`, profile: { displayName: `P${seat}` } };
  }
  const optional: Partial<GameState> = {};
  if (overrides.deathReasons) optional.deathReasons = overrides.deathReasons;
  if (overrides.seerReveal) optional.seerReveal = overrides.seerReveal;
  if (overrides.bottomCards) optional.bottomCards = overrides.bottomCards;
  if (overrides.sheriffElection) optional.sheriffElection = overrides.sheriffElection;
  if (overrides.sheriffElectionResult) {
    optional.sheriffElectionResult = overrides.sheriffElectionResult;
  }
  if (overrides.resolvedWolfKillTarget !== undefined) {
    optional.resolvedWolfKillTarget = overrides.resolvedWolfKillTarget;
  }
  if (overrides.resolvedWolfKillVerdict !== undefined) {
    optional.resolvedWolfKillVerdict = overrides.resolvedWolfKillVerdict;
  }
  if (overrides.roleRevealRandomNonce) {
    optional.roleRevealRandomNonce = overrides.roleRevealRandomNonce;
  }
  return buildWerewolfTestState({
    status: GameStatus.Day,
    players: playersRecord,
    roster,
    currentNightResults: overrides.currentNightResults ?? {},
    lastNightDeaths: overrides.lastNightDeaths ?? [],
    ...optional,
  });
}
