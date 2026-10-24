/**
 * NightReview.helpers - Pure functions: extract structured night review entries from LocalGameState
 *
 * First section: convert currentNightResults / lastNightDeaths / all check reveals to
 * structured action entries (category, seats, outcome semantics) in night-resolution order.
 * Second section: per-seat identity entries (seat, role, faction source, alive state).
 * Text rendering lives in the consumers (NightReviewReportBody renders structure
 * for the DOM surfaces; shareNightReviewLines formats the text channel). This
 * module emits no display strings. Its derivations — getNightReviewOutcome,
 * deriveNightReportStats, deriveWolfVerdict, deriveDeathNotes,
 * deriveWolfTargetSaveNote, deriveSheriffSection — lift every fact a surface
 * headlines or annotates from the same entries, so no surface re-derives
 * facts on its own.
 * No service / hook / React imports; relies only on game-engine types and ROLE_SPECS.
 */

import type { DeathReason } from '@game-judge/game-engine/games/werewolf/public';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import type {
  SheriffElectionResult,
  SheriffElectionState,
} from '@game-judge/game-engine/games/werewolf/public';
import { ROLE_SPECS } from '@game-judge/game-engine/games/werewolf/public';
import { Team } from '@game-judge/game-engine/games/werewolf/public';

import type { LocalGameState, LocalPlayer } from '@/games/werewolf/state/LocalGameState';

import type { SheriffRoundRecord } from './sheriffElectionRecord';
import {
  deriveSheriffRoundRecord,
  getSheriffCandidateRecords,
  getSheriffVoteProgress,
} from './sheriffElectionRecord';

// ─────────────────────────────────────────────────────────────────────────────
// Death reason labels
// ─────────────────────────────────────────────────────────────────────────────

export const DEATH_REASON_LABELS: Record<DeathReason, string> = {
  wolfKill: '狼杀',
  poison: '毒杀',
  checkDeath: '查验致死',
  wolfQueenLink: '魅惑连锁',
  bondedLink: '绑定连锁',
  coupleLink: '殉情',
  dreamcatcherLink: '摄梦连锁',
  reflection: '反伤',
  magicianSwap: '魔术师交换',
};

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

/** Find the seat of a player with the given role (0-based), or undefined. */
function findSeatByRole(
  players: Map<number, LocalPlayer | null>,
  roleId: RoleId,
): number | undefined {
  for (const [seat, player] of players) {
    if (player?.role === roleId) return seat;
  }
  return undefined;
}

/**
 * The seat of the role an action entry is about to name as its actor. The
 * night-results record carries no actor fields (only target seats), so the
 * actor is resolved from the roster at the construction point. An entry whose
 * actor cannot be resolved is a corrupt fact set — fail fast here rather
 * than letting a surface invent or drop the actor downstream.
 */
function requireSeatByRole(players: Map<number, LocalPlayer | null>, roleId: RoleId): number {
  const seat = findSeatByRole(players, roleId);
  if (seat === undefined) {
    throw new Error(`[FAIL-FAST] Night review cannot resolve an actor seat for role ${roleId}`);
  }
  return seat;
}

/**
 * Whether the seat will die tonight (wolf-killed without save, or poisoned).
 * Used as a sub-condition for chain-death determination.
 */
function willDieTonight(seat: number, gameState: LocalGameState): boolean {
  const nr = gameState.currentNightResults;

  if (nr.poisonedSeat === seat) return true;

  const wolfKillTarget = gameState.witchContext?.killedSeat;
  if (wolfKillTarget !== undefined && wolfKillTarget >= 0 && wolfKillTarget === seat) {
    if (nr.savedSeat === seat) return false;
    return true;
  }

  return false;
}

/**
 * Whether the seat's Hunter/Dark Wolf King can shoot.
 *
 * Can only trigger when wolf-killed or exile-voted out.
 * Cannot shoot on abnormal night death (poison / lover suicide / dreamcatcher chain / charm chain).
 */
function canShootForSeat(seat: number, gameState: LocalGameState): boolean {
  const nr = gameState.currentNightResults;

  // Poisoned
  if (nr.poisonedSeat === seat) return false;

  // Lover suicide
  const loverSeats = gameState.loverSeats;
  if (loverSeats && loverSeats.includes(seat)) {
    const partnerSeat = loverSeats[0] === seat ? loverSeats[1] : loverSeats[0];
    if (willDieTonight(partnerSeat, gameState)) return false;
  }

  // Dreamcatcher chain
  if (nr.dreamingSeat === seat) {
    const dcSeat = findSeatByRole(gameState.players, 'dreamcatcher');
    if (dcSeat !== undefined && willDieTonight(dcSeat, gameState)) return false;
  }

  // Eclipse Wolf Queen charm chain
  if (nr.charmedSeat === seat) {
    const wqSeat = findSeatByRole(gameState.players, 'wolfQueen');
    if (wqSeat !== undefined && willDieTonight(wqSeat, gameState)) return false;
  }

  return true;
}

/**
 * Resolve wolf kill target from majority vote. Tie = no kill.
 * Abstentions (target -1, the sentinel the engine's wolfKillResolver records
 * for an empty vote) do not participate in the count — this mirrors the
 * engine's resolveWolfVotes convention, which filters -1 before tallying;
 * counting an abstention as a target would manufacture ties and suppress
 * the guard-save-conflict annotation on nights a wolf abstained.
 */
function resolveWolfKillTarget(
  wolfVotesBySeat: Readonly<Record<string, number>> | undefined,
): number | undefined {
  if (!wolfVotesBySeat) return undefined;
  const entries = Object.entries(wolfVotesBySeat);
  if (entries.length === 0) return undefined;
  const counts = new Map<number, number>();
  for (const [, target] of entries) {
    if (target === -1) continue;
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  let maxCount = 0;
  let maxTarget: number | undefined;
  let tied = false;
  for (const [target, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxTarget = target;
      tied = false;
    } else if (count === maxCount) {
      tied = true;
    }
  }
  return tied ? undefined : maxTarget;
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

export interface NightReviewData {
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
 * How the wolf team's votes resolved, derived from a wolfAttack entry:
 * one shared target, a split vote that still produced a plurality kill, a
 * split vote tied at the top (no kill), or every wolf abstaining.
 */
export type NightReviewWolfVerdict =
  | { readonly type: 'sharedTarget'; readonly targetSeat: number }
  | { readonly type: 'splitKilled'; readonly targetSeat: number }
  | { readonly type: 'splitTied' }
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
 * malformed NightReviewData and fails fast instead of rendering a wrong hero.
 * Shared by the DOM report hero and the canvas outcome line — one derivation.
 */
export function getNightReviewOutcome(data: NightReviewData): NightReviewOutcome {
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
 * Derive how a wolfAttack entry's votes resolved. The tally mirrors
 * resolveWolfKillTarget (plurality wins, a tie at the top kills nobody);
 * the entry's votes already exclude abstentions, which were split into
 * abstainSeats by the builder.
 */
export function deriveWolfVerdict(
  entry: Extract<NightReviewActionEntry, { kind: 'wolfAttack' }>,
): NightReviewWolfVerdict {
  if (entry.votes.length === 0) return { type: 'allAbstain' };
  const counts = new Map<number, number>();
  for (const vote of entry.votes) {
    counts.set(vote.targetSeat, (counts.get(vote.targetSeat) ?? 0) + 1);
  }
  let maxCount = 0;
  let maxTarget: number | undefined;
  let tied = false;
  for (const [target, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxTarget = target;
      tied = false;
    } else if (count === maxCount) {
      tied = true;
    }
  }
  if (tied || maxTarget === undefined) return { type: 'splitTied' };
  return counts.size === 1
    ? { type: 'sharedTarget', targetSeat: maxTarget }
    : { type: 'splitKilled', targetSeat: maxTarget };
}

/**
 * Derive the stats-strip tallies from the entries. Death categories come
 * from the single outcome entry (the same source the headline reads), and
 * the derivation cross-checks it: a seat listed twice is a corrupt outcome
 * and fails fast.
 */
export function deriveNightReportStats(data: NightReviewData): NightReportStats {
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
export function deriveDeathNotes(data: NightReviewData): ReadonlyMap<number, NightReviewDeathNote> {
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
  data: NightReviewData,
): { readonly wolfTargetSeat: number } | null {
  const wolfEntry = data.actions.find((entry) => entry.kind === 'wolfAttack');
  if (wolfEntry?.kind !== 'wolfAttack') return null;
  const verdict = deriveWolfVerdict(wolfEntry);
  if (verdict.type !== 'sharedTarget' && verdict.type !== 'splitKilled') return null;
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
export function deriveSheriffSection(
  gameState: LocalGameState,
): NightReviewSheriffSection | undefined {
  const election = gameState.sheriffElection;
  const result = gameState.sheriffElectionResult;
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
export function buildActionEntries(gameState: LocalGameState): NightReviewActionEntry[] {
  const entries: NightReviewActionEntry[] = [];
  const nr = gameState.currentNightResults;

  // 0. TreasureMaster: bottom cards composition + card choice + skipped roles
  if (gameState.bottomCards && gameState.bottomCards.length > 0) {
    entries.push({ kind: 'bottomCards', roleIds: [...gameState.bottomCards] });
  }
  if (gameState.currentNightResults.treasureMasterChosenCard) {
    entries.push({
      kind: 'cardChoice',
      actorSeat: requireSeatByRole(gameState.players, 'treasureMaster'),
      actorRoleId: 'treasureMaster',
      chosenRoleId: gameState.currentNightResults.treasureMasterChosenCard,
    });
  }
  if (gameState.currentNightResults.thiefChosenCard) {
    entries.push({
      kind: 'cardChoice',
      actorSeat: requireSeatByRole(gameState.players, 'thief'),
      actorRoleId: 'thief',
      chosenRoleId: gameState.currentNightResults.thiefChosenCard,
    });
  }
  if (gameState.loverSeats && gameState.loverSeats.length === 2) {
    entries.push({
      kind: 'cupidLink',
      actorSeat: requireSeatByRole(gameState.players, 'cupid'),
      seats: [gameState.loverSeats[0], gameState.loverSeats[1]],
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
    entries.push({ kind: 'wolfAttack', votes, abstainSeats });
  } else if (
    !nr.wolfKillOverride &&
    Array.from(gameState.players.values()).some(
      (p) => p?.role && ROLE_SPECS[p.role]?.team === Team.Wolf,
    )
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
    const blockedPlayer = gameState.players.get(nr.blockedSeat);
    entries.push({
      kind: 'nightmareBlock',
      actorSeat: requireSeatByRole(gameState.players, 'nightmare'),
      targetSeat: nr.blockedSeat,
      targetRoleId: blockedPlayer?.role ?? null,
    });
  } else {
    const nightmareSeat = findSeatByRole(gameState.players, 'nightmare');
    if (nightmareSeat !== undefined) {
      entries.push({ kind: 'nightmareIdle', actorSeat: nightmareSeat });
    }
  }

  // 2a. EclipseWolfQueen shelter
  if (nr.shelteredSeat != null) {
    entries.push({
      kind: 'shelter',
      actorSeat: requireSeatByRole(gameState.players, 'eclipseWolfQueen'),
      targetSeat: nr.shelteredSeat,
    });
  } else {
    const eqSeat = findSeatByRole(gameState.players, 'eclipseWolfQueen');
    if (eqSeat !== undefined && nr.blockedSeat !== eqSeat) {
      entries.push({ kind: 'shelterIdle', actorSeat: eqSeat });
    }
  }

  // 2b. HiddenWolf reveal (confirm-only — just show presence)
  const hiddenWolfSeat = findSeatByRole(gameState.players, 'hiddenWolf');
  if (hiddenWolfSeat !== undefined) {
    entries.push({ kind: 'hiddenWolfConfirmed', actorSeat: hiddenWolfSeat });
  }

  // 3. Guard
  if (nr.guardedSeat != null) {
    entries.push({
      kind: 'guard',
      actorSeat: requireSeatByRole(gameState.players, 'guard'),
      targetSeat: nr.guardedSeat,
    });
  } else {
    const guardSeat = findSeatByRole(gameState.players, 'guard');
    if (guardSeat !== undefined && nr.blockedSeat !== guardSeat) {
      entries.push({ kind: 'guardIdle', actorSeat: guardSeat });
    }
  }

  // 3a. SilenceElder
  if (nr.silencedSeat != null) {
    entries.push({
      kind: 'silence',
      actorSeat: requireSeatByRole(gameState.players, 'silenceElder'),
      targetSeat: nr.silencedSeat,
    });
  } else {
    const seSeat = findSeatByRole(gameState.players, 'silenceElder');
    if (seSeat !== undefined && nr.blockedSeat !== seSeat) {
      entries.push({ kind: 'silenceIdle', actorSeat: seSeat });
    }
  }

  // 3b. VotebanElder
  if (nr.votebannedSeat != null) {
    entries.push({
      kind: 'voteban',
      actorSeat: requireSeatByRole(gameState.players, 'votebanElder'),
      targetSeat: nr.votebannedSeat,
    });
  } else {
    const veSeat = findSeatByRole(gameState.players, 'votebanElder');
    if (veSeat !== undefined && nr.blockedSeat !== veSeat) {
      entries.push({ kind: 'votebanIdle', actorSeat: veSeat });
    }
  }

  // 4. Witch / Poisoner
  if (nr.savedSeat != null) {
    entries.push({
      kind: 'save',
      actorSeat: requireSeatByRole(gameState.players, 'witch'),
      targetSeat: nr.savedSeat,
    });
  }
  if (nr.poisonedSeat != null) {
    const poisonerSeat = findSeatByRole(gameState.players, 'poisoner');
    entries.push({
      kind: 'poison',
      actorSeat: poisonerSeat ?? requireSeatByRole(gameState.players, 'witch'),
      actorRoleId: poisonerSeat !== undefined ? 'poisoner' : 'witch',
      targetSeat: nr.poisonedSeat,
    });
  }

  // 4x. Witch/Poisoner "did nothing" annotations
  {
    const witchSeat = findSeatByRole(gameState.players, 'witch');
    const poisonerSeat = findSeatByRole(gameState.players, 'poisoner');
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
      actorSeat: requireSeatByRole(gameState.players, 'crow'),
      targetSeat: nr.cursedSeat,
    });
  } else {
    const crowSeat = findSeatByRole(gameState.players, 'crow');
    if (crowSeat !== undefined && nr.blockedSeat !== crowSeat) {
      entries.push({ kind: 'curseIdle', actorSeat: crowSeat });
    }
  }

  // 5. Dreamcatcher
  if (nr.dreamingSeat != null) {
    entries.push({
      kind: 'dream',
      actorSeat: requireSeatByRole(gameState.players, 'dreamcatcher'),
      targetSeat: nr.dreamingSeat,
    });
  } else {
    const dcSeat = findSeatByRole(gameState.players, 'dreamcatcher');
    if (dcSeat !== undefined && nr.blockedSeat !== dcSeat) {
      entries.push({ kind: 'dreamIdle', actorSeat: dcSeat });
    }
  }

  // 6. Magician swap
  if (nr.swappedSeats) {
    entries.push({
      kind: 'swap',
      actorSeat: requireSeatByRole(gameState.players, 'magician'),
      seats: [nr.swappedSeats[0], nr.swappedSeats[1]],
    });
  } else {
    const magicianSeat = findSeatByRole(gameState.players, 'magician');
    if (magicianSeat !== undefined && nr.blockedSeat !== magicianSeat) {
      entries.push({ kind: 'swapIdle', actorSeat: magicianSeat });
    }
  }

  // 6a. Slacker idol (from actions Map)
  const slackerAction = gameState.actions.get('slacker');
  if (slackerAction && slackerAction.kind === 'target') {
    entries.push({
      kind: 'idolChoice',
      actorSeat: requireSeatByRole(gameState.players, 'slacker'),
      actorRoleId: 'slacker',
      targetSeat: slackerAction.targetSeat,
    });
  }

  // 6b. WildChild idol (from actions Map)
  const wildChildAction = gameState.actions.get('wildChild');
  if (wildChildAction && wildChildAction.kind === 'target') {
    entries.push({
      kind: 'idolChoice',
      actorSeat: requireSeatByRole(gameState.players, 'wildChild'),
      actorRoleId: 'wildChild',
      targetSeat: wildChildAction.targetSeat,
    });
  }

  // 6b2. Shadow mimic
  if (nr.shadowMimicTarget != null) {
    entries.push({
      kind: 'mimic',
      actorSeat: requireSeatByRole(gameState.players, 'shadow'),
      targetSeat: nr.shadowMimicTarget,
      isBound: nr.avengerFaction === Team.Third,
    });
  }

  // 6b3. Avenger faction (always participates, just show presence)
  const avengerSeat = findSeatByRole(gameState.players, 'avenger');
  if (avengerSeat !== undefined) {
    entries.push({ kind: 'avengerConfirmed', actorSeat: avengerSeat });
  }

  // 6c. WolfQueen charm (from actions Map)
  const wolfQueenAction = gameState.actions.get('wolfQueen');
  if (wolfQueenAction && wolfQueenAction.kind === 'target') {
    entries.push({
      kind: 'charm',
      actorSeat: requireSeatByRole(gameState.players, 'wolfQueen'),
      targetSeat: wolfQueenAction.targetSeat,
    });
  } else {
    const wqSeat = findSeatByRole(gameState.players, 'wolfQueen');
    if (wqSeat !== undefined && nr.blockedSeat !== wqSeat) {
      entries.push({ kind: 'charmIdle', actorSeat: wqSeat });
    }
  }

  // 6d. AwakenedGargoyle convert
  if (nr.convertedSeat != null) {
    entries.push({
      kind: 'convert',
      actorSeat: requireSeatByRole(gameState.players, 'awakenedGargoyle'),
      targetSeat: nr.convertedSeat,
    });
  }

  // 6e. Piper hypnotize
  if (nr.hypnotizedSeats && nr.hypnotizedSeats.length > 0) {
    entries.push({
      kind: 'hypnotize',
      actorSeat: requireSeatByRole(gameState.players, 'piper'),
      targetSeats: [...nr.hypnotizedSeats],
    });
  } else {
    const piperSeat = findSeatByRole(gameState.players, 'piper');
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
    const reveal = gameState[key];
    if (reveal) {
      entries.push({
        kind: 'check',
        actorSeat: requireSeatByRole(gameState.players, roleId),
        actorRoleId: roleId,
        targetSeat: reveal.targetSeat,
        result: reveal.result,
      });
    } else {
      const seat = findSeatByRole(gameState.players, roleId);
      if (seat !== undefined && nr.blockedSeat !== seat) {
        entries.push({ kind: 'checkIdle', actorSeat: seat, actorRoleId: roleId });
      }
    }
  }

  // 8. WolfRobot learn
  if (gameState.wolfRobotReveal) {
    const wr = gameState.wolfRobotReveal;
    entries.push({
      kind: 'learn',
      actorSeat: requireSeatByRole(gameState.players, 'wolfRobot'),
      targetSeat: wr.targetSeat,
      learnedRoleId: wr.learnedRoleId,
    });
  } else {
    const wrSeat = findSeatByRole(gameState.players, 'wolfRobot');
    if (wrSeat !== undefined && nr.blockedSeat !== wrSeat) {
      entries.push({ kind: 'learnIdle', actorSeat: wrSeat });
    }
  }

  // 9. Hunter / DarkWolfKing canShoot status
  // confirmStatus is cleared on step advance, so we re-derive canShoot.
  // Rule: can only trigger when wolf-killed or exile-voted out.
  // Cannot shoot on abnormal night death (poison / lover suicide / dreamcatcher chain / charm chain).
  const hunterSeat = findSeatByRole(gameState.players, 'hunter');
  if (hunterSeat !== undefined) {
    entries.push({
      kind: 'shootStatus',
      actorSeat: hunterSeat,
      actorRoleId: 'hunter',
      canShoot: canShootForSeat(hunterSeat, gameState),
    });
  }

  const darkWolfKingSeat = findSeatByRole(gameState.players, 'darkWolfKing');
  if (darkWolfKingSeat !== undefined) {
    entries.push({
      kind: 'shootStatus',
      actorSeat: darkWolfKingSeat,
      actorRoleId: 'darkWolfKing',
      canShoot: canShootForSeat(darkWolfKingSeat, gameState),
    });
  }

  // 10. Seed Wolf final infection outcome
  const seedWolfSeat = findSeatByRole(gameState.players, 'seedWolf');
  if (seedWolfSeat !== undefined) {
    const result = gameState.seedWolfInfectionResult;
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

  // Same-guard-same-save warning
  const wolfTarget = resolveWolfKillTarget(nr.wolfVotesBySeat);
  if (wolfTarget !== undefined && nr.guardedSeat === wolfTarget && nr.savedSeat === wolfTarget) {
    entries.push({ kind: 'guardSaveConflict', targetSeat: wolfTarget });
  }

  // Poison immunity warning
  if (nr.poisonedSeat != null) {
    const poisonedPlayer = gameState.players.get(nr.poisonedSeat);
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
    const reveal = gameState[key];
    if (reveal) {
      const targetPlayer = gameState.players.get(reveal.targetSeat);
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
  const deaths = gameState.lastNightDeaths;
  if (deaths.length === 0) {
    entries.push({ kind: 'peacefulNight' });
  } else {
    const { deathReasons } = gameState;
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
  players: Map<number, LocalPlayer | null>,
  deadSeats: ReadonlySet<number>,
): NightReviewIdentityEntry[] {
  const entries: NightReviewIdentityEntry[] = [];
  const seats = Array.from(players.keys()).sort((a, b) => a - b);

  for (const seat of seats) {
    const player = players.get(seat);
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
export function buildNightReviewData(gameState: LocalGameState): NightReviewData {
  const sheriff = deriveSheriffSection(gameState);
  return {
    actions: buildActionEntries(gameState),
    identities: buildIdentityEntries(gameState.players, new Set(gameState.lastNightDeaths)),
    ...(sheriff !== undefined ? { sheriff } : {}),
  };
}
