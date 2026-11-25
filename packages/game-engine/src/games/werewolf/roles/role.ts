import type { StepContextBase, StepDefinition } from '../../../platform/steps';
import type { ResolvedWolfKillVerdict } from '../domain/protocol/types';
import type { WerewolfStepAudio } from './audio';
import type { WerewolfRoleContext } from './context';
import type { AttackCause, DeathEffect, DeathResolution } from './deathEffects';
import type { IdentityLayer } from './identity';
import type { LocationLayer, SeatSwap, TargetSelection } from './location';
import type { NightPresenceFacts, PresenceDeclaration } from './presence';
import type { SightLayer } from './sight';

export type WerewolfRoleFaction = 'god' | 'villager' | 'wolf' | 'special';
export type WerewolfRoleTeam = 'good' | 'wolf' | 'third';
export type WerewolfCheckReaction = 'targetDeath' | 'reflect';

/** What a role can do, as the encyclopedia filters it. */
export type RoleAbilityTag =
  | 'check'
  | 'protect'
  | 'kill'
  | 'control'
  | 'link'
  | 'immune'
  | 'transform'
  | 'survive'
  | 'follow'
  | 'confirm'
  | 'none';

/** A role's description split into the sections its card shows. */
export interface RoleDescription {
  /** What the player chooses to do, its direct outcome, and the resources it owns. */
  readonly skill?: string;
  /** Always-on properties: immunities, wolf recognition, how it reads when checked. */
  readonly passive?: string;
  /** "When X happens, Y" events the player does not start as a regular action. */
  readonly trigger?: string;
  /** Limits on the role's own ability: use counts, forbidden targets, activation conditions. */
  readonly restriction?: string;
  /** Interactions with other roles, board-level rules, and edge cases. */
  readonly special?: string;
  /** A non-standard victory condition. */
  readonly winCondition?: string;
}

export interface WerewolfRoleCard {
  readonly name: string;
  readonly shortName: string;
  readonly emoji: string;
  readonly englishName?: string;
  readonly description: string;
  readonly sections: RoleDescription;
  readonly tags?: readonly RoleAbilityTag[];
}

export interface WerewolfRoleState {
  readonly identities: IdentityLayer<string>;
  readonly location: LocationLayer;
  readonly sight: SightLayer<string>;
  readonly seatedSeats: readonly number[];
  readonly rules: { readonly witchCanSelfHeal: boolean };
  readonly usedResources: readonly {
    readonly roleId: string;
    readonly seat: number;
    readonly resource: string;
  }[];
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
  readonly wolfVotes?: readonly {
    readonly actorSeat: number;
    readonly chosenSeat: number | null;
    readonly landingSeat: number | null;
  }[];
  readonly locationSwaps?: readonly SeatSwap[];
  readonly resourceUses?: readonly {
    readonly roleId: string;
    readonly seat: number;
    readonly resource: string;
  }[];
  readonly factionChanges?: readonly {
    readonly seat: number;
    readonly faction: WerewolfRoleFaction;
  }[];
  readonly wolfInfections?: readonly { readonly actorSeat: number; readonly targetSeat: number }[];
  readonly wolfGirlConfessions?: readonly {
    readonly actorSeat: number;
    readonly targetSeat: number;
  }[];
  readonly sightOverrides?: readonly { readonly seat: number; readonly roleId: string }[];
  /** Seats converted this night, with the roles they held until then. */
  readonly conversions?: readonly {
    readonly seat: number;
    readonly formerRoleIds: readonly string[];
  }[];
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
  readonly factionOfRole: (roleId: string) => WerewolfRoleFaction;
  readonly checkReactionOfRole: (roleId: string) => WerewolfCheckReaction | undefined;
  readonly doesRoleVoteWithWolves: (roleId: string) => boolean;
  readonly isWolfKillTargetForbidden: (seat: number) => boolean;
  readonly isAdjacentToWolfFaction: (seat: number) => boolean;
  readonly roleNameOf: (roleId: string) => string;
  readonly randomBoolean: () => boolean;
  readonly nightPresence: NightPresenceFacts<string>;
  readonly resolvedWolfKillTarget: number | null;
  readonly resolvedWolfKillVerdict?: ResolvedWolfKillVerdict | null;
  readonly canShootAtNight: (seat: number, roleId: string) => boolean;
  readonly avengerFactionOf: (seat: number) => 'good' | 'wolf' | 'bonded';
  readonly bottomCardsOf: (seat: number, roleId: string) => readonly WerewolfBottomCard[];
}

export type WerewolfRoleStepDefinition = Omit<
  StepDefinition<string, WerewolfRoleStepContext, WerewolfNightFacts, WerewolfRoleStepResult>,
  'audio'
> & {
  readonly audio: WerewolfStepAudio<WerewolfRoleStepContext>;
  /** What this step did stays in force when its actor is converted later the same night. */
  readonly survivesConversion?: true;
  /** Whether an actor of this later step can still undo the wolf attack on its target. */
  readonly canRescueWolfKillTarget?: (context: WerewolfRoleStepContext) => boolean;
};

export interface WerewolfRoleResource {
  readonly kind: string;
  readonly uses: number;
  readonly refreshPerNight: boolean;
}

export type WerewolfAnnouncementTiming = 'dawn' | 'daySpeech' | 'exileVote';

export interface WerewolfAnnouncementDeclaration {
  readonly timing: WerewolfAnnouncementTiming;
  readonly title: string;
  readonly targetMessage: string;
  readonly emptyMessage: string;
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
    readonly wolfKillTargetForbidden?: boolean;
    readonly checkReaction?: WerewolfCheckReaction;
    readonly immunities?: readonly AttackCause[];
  };
  readonly steps: readonly WerewolfRoleStepDefinition[];
  readonly nightSchedule?: 'firstNight' | 'everyNight';
  readonly oneUseOnSuccess?: boolean;
  readonly resources?: readonly WerewolfRoleResource[];
  readonly announcement?: WerewolfAnnouncementDeclaration;
  readonly personalDaytimeView?: WerewolfPersonalDaytimeViewDeclaration;
  readonly passiveDeathEffects?: (
    context: WerewolfRoleStepContext,
    seat: number,
  ) => readonly DeathEffect[];
  readonly presence?: PresenceDeclaration<TId>;
}

/**
 * Something only the holder of the role may look at on the following day, once the host has
 * published the night's deaths. Every holder gets the card whether or not anything happened.
 */
export interface WerewolfPersonalDaytimeViewDeclaration {
  readonly label: string;
  /** Shown before the content; says when the holder is supposed to look. */
  readonly prompt: string;
  readonly title: string;
  readonly content: (seat: number, resolution: DeathResolution) => string;
  /** The night report sentence for this seat, or null when there is nothing to report. */
  readonly reviewLine: (seat: number, resolution: DeathResolution) => string | null;
}

export function defineRole<const TRole extends WerewolfRoleDefinition>(role: TRole): TRole {
  return role;
}
