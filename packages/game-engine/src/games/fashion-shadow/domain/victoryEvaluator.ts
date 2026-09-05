import type { FashionRoleId, FashionState } from '../state/types';

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

function isVillainConvicted(state: FashionState): boolean {
  const villains = new Set(villainSeats(state));
  const votes = Object.values(state.finalVotes);
  return votes.some((target) => villains.has(target));
}

function hasRevealedSecret(state: FashionState, role: FashionRoleId): boolean {
  return seatsWithRole(state, role).some((seat) => state.revealedSecrets[seat] !== undefined);
}

/**
 * 合同结算判定（仅在整个判定已排除 villainWon 分支后调用，即反派已被定罪）。
 * 工人（factoryWorker）的 victoryCondition（见 domain/content.ts）：
 * 「成功与买家签订契约卡；最终结算时买家获胜且契约卡生效」。
 * 本实现收敛为当前可判定的子集：以该工人为卖方、且已被买家接受的契约视为生效
 * （accepted = 买家已同意；fulfilled = 已履行完毕，同样生效）。
 * TODO(product): 「买家获胜」需跨角色递归判定，仓库内无规则文档，暂未绑定。
 */
function workerContractSettles(state: FashionState, seat: number): boolean {
  return state.contracts.some(
    (contract) =>
      contract.sellerSeat === seat &&
      (contract.status === 'accepted' || contract.status === 'fulfilled'),
  );
}

/**
 * Domain-only victory evaluation. The evaluator consumes authoritative state
 * and is independent from UI projections.
 */
export function evaluateFashionVictory(state: FashionState): FashionVictoryResult {
  const winners: number[] = [];
  const villainWon = !isVillainConvicted(state);

  if (villainWon) {
    winners.push(...villainSeats(state));
    return { winners };
  }

  if (state.publicEvidence.length >= 2) {
    winners.push(...seatsWithRole(state, 'journalist'));
  }

  if (!hasRevealedSecret(state, 'governmentOfficial')) {
    winners.push(...seatsWithRole(state, 'governmentOfficial'));
  }

  if (!hasRevealedSecret(state, 'consumerRepresentative')) {
    winners.push(...seatsWithRole(state, 'consumerRepresentative'));
  }

  if (!hasRevealedSecret(state, 'brandExecutive')) {
    winners.push(...seatsWithRole(state, 'brandExecutive'));
  }

  winners.push(...seatsWithRole(state, 'supplierOwner').filter(() => !hasRevealedSecret(state, 'supplierOwner')));

  // 合同结算：仅持有自身为卖方且生效契约的工人获胜（见 workerContractSettles）。
  winners.push(
    ...seatsWithRole(state, 'factoryWorker').filter((seat) => workerContractSettles(state, seat)),
  );

  return { winners: [...new Set(winners)].sort((a, b) => a - b) };
}
