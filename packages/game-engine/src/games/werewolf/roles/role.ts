import type { StepContextBase, StepDefinition } from '../../../platform/steps';
import type { WerewolfRoleContext } from './context';
import type { AttackCause, DeathEffect } from './deathEffects';
import type { IdentityLayer } from './identity';
import type { LocationLayer, TargetSelection } from './location';
import type { PresenceDeclaration } from './presence';
import type { SightLayer } from './sight';

export type WerewolfRoleFaction = 'god' | 'villager' | 'wolf' | 'special';
export type WerewolfRoleTeam = 'good' | 'wolf' | 'third';

export interface WerewolfRoleCard {
  readonly name: string;
  readonly shortName: string;
  readonly emoji: string;
  readonly description: string;
}

export interface WerewolfRoleState {
  readonly identities: IdentityLayer<string>;
  readonly location: LocationLayer;
  readonly sight: SightLayer<string>;
  readonly seatedSeats: readonly number[];
  readonly nightNumber: number;
  readonly usedAbilities: readonly { readonly roleId: string; readonly seat: number }[];
  readonly disabledAbilities: readonly { readonly roleId: string; readonly seat: number }[];
  readonly previousTargets: readonly {
    readonly roleId: string;
    readonly actorSeat: number;
    readonly targetSeat: number;
  }[];
  readonly previousCards: readonly {
    readonly roleId: string;
    readonly actorSeat: number;
    readonly cardIndex: number;
  }[];
  readonly woundedSeats: readonly number[];
}

export interface RoleSelection extends TargetSelection {
  readonly roleId: string;
  readonly actorSeat: number;
}

export interface WerewolfNightFacts {
  readonly selections: readonly RoleSelection[];
  readonly identityChanges: readonly WerewolfRoleIdentityChange[];
  readonly cardSelections: readonly {
    readonly roleId: string;
    readonly actorSeat: number;
    readonly cardIndex: number;
  }[];
  readonly disabledAbilities: readonly { readonly roleId: string; readonly seat: number }[];
  readonly deathEffects: readonly DeathEffect[];
}

export type WerewolfRoleStepResult =
  | {
      readonly kind: 'factionCheck';
      readonly chosenSeat: number;
      readonly landingSeat: number;
      readonly faction: 'good' | 'wolf';
    }
  | {
      readonly kind: 'identityCheck';
      readonly chosenSeat: number;
      readonly landingSeat: number;
      readonly roleId: string;
    }
  | {
      readonly kind: 'cardSelection';
      readonly roleId: string;
    };

export type WerewolfRoleIdentityChange =
  | {
      readonly kind: 'replaceCurrentRole';
      readonly seat: number;
      readonly roleId: string;
    }
  | {
      readonly kind: 'grantBorrowedAbility';
      readonly seat: number;
      readonly roleId: string;
    };

export interface WerewolfBottomCard {
  readonly index: number;
  readonly label: string;
  readonly unavailableReason: string | null;
  readonly roleId: string;
  readonly faction: WerewolfRoleFaction;
}

export interface WerewolfRoleStepContext extends StepContextBase<
  WerewolfRoleState,
  WerewolfNightFacts,
  WerewolfRoleStepResult
> {
  readonly role: WerewolfRoleContext<string>;
  readonly teamOfRole: (roleId: string) => WerewolfRoleTeam;
  readonly roleNameOf: (roleId: string) => string;
  readonly randomBoolean: () => boolean;
  readonly canShootAtNight: (seat: number, roleId: string) => boolean;
  readonly avengerFactionOf: (seat: number) => 'good' | 'wolf' | 'bonded';
  readonly bottomCardsOf: (seat: number, roleId: string) => readonly WerewolfBottomCard[];
}

export interface WerewolfRoleResource {
  readonly kind: string;
  readonly uses: number;
  readonly refreshPerNight: boolean;
}

export interface WerewolfRoleDefinition<TId extends string = string> {
  readonly id: TId;
  readonly card: WerewolfRoleCard;
  readonly traits: {
    readonly faction: WerewolfRoleFaction;
    readonly team: WerewolfRoleTeam;
    readonly displayAs?: string;
    readonly recognition?: {
      readonly canSeeWolves: boolean;
      readonly participatesInWolfVote: boolean;
      readonly actsSolo?: boolean;
    };
    readonly immunities?: readonly AttackCause[];
  };
  readonly steps: readonly StepDefinition<
    string,
    WerewolfRoleStepContext,
    WerewolfNightFacts,
    WerewolfRoleStepResult
  >[];
  readonly nightSchedule?: 'firstNight' | 'everyNight';
  readonly oneUseOnSuccess?: boolean;
  readonly resources?: readonly WerewolfRoleResource[];
  readonly passiveDeathEffects?: (
    context: WerewolfRoleStepContext,
    seat: number,
  ) => readonly DeathEffect[];
  readonly presence?: PresenceDeclaration<TId>;
}

export function defineRole<const TRole extends WerewolfRoleDefinition>(role: TRole): TRole {
  return role;
}
