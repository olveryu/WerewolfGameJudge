/**
 * NightReview.helpers - Pure functions: extract structured night review entries from LocalGameState
 *
 * First section: convert currentNightResults / lastNightDeaths / all check reveals to
 * structured action entries (category, seats, outcome semantics) in night-resolution order.
 * Second section: per-seat identity entries (seat, role, faction source, alive state).
 * Text rendering lives in the consumers (NightReviewReportBody renders structure
 * for the DOM surfaces; shareNightReviewLines formats the text channel). This
 * module emits no display strings.
 * No service / hook / React imports; relies only on game-engine types and ROLE_SPECS.
 */

import type { DeathReason } from '@game-judge/game-engine/games/werewolf/public';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { ROLE_SPECS } from '@game-judge/game-engine/games/werewolf/public';
import { Team } from '@game-judge/game-engine/games/werewolf/public';

import type { LocalGameState, LocalPlayer } from '@/games/werewolf/state/LocalGameState';

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

/** Resolve wolf kill target from majority vote. Tie = no kill. */
function resolveWolfKillTarget(
  wolfVotesBySeat: Readonly<Record<string, number>> | undefined,
): number | undefined {
  if (!wolfVotesBySeat) return undefined;
  const entries = Object.entries(wolfVotesBySeat);
  if (entries.length === 0) return undefined;
  const counts = new Map<number, number>();
  for (const [, target] of entries) {
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

/** One wolf's kill vote inside a wolfAttack entry. Seats are 0-based. */
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
  | { readonly kind: 'cardChoice'; readonly actorRoleId: RoleId; readonly chosenRoleId: RoleId }
  | { readonly kind: 'cupidLink'; readonly seats: readonly [number, number] }
  // Wolf team attack
  | { readonly kind: 'wolfAttack'; readonly votes: readonly NightReviewWolfVote[] }
  | { readonly kind: 'wolfNoTarget' }
  | { readonly kind: 'wolfGiveUp'; readonly reason: NightReviewWolfGiveUpReason }
  // Nightmare block / Eclipse Wolf Queen shelter / Hidden Wolf presence
  | {
      readonly kind: 'nightmareBlock';
      readonly targetSeat: number;
      readonly targetRoleId: RoleId | null;
    }
  | { readonly kind: 'nightmareIdle' }
  | { readonly kind: 'shelter'; readonly targetSeat: number }
  | { readonly kind: 'shelterIdle' }
  | { readonly kind: 'hiddenWolfConfirmed' }
  // Guard / elders
  | { readonly kind: 'guard'; readonly targetSeat: number }
  | { readonly kind: 'guardIdle' }
  | { readonly kind: 'silence'; readonly targetSeat: number }
  | { readonly kind: 'silenceIdle' }
  | { readonly kind: 'voteban'; readonly targetSeat: number }
  | { readonly kind: 'votebanIdle' }
  // Witch / Poisoner potions
  | { readonly kind: 'save'; readonly targetSeat: number }
  | {
      readonly kind: 'poison';
      readonly actorRoleId: 'witch' | 'poisoner';
      readonly targetSeat: number;
    }
  | { readonly kind: 'witchIdleAll' }
  | { readonly kind: 'witchNoSave' }
  | { readonly kind: 'witchNoPoison' }
  | { readonly kind: 'poisonerNoPoison' }
  // Crow / Dreamcatcher / Magician
  | { readonly kind: 'curse'; readonly targetSeat: number }
  | { readonly kind: 'curseIdle' }
  | { readonly kind: 'dream'; readonly targetSeat: number }
  | { readonly kind: 'dreamIdle' }
  | { readonly kind: 'swap'; readonly seats: readonly [number, number] }
  | { readonly kind: 'swapIdle' }
  // Idol choices / mimic / presence / charm / convert / hypnotize
  | { readonly kind: 'idolChoice'; readonly actorRoleId: RoleId; readonly targetSeat: number }
  | { readonly kind: 'mimic'; readonly targetSeat: number; readonly isBound: boolean }
  | { readonly kind: 'avengerConfirmed' }
  | { readonly kind: 'charm'; readonly targetSeat: number }
  | { readonly kind: 'charmIdle' }
  | { readonly kind: 'convert'; readonly targetSeat: number }
  | { readonly kind: 'hypnotize'; readonly targetSeats: readonly number[] }
  | { readonly kind: 'hypnotizeIdle' }
  // Check family / Wolf Robot learning
  | {
      readonly kind: 'check';
      readonly actorRoleId: RoleId;
      readonly targetSeat: number;
      readonly result: string;
    }
  | { readonly kind: 'checkIdle'; readonly actorRoleId: RoleId }
  | { readonly kind: 'learn'; readonly targetSeat: number; readonly learnedRoleId: RoleId }
  | { readonly kind: 'learnIdle' }
  // Shooting availability / Seed Wolf infection
  | { readonly kind: 'shootStatus'; readonly actorRoleId: RoleId; readonly canShoot: boolean }
  | { readonly kind: 'infectConverted'; readonly targetSeat: number }
  | { readonly kind: 'infectFailed'; readonly targetSeat: number }
  | { readonly kind: 'infectIdle' }
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

export interface NightReviewData {
  /** Structured night facts in summary order */
  actions: NightReviewActionEntry[];
  /** Per-seat identity entries sorted by seat */
  identities: NightReviewIdentityEntry[];
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
      actorRoleId: 'treasureMaster',
      chosenRoleId: gameState.currentNightResults.treasureMasterChosenCard,
    });
  }
  if (gameState.currentNightResults.thiefChosenCard) {
    entries.push({
      kind: 'cardChoice',
      actorRoleId: 'thief',
      chosenRoleId: gameState.currentNightResults.thiefChosenCard,
    });
  }
  if (gameState.loverSeats && gameState.loverSeats.length === 2) {
    entries.push({ kind: 'cupidLink', seats: [gameState.loverSeats[0], gameState.loverSeats[1]] });
  }

  // 1. Wolf kill vote
  if (nr.wolfVotesBySeat && Object.keys(nr.wolfVotesBySeat).length > 0) {
    const votes = Object.entries(nr.wolfVotesBySeat).map(([voter, target]) => ({
      voterSeat: Number(voter),
      targetSeat: target,
    }));
    entries.push({ kind: 'wolfAttack', votes });
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
      targetSeat: nr.blockedSeat,
      targetRoleId: blockedPlayer?.role ?? null,
    });
  } else {
    const nightmareSeat = findSeatByRole(gameState.players, 'nightmare');
    if (nightmareSeat !== undefined) {
      entries.push({ kind: 'nightmareIdle' });
    }
  }

  // 2a. EclipseWolfQueen shelter
  if (nr.shelteredSeat != null) {
    entries.push({ kind: 'shelter', targetSeat: nr.shelteredSeat });
  } else {
    const eqSeat = findSeatByRole(gameState.players, 'eclipseWolfQueen');
    if (eqSeat !== undefined && nr.blockedSeat !== eqSeat) {
      entries.push({ kind: 'shelterIdle' });
    }
  }

  // 2b. HiddenWolf reveal (confirm-only — just show presence)
  const hiddenWolfSeat = findSeatByRole(gameState.players, 'hiddenWolf');
  if (hiddenWolfSeat !== undefined) {
    entries.push({ kind: 'hiddenWolfConfirmed' });
  }

  // 3. Guard
  if (nr.guardedSeat != null) {
    entries.push({ kind: 'guard', targetSeat: nr.guardedSeat });
  } else {
    const guardSeat = findSeatByRole(gameState.players, 'guard');
    if (guardSeat !== undefined && nr.blockedSeat !== guardSeat) {
      entries.push({ kind: 'guardIdle' });
    }
  }

  // 3a. SilenceElder
  if (nr.silencedSeat != null) {
    entries.push({ kind: 'silence', targetSeat: nr.silencedSeat });
  } else {
    const seSeat = findSeatByRole(gameState.players, 'silenceElder');
    if (seSeat !== undefined && nr.blockedSeat !== seSeat) {
      entries.push({ kind: 'silenceIdle' });
    }
  }

  // 3b. VotebanElder
  if (nr.votebannedSeat != null) {
    entries.push({ kind: 'voteban', targetSeat: nr.votebannedSeat });
  } else {
    const veSeat = findSeatByRole(gameState.players, 'votebanElder');
    if (veSeat !== undefined && nr.blockedSeat !== veSeat) {
      entries.push({ kind: 'votebanIdle' });
    }
  }

  // 4. Witch / Poisoner
  if (nr.savedSeat != null) {
    entries.push({ kind: 'save', targetSeat: nr.savedSeat });
  }
  if (nr.poisonedSeat != null) {
    const isPoisoner = findSeatByRole(gameState.players, 'poisoner') !== undefined;
    entries.push({
      kind: 'poison',
      actorRoleId: isPoisoner ? 'poisoner' : 'witch',
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
        entries.push({ kind: 'witchIdleAll' });
      } else {
        if (noSave) entries.push({ kind: 'witchNoSave' });
        if (witchOwnsPoison && noPoison) entries.push({ kind: 'witchNoPoison' });
      }
    }
    if (poisonerSeat !== undefined && !poisonerBlocked && nr.poisonedSeat == null) {
      entries.push({ kind: 'poisonerNoPoison' });
    }
  }

  // 4a. Crow curse
  if (nr.cursedSeat != null) {
    entries.push({ kind: 'curse', targetSeat: nr.cursedSeat });
  } else {
    const crowSeat = findSeatByRole(gameState.players, 'crow');
    if (crowSeat !== undefined && nr.blockedSeat !== crowSeat) {
      entries.push({ kind: 'curseIdle' });
    }
  }

  // 5. Dreamcatcher
  if (nr.dreamingSeat != null) {
    entries.push({ kind: 'dream', targetSeat: nr.dreamingSeat });
  } else {
    const dcSeat = findSeatByRole(gameState.players, 'dreamcatcher');
    if (dcSeat !== undefined && nr.blockedSeat !== dcSeat) {
      entries.push({ kind: 'dreamIdle' });
    }
  }

  // 6. Magician swap
  if (nr.swappedSeats) {
    entries.push({ kind: 'swap', seats: [nr.swappedSeats[0], nr.swappedSeats[1]] });
  } else {
    const magicianSeat = findSeatByRole(gameState.players, 'magician');
    if (magicianSeat !== undefined && nr.blockedSeat !== magicianSeat) {
      entries.push({ kind: 'swapIdle' });
    }
  }

  // 6a. Slacker idol (from actions Map)
  const slackerAction = gameState.actions.get('slacker');
  if (slackerAction && slackerAction.kind === 'target') {
    entries.push({
      kind: 'idolChoice',
      actorRoleId: 'slacker',
      targetSeat: slackerAction.targetSeat,
    });
  }

  // 6b. WildChild idol (from actions Map)
  const wildChildAction = gameState.actions.get('wildChild');
  if (wildChildAction && wildChildAction.kind === 'target') {
    entries.push({
      kind: 'idolChoice',
      actorRoleId: 'wildChild',
      targetSeat: wildChildAction.targetSeat,
    });
  }

  // 6b2. Shadow mimic
  if (nr.shadowMimicTarget != null) {
    entries.push({
      kind: 'mimic',
      targetSeat: nr.shadowMimicTarget,
      isBound: nr.avengerFaction === Team.Third,
    });
  }

  // 6b3. Avenger faction (always participates, just show presence)
  const avengerSeat = findSeatByRole(gameState.players, 'avenger');
  if (avengerSeat !== undefined) {
    entries.push({ kind: 'avengerConfirmed' });
  }

  // 6c. WolfQueen charm (from actions Map)
  const wolfQueenAction = gameState.actions.get('wolfQueen');
  if (wolfQueenAction && wolfQueenAction.kind === 'target') {
    entries.push({ kind: 'charm', targetSeat: wolfQueenAction.targetSeat });
  } else {
    const wqSeat = findSeatByRole(gameState.players, 'wolfQueen');
    if (wqSeat !== undefined && nr.blockedSeat !== wqSeat) {
      entries.push({ kind: 'charmIdle' });
    }
  }

  // 6d. AwakenedGargoyle convert
  if (nr.convertedSeat != null) {
    entries.push({ kind: 'convert', targetSeat: nr.convertedSeat });
  }

  // 6e. Piper hypnotize
  if (nr.hypnotizedSeats && nr.hypnotizedSeats.length > 0) {
    entries.push({ kind: 'hypnotize', targetSeats: [...nr.hypnotizedSeats] });
  } else {
    const piperSeat = findSeatByRole(gameState.players, 'piper');
    if (piperSeat !== undefined && nr.blockedSeat !== piperSeat) {
      entries.push({ kind: 'hypnotizeIdle' });
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
        actorRoleId: roleId,
        targetSeat: reveal.targetSeat,
        result: reveal.result,
      });
    } else {
      const seat = findSeatByRole(gameState.players, roleId);
      if (seat !== undefined && nr.blockedSeat !== seat) {
        entries.push({ kind: 'checkIdle', actorRoleId: roleId });
      }
    }
  }

  // 8. WolfRobot learn
  if (gameState.wolfRobotReveal) {
    const wr = gameState.wolfRobotReveal;
    entries.push({
      kind: 'learn',
      targetSeat: wr.targetSeat,
      learnedRoleId: wr.learnedRoleId,
    });
  } else {
    const wrSeat = findSeatByRole(gameState.players, 'wolfRobot');
    if (wrSeat !== undefined && nr.blockedSeat !== wrSeat) {
      entries.push({ kind: 'learnIdle' });
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
      actorRoleId: 'hunter',
      canShoot: canShootForSeat(hunterSeat, gameState),
    });
  }

  const darkWolfKingSeat = findSeatByRole(gameState.players, 'darkWolfKing');
  if (darkWolfKingSeat !== undefined) {
    entries.push({
      kind: 'shootStatus',
      actorRoleId: 'darkWolfKing',
      canShoot: canShootForSeat(darkWolfKingSeat, gameState),
    });
  }

  // 10. Seed Wolf final infection outcome
  const seedWolfSeat = findSeatByRole(gameState.players, 'seedWolf');
  if (seedWolfSeat !== undefined) {
    const result = gameState.seedWolfInfectionResult;
    if (result?.outcome === 'converted') {
      entries.push({ kind: 'infectConverted', targetSeat: result.targetSeat });
    } else if (result?.outcome === 'failed') {
      entries.push({ kind: 'infectFailed', targetSeat: result.targetSeat });
    } else {
      entries.push({ kind: 'infectIdle' });
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
  return {
    actions: buildActionEntries(gameState),
    identities: buildIdentityEntries(gameState.players, new Set(gameState.lastNightDeaths)),
  };
}
