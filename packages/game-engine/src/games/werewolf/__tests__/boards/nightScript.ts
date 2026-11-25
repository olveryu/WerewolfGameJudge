import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

/** What one role does in a scenario: a seat, a skip (`null`), or a role-specific shape. */
export type NightAction =
  | number
  | null
  | { readonly save: number | null; readonly poison: number | null }
  | { readonly targets: readonly number[] }
  | { readonly confirmed: boolean }
  | { readonly cardIndex: number };

/** Role-keyed choices for one night; `wolf` is the shared pack vote. */
export type NightActions = Partial<Record<RoleId, NightAction>>;
