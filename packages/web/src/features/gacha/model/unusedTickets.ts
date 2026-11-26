/** The draw balances that make up the user's unused gacha tickets. */
export interface DrawBalances {
  readonly normalDraws: number;
  readonly goldenDraws: number;
}

/** The unused gacha tickets every ticket badge counts: normal and golden draws together. */
export function countUnusedTickets(balances: DrawBalances): number {
  return balances.normalDraws + balances.goldenDraws;
}
