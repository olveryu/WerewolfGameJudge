/** Secret Hitler role, policy and information rules. */

import { createSeededRng, randomPick, shuffleArray } from '../../../platform/random';
import type {
  SecrethitlerFaction,
  SecrethitlerPolicy,
  SecrethitlerPower,
  SecrethitlerRole,
  SecrethitlerState,
  SecrethitlerVote,
} from '../state/types';

/** Resolves the public tally and outcome using the same votes as settlement. */
export function tallySecrethitlerVotes(
  livingSeats: readonly number[],
  votes: Readonly<Record<number, SecrethitlerVote>>,
) {
  const revealedVotes = livingSeats.map((seat) => ({
    seat,
    vote: votes[seat] ?? 'nein',
  }));
  const yesCount = revealedVotes.filter(({ vote }) => vote === 'ja').length;
  const noCount = revealedVotes.length - yesCount;
  return { votes: revealedVotes, yesCount, noCount, passed: yesCount > noCount };
}

/** Returns the presidential power for a normally enacted fascist policy. */
export function getSecrethitlerPolicyPower(
  numberOfPlayers: number,
  policyNumber: number,
): SecrethitlerPower | null {
  getSecrethitlerRoleCounts(numberOfPlayers);
  if (!Number.isInteger(policyNumber) || policyNumber < 1 || policyNumber > 6)
    throw new Error(`Unsupported Secret Hitler policy number: ${policyNumber}`);
  if ((policyNumber === 1 && numberOfPlayers >= 9) || (policyNumber === 2 && numberOfPlayers >= 7))
    return 'investigate';
  if (policyNumber === 3) return numberOfPlayers <= 6 ? 'policyPeek' : 'specialElection';
  if (policyNumber === 4 || policyNumber === 5) return 'execute';
  return null;
}

const LIBERAL_ROLE_COUNTS: Readonly<Record<number, number>> = {
  5: 3,
  6: 4,
  7: 4,
  8: 5,
  9: 5,
  10: 6,
};

const FASCIST_ROLE_COUNTS: Readonly<Record<number, number>> = {
  5: 1,
  6: 1,
  7: 2,
  8: 2,
  9: 3,
  10: 3,
};

/** Returns the exact standard role count for a supported game size. */
export function getSecrethitlerRoleCounts(numberOfPlayers: number): {
  readonly liberal: number;
  readonly fascist: number;
  readonly hitler: 1;
} {
  const liberal = LIBERAL_ROLE_COUNTS[numberOfPlayers];
  const fascist = FASCIST_ROLE_COUNTS[numberOfPlayers];
  if (liberal === undefined || fascist === undefined)
    throw new Error(`Unsupported Secret Hitler player count: ${numberOfPlayers}`);
  return { liberal, fascist, hitler: 1 };
}

/** Deals roles in seat order using the command's deterministic random seed. */
export function dealSecrethitlerIdentities(
  state: SecrethitlerState,
  randomSeed: string,
): Readonly<Record<number, SecrethitlerRole>> {
  const roles = getSecrethitlerRoleCounts(state.config.numberOfPlayers);
  const deck: SecrethitlerRole[] = [
    ...Array.from({ length: roles.liberal }, () => 'liberal' as const),
    ...Array.from({ length: roles.fascist }, () => 'fascist' as const),
    'hitler',
  ];
  const shuffled = shuffleArray(deck, createSeededRng(`${randomSeed}:secrethitler-roles`));
  const identities: Record<number, SecrethitlerRole> = {};
  for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
    if (state.roster[seat] != null) {
      const role = shuffled[seat];
      if (role === undefined) throw new Error('Secret Hitler role deck did not fill every seat');
      identities[seat] = role;
    }
  }
  return identities;
}

/** Creates and shuffles the standard six liberal and eleven fascist policies. */
export function createSecrethitlerPolicyDeck(randomSeed: string): readonly SecrethitlerPolicy[] {
  const policies: SecrethitlerPolicy[] = [
    ...Array.from({ length: 6 }, () => 'liberal' as const),
    ...Array.from({ length: 11 }, () => 'fascist' as const),
  ];
  return shuffleArray(policies, createSeededRng(`${randomSeed}:secrethitler-policies`));
}

/** Returns the faction represented by a role. */
export function getSecrethitlerFaction(role: SecrethitlerRole): SecrethitlerFaction {
  return role === 'liberal' ? 'liberal' : 'fascist';
}

/** Seats this viewer is allowed to recognize as fellow fascists during first night. */
export function getKnownFascistSeats(
  state: SecrethitlerState,
  viewerSeat: number,
): readonly number[] {
  const role = state.identities[viewerSeat];
  if (role === undefined || role === 'liberal') return [];
  if (role === 'hitler' && state.config.numberOfPlayers > 6) return [];
  return Object.entries(state.identities)
    .map(([seat, identity]) => ({ seat: Number(seat), identity }))
    .filter(({ seat, identity }) => seat !== viewerSeat && identity !== 'liberal')
    .map(({ seat }) => seat)
    .sort((left, right) => left - right);
}

/** Seats that must explicitly acknowledge their authorized first-night information. */
export function getSecrethitlerNightParticipants(state: SecrethitlerState): readonly number[] {
  return Object.entries(state.identities)
    .filter(
      ([, role]) => role === 'fascist' || (role === 'hitler' && state.config.numberOfPlayers <= 6),
    )
    .map(([seat]) => Number(seat));
}

/** Chooses the opening president from occupied seats with a stable seed. */
export function chooseSecrethitlerFirstPresident(
  state: SecrethitlerState,
  randomSeed: string,
): number {
  const seats = Object.entries(state.roster)
    .filter(([, occupant]) => occupant != null)
    .map(([seat]) => Number(seat))
    .sort((left, right) => left - right);
  return randomPick(seats, createSeededRng(`${randomSeed}:secrethitler-president`));
}
