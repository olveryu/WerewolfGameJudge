import type { FashionRoleId, FashionState } from '../state/types';

export interface FashionVictoryResult {
  readonly winners: readonly number[];
}

function seatsWithRole(state: FashionState, role: FashionRoleId): number[] {
  return Object.entries(state.roles)
    .filter(([, roleId]) => roleId === role)
    .map(([seat]) => Number(seat));
}

function hasAnyPublicEvidence(state: FashionState): boolean {
  return state.publicEvidence.length >= 2;
}

function villainConvicted(state: FashionState): boolean {
  const villainSeats = seatsWithRole(state, 'villainProcurementDirector');
  return villainSeats.some((seat) => state.finalVotes[seat] !== undefined);
}

/**
 * Domain-only victory evaluation. The evaluator consumes authoritative state
 * and is intentionally independent from UI projections.
 */
export function evaluateFashionVictory(state: FashionState): FashionVictoryResult {
  const villainSeats = seatsWithRole(state, 'villainProcurementDirector');

  if (!villainConvicted(state)) {
    return { winners: villainSeats };
  }

  const winners: number[] = [];
  const civicAndBusinessRoles: FashionRoleId[] = [
    'journalist',
    'governmentOfficial',
    'consumerRepresentative',
    'brandExecutive',
  ];

  for (const role of civicAndBusinessRoles) {
    winners.push(...seatsWithRole(state, role));
  }

  // Factory/supplier victory depends on the investigation outcome and
  // successful resolution of their contract path.
  if (hasAnyPublicEvidence(state)) {
    winners.push(...seatsWithRole(state, 'factoryWorker'));
    winners.push(...seatsWithRole(state, 'supplierOwner'));
  }

  return { winners: [...new Set(winners)].sort((a, b) => a - b) };
}
