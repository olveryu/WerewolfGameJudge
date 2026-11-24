/** Legacy night-result payload types retained in the current game-state codec. */

import type { RoleId } from '../models';
import type { WolfKillOverride } from '../models/roles/spec/schema.types';
import type { Team } from '../models/roles/spec/types';

/**
 * Current night's accumulated results.
 * Used to pass resolved results between steps (e.g., nightmare block -> wolf kill).
 */
export interface CurrentNightResults {
  /**
   * Wolf votes during the wolf meeting (seat -> target seat).
   *
   * This is the single source of truth for wolf vote tracking.
   * GameState MUST include currentNightResults, so this data is public
   * and UI should filter by role.
   */
  readonly wolfVotesBySeat?: Readonly<Record<string, number>>;

  /** Seat blocked by nightmare (skill is disabled) */
  readonly blockedSeat?: number;

  /**
   * Self-contained wolf kill override (nightmare / poisoner).
   * Presence means wolf kill is disabled; ui field provides all display text.
   */
  readonly wolfKillOverride?: WolfKillOverride;

  /** Seat protected by guard */
  readonly guardedSeat?: number;

  /** Seat saved by witch */
  readonly savedSeat?: number;

  /** Seat poisoned by witch */
  readonly poisonedSeat?: number;

  /** Seat dreaming (protected by dreamcatcher) */
  readonly dreamingSeat?: number;

  /** Seat charmed by wolfQueen (link death if wolfQueen dies at night) */
  readonly charmedSeat?: number;

  /** Seats swapped by magician */
  readonly swappedSeats?: readonly [number, number];

  /** Seat silenced by silenceElder (cannot speak during day) */
  readonly silencedSeat?: number;

  /** Seat vote-banned by votebanElder (cannot vote during exile) */
  readonly votebannedSeat?: number;

  /** Seat cursed by crow (extra vote during exile) */
  readonly cursedSeat?: number;

  /** Seat sheltered by eclipseWolfQueen (good team skills targeting this seat redirect to caster) */
  readonly shelteredSeat?: number;

  /** Seats newly hypnotized by piper this night (1-2 seats) */
  readonly hypnotizedSeats?: readonly number[];

  /** Seat converted by awakenedGargoyle */
  readonly convertedSeat?: number;

  /** Seat confessed by wolfGirl (Night 1 only; role and team are never rewritten) */
  readonly wolfGirlConfessedSeat?: number;

  /** Wolf-kill target that Seed Wolf chose to infect; outcome is decided at the final step. */
  readonly seedWolfInfectionTarget?: number;

  /** Seat chosen by shadow as mimicry target */
  readonly shadowMimicTarget?: number;

  /** Avenger's faction (computed by shadow resolver from mimicry target's team) */
  readonly avengerFaction?: Team;

  /** TreasureMaster: chosen card role ID */
  readonly treasureMasterChosenCard?: RoleId;

  /** Thief: chosen card role ID */
  readonly thiefChosenCard?: RoleId;

  /** Cupid: lover seat pair (sorted ascending) */
  readonly loverSeats?: readonly [number, number];
}

/** Resolver output consumed by a reveal-style action schema. */
export type ResolverReveal =
  | {
      readonly kind: 'factionCheck';
      readonly checkResult: '好人' | '狼人';
    }
  | {
      readonly kind: 'identityCheck';
      readonly roleId: RoleId;
    }
  | {
      readonly kind: 'wolfRobotLearn';
      readonly learnedRoleId: RoleId;
      /** Present only for roles configured to expose the shoot-status gate. */
      readonly canShootAsHunter?: boolean;
    };
