import type { StepContextBase, StepDefinition, StepLock } from '../../../platform/steps';
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
  readonly disabledAbilities: readonly {
    readonly roleId: string;
    readonly seat: number;
    /** The role that put the lock on; it declares what the locked seat is told. */
    readonly sourceRoleId: string;
  }[];
  readonly deathEffects: readonly DeathEffect[];
  readonly wolfVotes?: readonly {
    readonly actorSeat: number;
    readonly chosenSeat: number | null;
    readonly landingSeat: number | null;
  }[];
  readonly locationSwaps?: readonly SeatSwap[];
  readonly factionChanges?: readonly {
    readonly seat: number;
    readonly faction: WerewolfRoleFaction;
  }[];
  /** Attempts to convert a player tonight; whether one succeeds is decided later. */
  readonly conversionAttempts?: readonly {
    readonly actorSeat: number;
    readonly targetSeat: number;
  }[];
  readonly wolfGirlConfessions?: readonly {
    readonly actorSeat: number;
    readonly targetSeat: number;
  }[];
  readonly sightOverrides?: readonly { readonly seat: number; readonly roleId: string }[];
  /** Seats on which a good-team action is turned back onto its actor. */
  readonly reflections?: readonly { readonly seat: number }[];
  /** Seats converted this night, with the roles they held until then and the role that did it. */
  readonly conversions?: readonly {
    readonly seat: number;
    readonly formerRoleIds: readonly string[];
    readonly byRoleId: string;
  }[];
}

/** How a conversion attempt ended. */
export type WerewolfConversionOutcome =
  | { readonly outcome: 'notUsed' }
  | { readonly outcome: 'failed'; readonly targetSeat: number }
  | { readonly outcome: 'converted'; readonly targetSeat: number };

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

/** The two sentences for a wolf attack that a role has stopped. */
export interface WerewolfWolfAttackLock {
  /** Shown to a wolf that cannot vote. */
  readonly reason: string;
  /** The night report's sentence for the attack that did not happen. */
  readonly review: string;
}

export interface WerewolfBottomCard {
  readonly index: number;
  readonly label: string;
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
  /** What a seat is told when the given role has locked all its skills for the night. */
  readonly abilityLockOf: (roleId: string) => StepLock;
  /** What is said when the given role has stopped the wolf attack. */
  readonly wolfAttackLockOf: (roleId: string) => WerewolfWolfAttackLock;
  readonly bottomCardsOf: (seat: number, roleId: string) => readonly WerewolfBottomCard[];
}

export type WerewolfRoleStepDefinition = Omit<
  StepDefinition<string, WerewolfRoleStepContext, WerewolfNightFacts, WerewolfRoleStepResult>,
  'audio'
> & {
  readonly audio: WerewolfStepAudio<WerewolfRoleStepContext>;
  /** What this step did stays in force when its actor is converted later the same night. */
  readonly survivesConversion?: true;
  /** Who is shown the wolf pack while this step is current: the wolves that vote, or its owner. */
  readonly wolfPackViewers?: 'wolfVoters' | 'owner';
  /** Whether an actor of this later step can still undo the wolf attack on its target. */
  readonly canRescueWolfKillTarget?: (context: WerewolfRoleStepContext) => boolean;
};

export type WerewolfAnnouncementTiming = 'beforeSheriff' | 'daySpeech' | 'exileVote';

export interface WerewolfAnnouncementDeclaration {
  readonly timing: WerewolfAnnouncementTiming;
  readonly title: string;
  readonly targetMessage: string;
  readonly emptyMessage: string;
  readonly omitWhenEmpty?: true;
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
    /** This card is never set aside as a bottom card. */
    readonly cannotBeBottomCard?: true;
    readonly checkReaction?: WerewolfCheckReaction;
    readonly immunities?: readonly AttackCause[];
  };
  readonly steps: readonly WerewolfRoleStepDefinition[];
  /** What a seat is told when this role has locked all its skills for the night. */
  readonly abilityLock?: StepLock;
  /** What is said when this role has stopped the wolf attack. */
  readonly wolfAttackLock?: WerewolfWolfAttackLock;
  /** How this role turns another player into a different role. */
  readonly conversion?: WerewolfConversionDeclaration;
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

/**
 * A role that can turn another player into a different role during the night. The outcome
 * is decided later than the role's own step, once nothing can still change what it depends on.
 */
export interface WerewolfConversionDeclaration {
  /** The role a converted player becomes. */
  readonly becomesRoleId: string;
  /** The step after which the outcome is decided; null when this night has none to decide. */
  readonly settleAfterStepId: (
    order: readonly string[],
    definitions: Readonly<Record<string, WerewolfRoleStepDefinition>>,
    context: WerewolfRoleStepContext,
  ) => string | null;
  /** The outcome, given what still stands tonight. */
  readonly decide: (
    facts: WerewolfNightFacts,
    effects: readonly DeathEffect[],
  ) => WerewolfConversionOutcome;
  /** What a conversion changes besides the player's role. */
  readonly effects: (targetSeat: number) => readonly DeathEffect[];
  /** Shown to a converted player in the later steps of the role they held. */
  readonly convertedLock: StepLock;
  /** The night report's wording. */
  readonly review: {
    readonly converted: (seat: number, formerRoleName: string) => string;
    readonly failed: (seat: number) => string;
    /** Appended to what the converted player did earlier tonight and no longer counts. */
    readonly voidedSuffix: string;
  };
}

export function defineRole<const TRole extends WerewolfRoleDefinition>(role: TRole): TRole {
  return role;
}
