import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

export type NightAction =
  | number
  | null
  | { readonly save: number | null; readonly poison: number | null }
  | { readonly targets: readonly number[] }
  | { readonly confirmed: boolean }
  | { readonly cardIndex: number };

export type NightActions = Partial<Record<RoleId, NightAction>>;

export interface NightDeal {
  readonly seats: readonly { readonly seat: number; readonly role: RoleId }[];
  readonly templateRoles: readonly RoleId[];
  readonly bottomCards: readonly RoleId[];
  readonly seerLabelMap: Readonly<Record<string, number>>;
  readonly witchCanSelfHeal: boolean;
}
