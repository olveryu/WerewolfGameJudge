import type {
  FashionEvidenceId,
  FashionInvestigationVoteRecord,
  FashionRoleId,
  FashionState,
} from '../state/types';
import { FASHION_ROUND_BY_NUMBER } from './content';

export interface FashionVictoryResult {
  readonly winners: readonly number[];
}

function seatsWithRole(state: FashionState, role: FashionRoleId): number[] {
  return Object.entries(state.roles)
    .filter(([, roleId]) => roleId === role)
    .map(([seat]) => Number(seat));
}

function villainSeats(state: FashionState): readonly number[] {
  return seatsWithRole(state, 'villainProcurementDirector');
}

function getFinalAccusedSeat(state: FashionState): number | null {
  const counts = new Map<number, number>();
  for (const targetSeat of Object.values(state.finalVotes)) {
    counts.set(targetSeat, (counts.get(targetSeat) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  let highestCount = 0;
  let highestSeats: number[] = [];
  for (const [seat, count] of counts) {
    if (count > highestCount) {
      highestCount = count;
      highestSeats = [seat];
    } else if (count === highestCount) {
      highestSeats.push(seat);
    }
  }
  return highestSeats.length === 1 ? highestSeats[0]! : null;
}

function isVillainConvicted(state: FashionState): boolean {
  if (state.publicEvidence.length < 2) return false;
  const accusedSeat = getFinalAccusedSeat(state);
  return accusedSeat !== null && villainSeats(state).includes(accusedSeat);
}

function voteHistoryForSeat(
  state: FashionState,
  seat: number,
): readonly FashionInvestigationVoteRecord[] {
  return state.investigationVoteHistory.filter((record) => record.seat === seat);
}

function governmentOfficialWins(
  state: FashionState,
  seat: number,
  villainConvicted: boolean,
): boolean {
  if (state.revealedSecrets[seat] !== undefined) return false;
  const history = voteHistoryForSeat(state, seat);
  if (history.length !== 4 || new Set(history.map((record) => record.round)).size !== 4)
    return false;

  const approveCount = history.filter((record) => record.vote === 'approve').length;
  const rejectCount = history.length - approveCount;
  let expectsConviction: boolean;
  if (approveCount === rejectCount) {
    const finalTarget = state.finalVotes[seat];
    if (finalTarget === undefined) return false;
    expectsConviction = villainSeats(state).includes(finalTarget);
  } else {
    expectsConviction = approveCount > rejectCount;
  }
  return expectsConviction === villainConvicted;
}

function supplierOwnerWins(state: FashionState, seat: number, villainConvicted: boolean): boolean {
  if (state.revealedSecrets[seat] !== undefined) return false;
  const history = voteHistoryForSeat(state, seat);
  const lastVote = history[history.length - 1];
  if (lastVote === undefined) return false;
  return (lastVote.vote === 'approve') === villainConvicted;
}

function evidenceImplicatesRole(evidenceId: FashionEvidenceId, roleId: FashionRoleId): boolean {
  return Object.values(FASHION_ROUND_BY_NUMBER).some(
    (round) => round.evidenceId === evidenceId && round.implicatedRoles.includes(roleId),
  );
}

function evaluateBaseWinners(state: FashionState, villainConvicted: boolean): number[] {
  const winners: number[] = [];

  if (villainConvicted) {
    winners.push(...seatsWithRole(state, 'journalist'));
  } else {
    winners.push(...villainSeats(state));
  }

  winners.push(
    ...seatsWithRole(state, 'governmentOfficial').filter((seat) =>
      governmentOfficialWins(state, seat, villainConvicted),
    ),
  );

  winners.push(
    ...seatsWithRole(state, 'consumerRepresentative').filter(
      (seat) =>
        state.crossExamAwards.some((award) => award.seat === seat) &&
        state.revealedSecrets[seat] === undefined,
    ),
  );

  if (
    villainConvicted &&
    !state.publicEvidence.some((evidenceId) => evidenceImplicatesRole(evidenceId, 'brandExecutive'))
  ) {
    winners.push(...seatsWithRole(state, 'brandExecutive'));
  }

  winners.push(
    ...seatsWithRole(state, 'supplierOwner').filter((seat) =>
      supplierOwnerWins(state, seat, villainConvicted),
    ),
  );

  return winners;
}

function workerContractSettles(
  state: FashionState,
  workerSeat: number,
  baseWinners: ReadonlySet<number>,
): boolean {
  return state.contracts.some(
    (contract) =>
      contract.sellerSeat === workerSeat &&
      contract.status !== 'proposed' &&
      baseWinners.has(contract.buyerSeat),
  );
}

/** Domain-only victory evaluation over authoritative state. */
export function evaluateFashionVictory(state: FashionState): FashionVictoryResult {
  const villainConvicted = isVillainConvicted(state);
  const baseWinners = evaluateBaseWinners(state, villainConvicted);
  const baseWinnerSet = new Set(baseWinners);
  const contractWinners = seatsWithRole(state, 'factoryWorker').filter((seat) =>
    workerContractSettles(state, seat, baseWinnerSet),
  );

  return {
    winners: [...new Set([...baseWinners, ...contractWinners])].sort((left, right) => left - right),
  };
}
