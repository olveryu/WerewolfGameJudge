/**
 * Werewolf night review — the fact layer of the night report, projected
 * from the authoritative GameState.
 *
 * First section: convert currentNightResults / lastNightDeaths / all check
 * reveals to structured action entries (category, seats, outcome
 * semantics) in night-resolution order. Second section: per-seat identity
 * entries (seat, role, alive state). Third: the public sheriff-election
 * record. This module emits no display strings: the client renders text.
 *
 * Rules are never re-derived here. Shoot eligibility calls the same
 * computeCanShootForSeat the engine uses at step entry; the wolf verdict
 * is the engine's settled verdict carried through, never tallied from the
 * votes; the sheriff tally is the shared sheriffElectionRecord.
 */

import type { DeathReason } from '../DeathCalculator';
import { computeCanShootForSeat } from '../handlers/confirmContext';
import { ROLE_SPECS, type RoleId, Team } from '../models';
import { getRoleStepId } from '../models/roles/spec/nightSteps';
import type {
  GameState,
  Player,
  ResolvedWolfKillVerdict,
  SheriffElectionResult,
  SheriffElectionState,
  SheriffSpeakingDirection,
} from '../protocol/types';
import {
  deriveSheriffRoundRecord,
  getSheriffCandidateRecords,
  getSheriffVoteProgress,
  type SheriffRoundRecord,
} from './sheriffElectionRecord';

type DamageReflectionRevealKey =
  | 'seerReveal'
  | 'mirrorSeerReveal'
  | 'drunkSeerReveal'
  | 'psychicReveal'
  | 'gargoyleReveal'
  | 'pureWhiteReveal'
  | 'wolfWitchReveal';

const DAMAGE_REFLECTION_REVEAL_CHECKS: readonly {
  readonly key: DamageReflectionRevealKey;
  readonly roleId: RoleId;
}[] = [
  { key: 'seerReveal', roleId: 'seer' },
  { key: 'mirrorSeerReveal', roleId: 'mirrorSeer' },
  { key: 'drunkSeerReveal', roleId: 'drunkSeer' },
  { key: 'psychicReveal', roleId: 'psychic' },
  { key: 'gargoyleReveal', roleId: 'gargoyle' },
  { key: 'pureWhiteReveal', roleId: 'pureWhite' },
  { key: 'wolfWitchReveal', roleId: 'wolfWitch' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

type Players = GameState['players'];

function playerAt(players: Players, seat: number): Player | null {
  return players[seat] ?? null;
}

/** Find the seat of a player with the given role (0-based), or undefined. */
function findSeatByRole(players: Players, roleId: RoleId): number | undefined {
  for (const [seatKey, player] of Object.entries(players)) {
    if (player?.role === roleId) return Number(seatKey);
  }
  return undefined;
}

/**
 * The seat of the role an action entry is about to name as its actor. The
 * night-results record carries no actor fields (only target seats), so the
 * actor is resolved from the players at the construction point. An entry
 * whose actor cannot be resolved is a corrupt fact set — fail fast here
 * rather than letting a surface invent or drop the actor downstream.
 */
function requireSeatByRole(players: Players, roleId: RoleId): number {
  const seat = findSeatByRole(players, roleId);
  if (seat === undefined) {
    throw new Error(`[FAIL-FAST] Night review cannot resolve an actor seat for role ${roleId}`);
  }
  return seat;
}

/** The recorded target of a role's single night step, if its action is recorded. */
function recordedTargetForRole(state: GameState, roleId: RoleId): number | undefined {
  const stepId = getRoleStepId(roleId);
  const action = state.actions.find((entry) => entry.schemaId === stepId);
  return action?.targetSeat;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One wolf's kill vote inside a wolfAttack entry. Seats are 0-based and
 * targetSeat is always a real seat: abstentions (the engine's -1 sentinel in
 * wolfVotesBySeat) are split into the entry's abstainSeats by
 * buildActionEntries and never appear as a vote here.
 */
export interface NightReviewWolfVote {
  readonly voterSeat: number;
  readonly targetSeat: number;
}

/** Why the wolf team gave up its attack (wolfKillOverride source). */
export type NightReviewWolfGiveUpReason = 'poisonerPresent' | 'nightmareBlock';

/**
 * One night fact, in the order the legacy text summary listed them.
 * Renderers switch on `kind` exhaustively; seats are 0-based.
 */
export type NightReviewActionEntry =
  // Setup: bottom cards, card choices, cupid link
  | { readonly kind: 'bottomCards'; readonly roleIds: readonly RoleId[] }
  | {
      readonly kind: 'cardChoice';
      readonly actorSeat: number;
      readonly actorRoleId: RoleId;
      readonly chosenRoleId: RoleId;
    }
  | {
      readonly kind: 'cupidLink';
      readonly actorSeat: number;
      readonly seats: readonly [number, number];
    }
  // Wolf team attack (votes = real targets only; abstaining wolves sit in abstainSeats)
  | {
      readonly kind: 'wolfAttack';
      readonly votes: readonly NightReviewWolfVote[];
      readonly abstainSeats: readonly number[];
      /**
       * The engine's settled wolf-kill verdict for this night, carried
       * through unchanged: undefined means no settlement is recorded
       * on the state (a review built before settlement) and the
       * report must not invent a verdict from the votes; null means
       * settled with no vote verdict (a wolf-kill override, whose
       * cause the wolfGiveUp card carries). The votes on this entry
       * are display only and never decide the verdict.
       */
      readonly verdict?: ResolvedWolfKillVerdict | null;
    }
  | { readonly kind: 'wolfNoTarget' }
  | { readonly kind: 'wolfGiveUp'; readonly reason: NightReviewWolfGiveUpReason }
  // Nightmare block / Eclipse Wolf Queen shelter / Hidden Wolf presence
  | {
      readonly kind: 'nightmareBlock';
      readonly actorSeat: number;
      readonly targetSeat: number;
      readonly targetRoleId: RoleId | null;
    }
  | { readonly kind: 'nightmareIdle'; readonly actorSeat: number }
  | { readonly kind: 'shelter'; readonly actorSeat: number; readonly targetSeat: number }
  | { readonly kind: 'shelterIdle'; readonly actorSeat: number }
  | { readonly kind: 'hiddenWolfConfirmed'; readonly actorSeat: number }
  // Guard / elders
  | { readonly kind: 'guard'; readonly actorSeat: number; readonly targetSeat: number }
  | { readonly kind: 'guardIdle'; readonly actorSeat: number }
  | { readonly kind: 'silence'; readonly actorSeat: number; readonly targetSeat: number }
  | { readonly kind: 'silenceIdle'; readonly actorSeat: number }
  | { readonly kind: 'voteban'; readonly actorSeat: number; readonly targetSeat: number }
  | { readonly kind: 'votebanIdle'; readonly actorSeat: number }
  // Witch / Poisoner potions
  | { readonly kind: 'save'; readonly actorSeat: number; readonly targetSeat: number }
  | {
      readonly kind: 'poison';
      readonly actorSeat: number;
      readonly actorRoleId: 'witch' | 'poisoner';
      readonly targetSeat: number;
    }
  | { readonly kind: 'witchIdleAll'; readonly actorSeat: number }
  | { readonly kind: 'witchNoSave'; readonly actorSeat: number }
  | { readonly kind: 'witchNoPoison'; readonly actorSeat: number }
  | { readonly kind: 'poisonerNoPoison'; readonly actorSeat: number }
  // Crow / Dreamcatcher / Magician
  | { readonly kind: 'curse'; readonly actorSeat: number; readonly targetSeat: number }
  | { readonly kind: 'curseIdle'; readonly actorSeat: number }
  | { readonly kind: 'dream'; readonly actorSeat: number; readonly targetSeat: number }
  | { readonly kind: 'dreamIdle'; readonly actorSeat: number }
  | {
      readonly kind: 'swap';
      readonly actorSeat: number;
      readonly seats: readonly [number, number];
    }
  | { readonly kind: 'swapIdle'; readonly actorSeat: number }
  // Idol choices / mimic / presence / charm / convert / hypnotize
  | {
      readonly kind: 'idolChoice';
      readonly actorSeat: number;
      readonly actorRoleId: RoleId;
      readonly targetSeat: number;
    }
  | {
      readonly kind: 'mimic';
      readonly actorSeat: number;
      readonly targetSeat: number;
      readonly isBound: boolean;
    }
  | { readonly kind: 'avengerConfirmed'; readonly actorSeat: number }
  | { readonly kind: 'charm'; readonly actorSeat: number; readonly targetSeat: number }
  | { readonly kind: 'charmIdle'; readonly actorSeat: number }
  | { readonly kind: 'convert'; readonly actorSeat: number; readonly targetSeat: number }
  | {
      readonly kind: 'hypnotize';
      readonly actorSeat: number;
      readonly targetSeats: readonly number[];
    }
  | { readonly kind: 'hypnotizeIdle'; readonly actorSeat: number }
  // Check family / Wolf Robot learning
  | {
      readonly kind: 'check';
      readonly actorSeat: number;
      readonly actorRoleId: RoleId;
      readonly targetSeat: number;
      readonly result: string;
    }
  | { readonly kind: 'checkIdle'; readonly actorSeat: number; readonly actorRoleId: RoleId }
  | {
      readonly kind: 'learn';
      readonly actorSeat: number;
      readonly targetSeat: number;
      readonly learnedRoleId: RoleId;
    }
  | { readonly kind: 'learnIdle'; readonly actorSeat: number }
  // Shooting availability / Seed Wolf infection
  | {
      readonly kind: 'shootStatus';
      readonly actorSeat: number;
      readonly actorRoleId: RoleId;
      readonly canShoot: boolean;
    }
  | { readonly kind: 'infectConverted'; readonly actorSeat: number; readonly targetSeat: number }
  | { readonly kind: 'infectFailed'; readonly actorSeat: number; readonly targetSeat: number }
  | { readonly kind: 'infectIdle'; readonly actorSeat: number }
  // Interaction warnings
  | { readonly kind: 'guardSaveConflict'; readonly targetSeat: number }
  | {
      readonly kind: 'poisonImmune';
      readonly targetSeat: number;
      readonly targetRoleId: RoleId;
    }
  | {
      readonly kind: 'reflectDamage';
      readonly checkerRoleId: RoleId;
      readonly targetSeat: number;
      readonly targetRoleId: RoleId;
    }
  // Night outcome
  | { readonly kind: 'peacefulNight' }
  | {
      readonly kind: 'deaths';
      readonly deaths: readonly {
        readonly seat: number;
        readonly reason: DeathReason | null;
      }[];
    };

/** One seat's identity for the review grid. Seats are 0-based. */
export interface NightReviewIdentityEntry {
  readonly seat: number;
  /** Occupied seat's role; null for an empty seat or an unassigned role. */
  readonly roleId: RoleId | null;
  /** True when the seat has no occupant at all （空座）. */
  readonly isEmptySeat: boolean;
  /** False when the seat is in lastNightDeaths. */
  readonly isAlive: boolean;
}

/**
 * One closed sheriff-election voting round in the report. The tally itself
 * is defined once in sheriffElectionRecord; this is only the report's
 * surface name for that record, never a second definition.
 */
export type NightReviewSheriffRound = SheriffRoundRecord;

/**
 * The sheriff-election section of the night report, derived from
 * `sheriffElection` + `sheriffElectionResult`. The report never publishes
 * more than the public election record (the sheriffElectionViewModel
 * convention):
 * during `registration` the section is status-only — candidate identities
 * and counts stay secret from everyone, the host included — and a round
 * that is still collecting ballots contributes its candidates but never
 * any ballot content.
 */
export type NightReviewSheriffSection =
  | { readonly kind: 'registration' }
  | {
      readonly kind: 'inProgress';
      /** Election phase, so the report renders the panel's phase titles. */
      readonly phase: SheriffElectionState['phase'];
      /** Full registration, so the report renders the panel's 上警 row. */
      readonly registeredSeats: readonly number[];
      /** Public candidates for the current stage (see derivation). */
      readonly candidateSeats: readonly number[];
      readonly withdrawnSeats: readonly number[];
      readonly closedRounds: readonly NightReviewSheriffRound[];
      /** The round currently collecting ballots, when in a voting stage. */
      readonly activeRound: {
        readonly round: 'first' | 'runoff';
        readonly candidateSeats: readonly number[];
      } | null;
      /**
       * Where speeches start and in which direction. Null outside speech
       * phases, so the row never renders there — exactly the panel's rule.
       */
      readonly speakingOrder: {
        readonly startSeat: number;
        readonly direction: SheriffSpeakingDirection;
      } | null;
      /**
       * Submission counts for an open voting round (the panel's public
       * slice: counts only, never ballot targets). Null outside voting.
       */
      readonly voteProgress: {
        readonly submittedCount: number;
        readonly eligibleCount: number;
      } | null;
    }
  | {
      readonly kind: 'completed';
      readonly registeredSeats: readonly number[];
      readonly withdrawnSeats: readonly number[];
      /** Still-standing candidates, so the report renders the panel's records. */
      readonly activeCandidateSeats: readonly number[];
      readonly rounds: readonly NightReviewSheriffRound[];
      readonly result: SheriffElectionResult;
    };

export interface WerewolfNightReview {
  /** Structured night facts in summary order */
  actions: NightReviewActionEntry[];
  /** Per-seat identity entries sorted by seat */
  identities: NightReviewIdentityEntry[];
  /**
   * Sheriff-election section. Absent when the game never held an election.
   * The election belongs to the game archive, not to one night: the section
   * reflects the election state at the moment the review is opened.
   */
  sheriff?: NightReviewSheriffSection;
}

/** Headline tallies for the report's stats strip, derived from the entries. */
export interface NightReportStats {
  /** Deaths whose recorded reason is wolfKill. */
  readonly wolfKills: number;
  /** Deaths whose recorded reason is poison. */
  readonly poisonKills: number;
  /** Save entries whose target did not die tonight. */
  readonly saves: number;
  /** Check entries (one per checker who revealed a result). */
  readonly checks: number;
}

/**
 * How the wolf team's votes resolved, as rendered from a wolfAttack
 * entry: one shared target, a split vote that still produced a
 * plurality kill, a tied vote settled to one target (tiePicked), a
 * vote settled to no kill (splitTied — only the cupid unanimity rule
 * settles a vote to no kill), a vote with no settlement recorded
 * (tiePending), or every wolf abstaining. This is a pure mapping of
 * the engine's settled verdict, not a tally: the entry's votes are
 * never counted here.
 */
export type NightReviewWolfVerdict =
  | { readonly type: 'sharedTarget'; readonly targetSeat: number }
  | { readonly type: 'splitKilled'; readonly targetSeat: number }
  | { readonly type: 'tiePicked'; readonly targetSeat: number }
  | { readonly type: 'splitTied' }
  | { readonly type: 'tiePending' }
  | { readonly type: 'allAbstain' };

/** A factual annotation on one death, for the report's death cards. */
export type NightReviewDeathNote =
  | { readonly kind: 'wolfVotes'; readonly votes: number }
  | { readonly kind: 'poisonedBy'; readonly actorRoleId: 'witch' | 'poisoner' };

/** The night outcome, derived from the data's single outcome entry. */
export type NightReviewOutcome =
  | { readonly type: 'peaceful' }
  | {
      readonly type: 'deaths';
      readonly deaths: readonly {
        readonly seat: number;
        readonly reason: DeathReason | null;
      }[];
    };

/**
 * Derive the night outcome from the action entries. The builders always emit
 * exactly one outcome entry (`deaths` or `peacefulNight`); anything else is a
 * malformed WerewolfNightReview and fails fast instead of rendering a wrong hero.
 * Shared by the DOM report hero and the canvas outcome line — one derivation.
 */
export function getNightReviewOutcome(data: WerewolfNightReview): NightReviewOutcome {
  let outcome: NightReviewOutcome | undefined;
  for (const entry of data.actions) {
    if (entry.kind !== 'deaths' && entry.kind !== 'peacefulNight') continue;
    if (outcome !== undefined) {
      throw new Error('[FAIL-FAST] Night review data carries more than one outcome entry');
    }
    outcome =
      entry.kind === 'peacefulNight'
        ? { type: 'peaceful' }
        : { type: 'deaths', deaths: entry.deaths };
  }
  if (outcome === undefined) {
    throw new Error('[FAIL-FAST] Night review data carries no outcome entry');
  }
  return outcome;
}

// ─────────────────────────────────────────────────────────────────────────────
// Report derivations (actors, tallies, verdicts, annotations)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The role that acted in an entry, for surfaces that head a card or line
 * with the actor. Team / setup / outcome / annotation entries have no
 * single actor and return null. Kinds whose actor varies carry it on the
 * entry itself (`actorRoleId`); the rest are fixed by kind.
 */
export function nightReviewActorRoleId(entry: NightReviewActionEntry): RoleId | null {
  switch (entry.kind) {
    case 'cardChoice':
    case 'poison':
    case 'idolChoice':
    case 'check':
    case 'checkIdle':
    case 'shootStatus':
      return entry.actorRoleId;
    case 'cupidLink':
      return 'cupid';
    case 'nightmareBlock':
    case 'nightmareIdle':
      return 'nightmare';
    case 'shelter':
    case 'shelterIdle':
      return 'eclipseWolfQueen';
    case 'hiddenWolfConfirmed':
      return 'hiddenWolf';
    case 'guard':
    case 'guardIdle':
      return 'guard';
    case 'silence':
    case 'silenceIdle':
      return 'silenceElder';
    case 'voteban':
    case 'votebanIdle':
      return 'votebanElder';
    case 'save':
    case 'witchIdleAll':
    case 'witchNoSave':
    case 'witchNoPoison':
      return 'witch';
    case 'poisonerNoPoison':
      return 'poisoner';
    case 'curse':
    case 'curseIdle':
      return 'crow';
    case 'dream':
    case 'dreamIdle':
      return 'dreamcatcher';
    case 'swap':
    case 'swapIdle':
      return 'magician';
    case 'mimic':
      return 'shadow';
    case 'avengerConfirmed':
      return 'avenger';
    case 'charm':
    case 'charmIdle':
      return 'wolfQueen';
    case 'convert':
      return 'awakenedGargoyle';
    case 'hypnotize':
    case 'hypnotizeIdle':
      return 'piper';
    case 'learn':
    case 'learnIdle':
      return 'wolfRobot';
    case 'infectConverted':
    case 'infectFailed':
    case 'infectIdle':
      return 'seedWolf';
    case 'bottomCards':
    case 'wolfAttack':
    case 'wolfNoTarget':
    case 'wolfGiveUp':
    case 'guardSaveConflict':
    case 'poisonImmune':
    case 'reflectDamage':
    case 'deaths':
    case 'peacefulNight':
      return null;
  }
}

/**
 * Map a wolfAttack entry's engine verdict to the render verdict.
 * The entry's votes are display only and are never counted: a
 * recorded engine verdict wins even when the tally alone would name
 * another target, and an unrecorded verdict is tiePending even when
 * the votes are unanimous — the report never invents a verdict from
 * a tally. A null verdict (wolf-kill override, which has no vote
 * verdict) also maps to tiePending here: in production an override
 * night carries no votes, so no wolfAttack card is built and the
 * wolfGiveUp card is the only wolf card; null only reaches this
 * mapping in a synthetic state, where "no vote verdict recorded" is
 * the safe rendering — never splitTied, which is reserved for a
 * cupid unanimity settlement.
 */
export function deriveWolfVerdict(
  entry: Extract<NightReviewActionEntry, { kind: 'wolfAttack' }>,
): NightReviewWolfVerdict {
  const verdict = entry.verdict;
  if (verdict === undefined || verdict === null) return { type: 'tiePending' };
  switch (verdict.type) {
    case 'sharedTarget':
      return { type: 'sharedTarget', targetSeat: verdict.targetSeat };
    case 'splitKilled':
      return { type: 'splitKilled', targetSeat: verdict.targetSeat };
    case 'tiePicked':
      return { type: 'tiePicked', targetSeat: verdict.targetSeat };
    case 'splitTied':
      return { type: 'splitTied' };
    case 'allAbstain':
      return { type: 'allAbstain' };
  }
}

/**
 * Derive the stats-strip tallies from the entries. Death categories come
 * from the single outcome entry (the same source the headline reads), and
 * the derivation cross-checks it: a seat listed twice is a corrupt outcome
 * and fails fast.
 */
export function deriveNightReportStats(data: WerewolfNightReview): NightReportStats {
  const outcome = getNightReviewOutcome(data);
  const deadSeats = new Set<number>();
  let wolfKills = 0;
  let poisonKills = 0;
  if (outcome.type === 'deaths') {
    for (const death of outcome.deaths) {
      if (deadSeats.has(death.seat)) {
        throw new Error(`[FAIL-FAST] Night review outcome lists seat ${death.seat} more than once`);
      }
      deadSeats.add(death.seat);
      if (death.reason === 'wolfKill') wolfKills += 1;
      else if (death.reason === 'poison') poisonKills += 1;
    }
  }
  let saves = 0;
  let checks = 0;
  for (const entry of data.actions) {
    if (entry.kind === 'check') checks += 1;
    if (entry.kind === 'save' && !deadSeats.has(entry.targetSeat)) saves += 1;
  }
  return { wolfKills, poisonKills, saves, checks };
}

/**
 * Per-death annotations for the report's death cards: how many wolf votes
 * locked a wolf-killed seat, and whose poison killed a poisoned seat. A
 * death whose cause has no matching action entry simply gets no note.
 */
export function deriveDeathNotes(
  data: WerewolfNightReview,
): ReadonlyMap<number, NightReviewDeathNote> {
  const outcome = getNightReviewOutcome(data);
  const notes = new Map<number, NightReviewDeathNote>();
  if (outcome.type !== 'deaths') return notes;
  const wolfEntry = data.actions.find((entry) => entry.kind === 'wolfAttack');
  const poisonEntry = data.actions.find((entry) => entry.kind === 'poison');
  for (const death of outcome.deaths) {
    if (death.reason === 'wolfKill' && wolfEntry?.kind === 'wolfAttack') {
      const votes = wolfEntry.votes.filter((vote) => vote.targetSeat === death.seat).length;
      if (votes > 0) notes.set(death.seat, { kind: 'wolfVotes', votes });
    } else if (
      death.reason === 'poison' &&
      poisonEntry?.kind === 'poison' &&
      poisonEntry.targetSeat === death.seat
    ) {
      notes.set(death.seat, { kind: 'poisonedBy', actorRoleId: poisonEntry.actorRoleId });
    }
  }
  return notes;
}

/**
 * The wolf-kill target the witch left unsaved, when there is one: the
 * wolf verdict resolved a target and no save entry covers it. Backs the
 * witch card's "wolf target not saved" annotation — surfaces render the
 * fact, they never re-derive it.
 */
export function deriveWolfTargetSaveNote(
  data: WerewolfNightReview,
): { readonly wolfTargetSeat: number } | null {
  const wolfEntry = data.actions.find((entry) => entry.kind === 'wolfAttack');
  if (wolfEntry?.kind !== 'wolfAttack') return null;
  const verdict = deriveWolfVerdict(wolfEntry);
  if (
    verdict.type !== 'sharedTarget' &&
    verdict.type !== 'splitKilled' &&
    verdict.type !== 'tiePicked'
  )
    return null;
  const saved = data.actions.some(
    (entry) => entry.kind === 'save' && entry.targetSeat === verdict.targetSeat,
  );
  return saved ? null : { wolfTargetSeat: verdict.targetSeat };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheriff election section derivation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Project the report's sheriff section from the shared election record
 * (sheriffElectionRecord) — the same record the election panel publishes.
 * This function owns only the report's own shape: which record fields land
 * in which section kind. It never re-derives a tally or a candidate set.
 * Registration exposes nothing but the status; speech stages expose the
 * active candidates; a voting stage exposes the closed rounds in full plus
 * the active round's candidates and the submission counts — its ballot
 * targets are never read here. The in-progress section also carries the
 * phase and the full registration so the report can render the panel's
 * phase header and records rows without re-deriving them.
 */
function deriveSpeakingOrder(
  state: GameState,
  election: SheriffElectionState,
): { readonly startSeat: number; readonly direction: SheriffSpeakingDirection } | null {
  if (election.phase !== 'candidateSpeech' && election.phase !== 'runoffSpeech') return null;
  if (playerAt(state.players, election.speakingStartSeat) === null) {
    throw new Error(
      `[FAIL-FAST] Sheriff speaking start seat ${election.speakingStartSeat} is not occupied`,
    );
  }
  return { startSeat: election.speakingStartSeat, direction: election.speakingDirection };
}

export function deriveSheriffSection(state: GameState): NightReviewSheriffSection | undefined {
  const election = state.sheriffElection;
  const result = state.sheriffElectionResult;
  if (election === undefined) {
    if (result !== undefined) {
      throw new Error(
        '[FAIL-FAST] Sheriff election result exists without an election state in night review',
      );
    }
    return undefined;
  }
  if (election.phase === 'registration') {
    return { kind: 'registration' };
  }
  const records = getSheriffCandidateRecords(election);
  if (records === null) {
    throw new Error(
      '[FAIL-FAST] Sheriff election records are missing outside registration in night review',
    );
  }
  switch (election.phase) {
    case 'candidateSpeech':
    case 'withdrawal':
      return {
        kind: 'inProgress',
        phase: election.phase,
        registeredSeats: [...records.registeredSeats],
        candidateSeats: [...records.activeCandidateSeats],
        withdrawnSeats: [...records.withdrawnSeats],
        closedRounds: [],
        activeRound: null,
        voteProgress: null,
        speakingOrder: deriveSpeakingOrder(state, election),
      };
    case 'firstVote':
    case 'runoffVote':
      return {
        kind: 'inProgress',
        phase: election.phase,
        registeredSeats: [...records.registeredSeats],
        candidateSeats: [...records.activeCandidateSeats],
        withdrawnSeats: [...records.withdrawnSeats],
        closedRounds: election.completedRounds.map(deriveSheriffRoundRecord),
        activeRound: {
          round: election.phase === 'firstVote' ? 'first' : 'runoff',
          candidateSeats: [...records.activeCandidateSeats],
        },
        voteProgress: getSheriffVoteProgress(election),
        speakingOrder: deriveSpeakingOrder(state, election),
      };
    case 'runoffSpeech':
      return {
        kind: 'inProgress',
        phase: election.phase,
        registeredSeats: [...records.registeredSeats],
        candidateSeats: [...records.activeCandidateSeats],
        withdrawnSeats: [...records.withdrawnSeats],
        closedRounds: election.completedRounds.map(deriveSheriffRoundRecord),
        activeRound: null,
        voteProgress: null,
        speakingOrder: deriveSpeakingOrder(state, election),
      };
    case 'completed': {
      if (result === undefined) {
        throw new Error(
          '[FAIL-FAST] Sheriff election is completed without a result in night review',
        );
      }
      return {
        kind: 'completed',
        registeredSeats: [...records.registeredSeats],
        withdrawnSeats: [...records.withdrawnSeats],
        activeCandidateSeats: [...records.activeCandidateSeats],
        rounds: election.completedRounds.map(deriveSheriffRoundRecord),
        result,
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Action entries builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build structured action entries from night results + reveal fields.
 * Branching and ordering mirror the fact inventory one-to-one:
 * every fact the legacy text summary carried appears exactly once, in the same order.
 */
export function buildActionEntries(state: GameState): NightReviewActionEntry[] {
  const entries: NightReviewActionEntry[] = [];
  const nr = state.currentNightResults ?? {};

  // 0. TreasureMaster: bottom cards composition + card choice + skipped roles
  if (state.bottomCards && state.bottomCards.length > 0) {
    entries.push({ kind: 'bottomCards', roleIds: [...state.bottomCards] });
  }
  if (nr.treasureMasterChosenCard) {
    entries.push({
      kind: 'cardChoice',
      actorSeat: requireSeatByRole(state.players, 'treasureMaster'),
      actorRoleId: 'treasureMaster',
      chosenRoleId: nr.treasureMasterChosenCard,
    });
  }
  if (nr.thiefChosenCard) {
    entries.push({
      kind: 'cardChoice',
      actorSeat: requireSeatByRole(state.players, 'thief'),
      actorRoleId: 'thief',
      chosenRoleId: nr.thiefChosenCard,
    });
  }
  if (state.loverSeats && state.loverSeats.length === 2) {
    entries.push({
      kind: 'cupidLink',
      actorSeat: requireSeatByRole(state.players, 'cupid'),
      seats: [state.loverSeats[0], state.loverSeats[1]],
    });
  }

  // 1. Wolf kill vote. wolfVotesBySeat records an abstention as the engine
  // sentinel -1 (wolfKillResolver's empty vote); split abstentions out so
  // votes only ever carry real target seats. -1 is the only legal negative:
  // any other negative target is a corrupt record and fails fast here rather
  // than rendering as a seat downstream.
  if (nr.wolfVotesBySeat && Object.keys(nr.wolfVotesBySeat).length > 0) {
    const votes: NightReviewWolfVote[] = [];
    const abstainSeats: number[] = [];
    for (const [voter, target] of Object.entries(nr.wolfVotesBySeat)) {
      const voterSeat = Number(voter);
      if (target === -1) {
        abstainSeats.push(voterSeat);
      } else if (target >= 0) {
        votes.push({ voterSeat, targetSeat: target });
      } else {
        throw new Error(
          `[FAIL-FAST] Invalid wolf vote target ${target} from seat ${voterSeat} in night review`,
        );
      }
    }
    entries.push({
      kind: 'wolfAttack',
      votes,
      abstainSeats,
      verdict: state.resolvedWolfKillVerdict,
    });
  } else if (
    !nr.wolfKillOverride &&
    Object.values(state.players).some((p) => p?.role && ROLE_SPECS[p.role]?.team === Team.Wolf)
  ) {
    entries.push({ kind: 'wolfNoTarget' });
  }

  if (nr.wolfKillOverride) {
    entries.push({
      kind: 'wolfGiveUp',
      reason: nr.wolfKillOverride.source === 'poisoner' ? 'poisonerPresent' : 'nightmareBlock',
    });
  }

  // 2. Nightmare block
  if (nr.blockedSeat != null) {
    const blockedPlayer = playerAt(state.players, nr.blockedSeat);
    entries.push({
      kind: 'nightmareBlock',
      actorSeat: requireSeatByRole(state.players, 'nightmare'),
      targetSeat: nr.blockedSeat,
      targetRoleId: blockedPlayer?.role ?? null,
    });
  } else {
    const nightmareSeat = findSeatByRole(state.players, 'nightmare');
    if (nightmareSeat !== undefined) {
      entries.push({ kind: 'nightmareIdle', actorSeat: nightmareSeat });
    }
  }

  // 2a. EclipseWolfQueen shelter
  if (nr.shelteredSeat != null) {
    entries.push({
      kind: 'shelter',
      actorSeat: requireSeatByRole(state.players, 'eclipseWolfQueen'),
      targetSeat: nr.shelteredSeat,
    });
  } else {
    const eqSeat = findSeatByRole(state.players, 'eclipseWolfQueen');
    if (eqSeat !== undefined && nr.blockedSeat !== eqSeat) {
      entries.push({ kind: 'shelterIdle', actorSeat: eqSeat });
    }
  }

  // 2b. HiddenWolf reveal (confirm-only — just show presence)
  const hiddenWolfSeat = findSeatByRole(state.players, 'hiddenWolf');
  if (hiddenWolfSeat !== undefined) {
    entries.push({ kind: 'hiddenWolfConfirmed', actorSeat: hiddenWolfSeat });
  }

  // 3. Guard
  if (nr.guardedSeat != null) {
    entries.push({
      kind: 'guard',
      actorSeat: requireSeatByRole(state.players, 'guard'),
      targetSeat: nr.guardedSeat,
    });
  } else {
    const guardSeat = findSeatByRole(state.players, 'guard');
    if (guardSeat !== undefined && nr.blockedSeat !== guardSeat) {
      entries.push({ kind: 'guardIdle', actorSeat: guardSeat });
    }
  }

  // 3a. SilenceElder
  if (nr.silencedSeat != null) {
    entries.push({
      kind: 'silence',
      actorSeat: requireSeatByRole(state.players, 'silenceElder'),
      targetSeat: nr.silencedSeat,
    });
  } else {
    const seSeat = findSeatByRole(state.players, 'silenceElder');
    if (seSeat !== undefined && nr.blockedSeat !== seSeat) {
      entries.push({ kind: 'silenceIdle', actorSeat: seSeat });
    }
  }

  // 3b. VotebanElder
  if (nr.votebannedSeat != null) {
    entries.push({
      kind: 'voteban',
      actorSeat: requireSeatByRole(state.players, 'votebanElder'),
      targetSeat: nr.votebannedSeat,
    });
  } else {
    const veSeat = findSeatByRole(state.players, 'votebanElder');
    if (veSeat !== undefined && nr.blockedSeat !== veSeat) {
      entries.push({ kind: 'votebanIdle', actorSeat: veSeat });
    }
  }

  // 4. Witch / Poisoner
  if (nr.savedSeat != null) {
    entries.push({
      kind: 'save',
      actorSeat: requireSeatByRole(state.players, 'witch'),
      targetSeat: nr.savedSeat,
    });
  }
  if (nr.poisonedSeat != null) {
    const poisonerSeat = findSeatByRole(state.players, 'poisoner');
    entries.push({
      kind: 'poison',
      actorSeat: poisonerSeat ?? requireSeatByRole(state.players, 'witch'),
      actorRoleId: poisonerSeat !== undefined ? 'poisoner' : 'witch',
      targetSeat: nr.poisonedSeat,
    });
  }

  // 4x. Witch/Poisoner "did nothing" annotations
  {
    const witchSeat = findSeatByRole(state.players, 'witch');
    const poisonerSeat = findSeatByRole(state.players, 'poisoner');
    const witchBlocked = witchSeat !== undefined && nr.blockedSeat === witchSeat;
    const poisonerBlocked = poisonerSeat !== undefined && nr.blockedSeat === poisonerSeat;

    if (witchSeat !== undefined && !witchBlocked) {
      const noSave = nr.savedSeat == null;
      const witchOwnsPoison = poisonerSeat === undefined;
      const noPoison = nr.poisonedSeat == null;

      if (noSave && witchOwnsPoison && noPoison) {
        entries.push({ kind: 'witchIdleAll', actorSeat: witchSeat });
      } else {
        if (noSave) entries.push({ kind: 'witchNoSave', actorSeat: witchSeat });
        if (witchOwnsPoison && noPoison) {
          entries.push({ kind: 'witchNoPoison', actorSeat: witchSeat });
        }
      }
    }
    if (poisonerSeat !== undefined && !poisonerBlocked && nr.poisonedSeat == null) {
      entries.push({ kind: 'poisonerNoPoison', actorSeat: poisonerSeat });
    }
  }

  // 4a. Crow curse
  if (nr.cursedSeat != null) {
    entries.push({
      kind: 'curse',
      actorSeat: requireSeatByRole(state.players, 'crow'),
      targetSeat: nr.cursedSeat,
    });
  } else {
    const crowSeat = findSeatByRole(state.players, 'crow');
    if (crowSeat !== undefined && nr.blockedSeat !== crowSeat) {
      entries.push({ kind: 'curseIdle', actorSeat: crowSeat });
    }
  }

  // 5. Dreamcatcher
  if (nr.dreamingSeat != null) {
    entries.push({
      kind: 'dream',
      actorSeat: requireSeatByRole(state.players, 'dreamcatcher'),
      targetSeat: nr.dreamingSeat,
    });
  } else {
    const dcSeat = findSeatByRole(state.players, 'dreamcatcher');
    if (dcSeat !== undefined && nr.blockedSeat !== dcSeat) {
      entries.push({ kind: 'dreamIdle', actorSeat: dcSeat });
    }
  }

  // 6. Magician swap
  if (nr.swappedSeats) {
    entries.push({
      kind: 'swap',
      actorSeat: requireSeatByRole(state.players, 'magician'),
      seats: [nr.swappedSeats[0], nr.swappedSeats[1]],
    });
  } else {
    const magicianSeat = findSeatByRole(state.players, 'magician');
    if (magicianSeat !== undefined && nr.blockedSeat !== magicianSeat) {
      entries.push({ kind: 'swapIdle', actorSeat: magicianSeat });
    }
  }

  // 6a. Slacker idol (recorded action)
  const slackerIdol = recordedTargetForRole(state, 'slacker');
  if (slackerIdol !== undefined) {
    entries.push({
      kind: 'idolChoice',
      actorSeat: requireSeatByRole(state.players, 'slacker'),
      actorRoleId: 'slacker',
      targetSeat: slackerIdol,
    });
  }

  // 6b. WildChild idol (recorded action)
  const wildChildIdol = recordedTargetForRole(state, 'wildChild');
  if (wildChildIdol !== undefined) {
    entries.push({
      kind: 'idolChoice',
      actorSeat: requireSeatByRole(state.players, 'wildChild'),
      actorRoleId: 'wildChild',
      targetSeat: wildChildIdol,
    });
  }

  // 6b2. Shadow mimic
  if (nr.shadowMimicTarget != null) {
    entries.push({
      kind: 'mimic',
      actorSeat: requireSeatByRole(state.players, 'shadow'),
      targetSeat: nr.shadowMimicTarget,
      isBound: nr.avengerFaction === Team.Third,
    });
  }

  // 6b3. Avenger faction (always participates, just show presence)
  const avengerSeat = findSeatByRole(state.players, 'avenger');
  if (avengerSeat !== undefined) {
    entries.push({ kind: 'avengerConfirmed', actorSeat: avengerSeat });
  }

  // 6c. WolfQueen charm (recorded action)
  const wolfQueenCharm = recordedTargetForRole(state, 'wolfQueen');
  if (wolfQueenCharm !== undefined) {
    entries.push({
      kind: 'charm',
      actorSeat: requireSeatByRole(state.players, 'wolfQueen'),
      targetSeat: wolfQueenCharm,
    });
  } else {
    const wqSeat = findSeatByRole(state.players, 'wolfQueen');
    if (wqSeat !== undefined && nr.blockedSeat !== wqSeat) {
      entries.push({ kind: 'charmIdle', actorSeat: wqSeat });
    }
  }

  // 6d. AwakenedGargoyle convert
  if (nr.convertedSeat != null) {
    entries.push({
      kind: 'convert',
      actorSeat: requireSeatByRole(state.players, 'awakenedGargoyle'),
      targetSeat: nr.convertedSeat,
    });
  }

  // 6e. Piper hypnotize
  if (nr.hypnotizedSeats && nr.hypnotizedSeats.length > 0) {
    entries.push({
      kind: 'hypnotize',
      actorSeat: requireSeatByRole(state.players, 'piper'),
      targetSeats: [...nr.hypnotizedSeats],
    });
  } else {
    const piperSeat = findSeatByRole(state.players, 'piper');
    if (piperSeat !== undefined && nr.blockedSeat !== piperSeat) {
      entries.push({ kind: 'hypnotizeIdle', actorSeat: piperSeat });
    }
  }

  // 7. Check reveals (seer family + others)
  const revealFields: readonly {
    readonly key: DamageReflectionRevealKey;
    readonly roleId: RoleId;
  }[] = [
    { key: 'seerReveal', roleId: 'seer' },
    { key: 'mirrorSeerReveal', roleId: 'mirrorSeer' },
    { key: 'drunkSeerReveal', roleId: 'drunkSeer' },
    { key: 'psychicReveal', roleId: 'psychic' },
    { key: 'gargoyleReveal', roleId: 'gargoyle' },
    { key: 'pureWhiteReveal', roleId: 'pureWhite' },
    { key: 'wolfWitchReveal', roleId: 'wolfWitch' },
  ];

  for (const { key, roleId } of revealFields) {
    const reveal = state[key];
    if (reveal) {
      entries.push({
        kind: 'check',
        actorSeat: requireSeatByRole(state.players, roleId),
        actorRoleId: roleId,
        targetSeat: reveal.targetSeat,
        result: reveal.result,
      });
    } else {
      const seat = findSeatByRole(state.players, roleId);
      if (seat !== undefined && nr.blockedSeat !== seat) {
        entries.push({ kind: 'checkIdle', actorSeat: seat, actorRoleId: roleId });
      }
    }
  }

  // 8. WolfRobot learn
  if (state.wolfRobotReveal) {
    const wr = state.wolfRobotReveal;
    entries.push({
      kind: 'learn',
      actorSeat: requireSeatByRole(state.players, 'wolfRobot'),
      targetSeat: wr.targetSeat,
      learnedRoleId: wr.learnedRoleId,
    });
  } else {
    const wrSeat = findSeatByRole(state.players, 'wolfRobot');
    if (wrSeat !== undefined && nr.blockedSeat !== wrSeat) {
      entries.push({ kind: 'learnIdle', actorSeat: wrSeat });
    }
  }

  // 9. Hunter / DarkWolfKing canShoot status — confirmStatus is cleared on
  // step advance, so the engine's own step-entry rule is applied again here.
  const hunterSeat = findSeatByRole(state.players, 'hunter');
  if (hunterSeat !== undefined) {
    entries.push({
      kind: 'shootStatus',
      actorSeat: hunterSeat,
      actorRoleId: 'hunter',
      canShoot: computeCanShootForSeat(hunterSeat, state),
    });
  }

  const darkWolfKingSeat = findSeatByRole(state.players, 'darkWolfKing');
  if (darkWolfKingSeat !== undefined) {
    entries.push({
      kind: 'shootStatus',
      actorSeat: darkWolfKingSeat,
      actorRoleId: 'darkWolfKing',
      canShoot: computeCanShootForSeat(darkWolfKingSeat, state),
    });
  }

  // 10. Seed Wolf final infection outcome
  const seedWolfSeat = findSeatByRole(state.players, 'seedWolf');
  if (seedWolfSeat !== undefined) {
    const result = state.seedWolfInfectionResult;
    if (result?.outcome === 'converted') {
      entries.push({
        kind: 'infectConverted',
        actorSeat: seedWolfSeat,
        targetSeat: result.targetSeat,
      });
    } else if (result?.outcome === 'failed') {
      entries.push({
        kind: 'infectFailed',
        actorSeat: seedWolfSeat,
        targetSeat: result.targetSeat,
      });
    } else {
      entries.push({ kind: 'infectIdle', actorSeat: seedWolfSeat });
    }
  }

  // ── Interaction annotations ──

  // Same-guard-same-save warning. Only the engine's settled verdict
  // names the wolf target here: without a verdict target, no warning
  // is emitted, and the votes, the recorded save and the witch
  // context are never used to guess one.
  const verdict = state.resolvedWolfKillVerdict;
  const wolfTarget =
    verdict !== undefined &&
    verdict !== null &&
    (verdict.type === 'sharedTarget' ||
      verdict.type === 'splitKilled' ||
      verdict.type === 'tiePicked')
      ? verdict.targetSeat
      : undefined;
  if (wolfTarget !== undefined && nr.guardedSeat === wolfTarget && nr.savedSeat === wolfTarget) {
    entries.push({ kind: 'guardSaveConflict', targetSeat: wolfTarget });
  }

  // Poison immunity warning
  if (nr.poisonedSeat != null) {
    const poisonedPlayer = playerAt(state.players, nr.poisonedSeat);
    if (poisonedPlayer?.role) {
      const hasImmunity = ROLE_SPECS[poisonedPlayer.role]?.abilities?.some(
        (a) => a.type === 'passive' && a.effect === 'immuneToPoison',
      );
      if (hasImmunity) {
        entries.push({
          kind: 'poisonImmune',
          targetSeat: nr.poisonedSeat,
          targetRoleId: poisonedPlayer.role,
        });
      }
    }
  }

  // Damage reflection warning
  for (const { key, roleId } of DAMAGE_REFLECTION_REVEAL_CHECKS) {
    const reveal = state[key];
    if (reveal) {
      const targetPlayer = playerAt(state.players, reveal.targetSeat);
      if (targetPlayer?.role) {
        const reflects = ROLE_SPECS[targetPlayer.role]?.abilities?.some(
          (a) => a.type === 'passive' && a.effect === 'reflectsDamage',
        );
        if (reflects) {
          entries.push({
            kind: 'reflectDamage',
            checkerRoleId: roleId,
            targetSeat: reveal.targetSeat,
            targetRoleId: targetPlayer.role,
          });
        }
      }
    }
  }

  // 10. Final deaths
  const deaths = state.lastNightDeaths ?? [];
  if (deaths.length === 0) {
    entries.push({ kind: 'peacefulNight' });
  } else {
    const { deathReasons } = state;
    entries.push({
      kind: 'deaths',
      deaths: deaths.map((seat) => ({ seat, reason: deathReasons?.[seat] ?? null })),
    });
  }

  return entries;
}

// ─────────────────────────────────────────────────────────────────────────────
// Identity entries builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build per-seat identity entries sorted by seat.
 * Alive state derives from lastNightDeaths (night-1 scope: the only death set
 * the review state carries).
 */
export function buildIdentityEntries(
  players: Players,
  deadSeats: ReadonlySet<number>,
): NightReviewIdentityEntry[] {
  const entries: NightReviewIdentityEntry[] = [];
  const seats = Object.keys(players)
    .map(Number)
    .sort((a, b) => a - b);

  for (const seat of seats) {
    const player = playerAt(players, seat);
    entries.push({
      seat,
      roleId: player?.role ?? null,
      isEmptySeat: !player,
      isAlive: !deadSeats.has(seat),
    });
  }

  return entries;
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build full night review data from game state.
 */
export function getWerewolfNightReview(state: GameState): WerewolfNightReview {
  const sheriff = deriveSheriffSection(state);
  return {
    actions: buildActionEntries(state),
    identities: buildIdentityEntries(state.players, new Set(state.lastNightDeaths ?? [])),
    ...(sheriff !== undefined ? { sheriff } : {}),
  };
}
