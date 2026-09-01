/**
 * DeathCalculator - Pure function module for calculating night deaths
 *
 * This module contains all death calculation logic.
 * It is a pure function with no side effects, no state access, and no external dependencies.
 *
 * Responsibilities:
 * - Receive night action data (semantically clear, structured types)
 * - Apply game rules to determine who dies
 * - Return list of dead seats
 *
 * NOT responsible for:
 * - Accessing internal game state
 * - Calling external services / Broadcast
 * - Playing audio
 * - Modifying any UI
 */

import {
  getWitchPoisonTarget,
  getWitchSaveTarget,
  type WitchAction,
} from './models/actions/WitchAction';

// =============================================================================
// Types
// =============================================================================

/**
 * Death reason — tracks WHY a player died (primary cause).
 *
 * Each value corresponds to a rule processor in the death calculation pipeline.
 * A seat can only have one death reason (last-write-wins for swaps/links that
 * override an earlier death).
 */
export type DeathReason =
  | 'wolfKill'
  | 'poison'
  | 'checkDeath'
  | 'wolfQueenLink'
  | 'bondedLink'
  | 'coupleLink'
  | 'dreamcatcherLink'
  | 'reflection'
  | 'magicianSwap';

/** Detailed death calculation result */
export interface DeathsDetailed {
  /** Dead seat numbers, sorted ascending */
  deaths: number[];
  /** Map of seat → primary death reason */
  deathReasons: Record<number, DeathReason>;
  /** Every contributing source, retained when later rules replace the primary reason. */
  deathSources: Record<number, readonly DeathReason[]>;
}

/**
 * Night actions with semantically clear fields (structured types)
 * All seat numbers are 0-based indices.
 */
export interface NightActions {
  /** Wolf kill target seat. undefined = no kill, or empty kill */
  wolfKill?: number;

  /** Guard protection target seat. undefined = not used */
  guardProtect?: number;

  /** Witch action (structured type) */
  witchAction?: WitchAction;

  /** Wolf Queen charm target seat. undefined = not used */
  wolfQueenCharm?: number;

  /** Dreamcatcher dream target seat. undefined = not used */
  dreamcatcherDream?: number;

  /** Magician swap targets. undefined = not used */
  magicianSwap?: { first: number; second: number };

  /**
   * Nightmare block target seat. undefined = not used.
   * The blocked player's night skill is nullified for this night.
   */
  nightmareBlock?: number;

  /**
   * Whether nightmare blocked a wolf player on night 1.
   * When true, the wolf kill is nullified (wolves cannot kill).
   */
  isWolfBlockedByNightmare?: boolean;

  /** Converted target whose wolf-kill damage is replaced by infection. */
  seedWolfInfectedSeat?: number;
}

/**
 * Reflection source — a pair of (attacker seat, target seat) where reflection may apply.
 *
 * Built externally from NightActions + spec scan; DeathCalculator only loops over the list.
 * Nightmare-blocked sources are excluded at construction time.
 */
export interface ReflectionSource {
  /** The seat of the role that performed a check or poison action */
  readonly sourceSeat: number;
  /** The seat of the target that was checked or poisoned */
  readonly targetSeat: number;
}

/**
 * Role seat mapping for context-dependent death rules
 * All seat numbers are 0-based indices. -1 means role not present.
 */
export interface RoleSeatMap {
  /** Wolf Queen seat (for link death check). -1 if not present */
  wolfQueenLinkSeat: number;

  /** Dreamcatcher seat (for link death check). -1 if not present */
  dreamcatcherLinkSeat: number;

  /** Poison source seat (witch or poisoner, driven by deathCalcRole: 'poisonSource'). -1 if not present */
  poisonSourceSeat: number;

  /** Guard seat (for nightmare block check). -1 if not present */
  guardProtectorSeat: number;

  /** Seats of roles with immuneToPoison flag (witcher, dancer, masquerade, spiritKnight, etc.) */
  poisonImmuneSeats: number[];

  /** Seats of roles with reflectsDamage flag (spiritKnight, etc.) */
  reflectsDamageSeats: number[];

  /** Seats of roles with silentWolfKillImmune (cursedFox: wolves can target but kill is silently negated) */
  wolfKillSilentImmuneSeats: number[];

  /**
   * Seats of roles vulnerable to check death (cursedFox: dies when checked by seer family).
   * Only populated with seats that were ACTUALLY checked this night.
   */
  checkDeathTargetSeats: number[];

  /** Pre-built reflection pairs (check/poison source → target). Empty = no reflection possible */
  reflectionSources: readonly ReflectionSource[];

  /**
   * Bonded link seats (shadow ↔ avenger). null = bonded link not active.
   * When active, if either seat dies, the other dies too.
   */
  bondedLinkSeats: readonly [number, number] | null;

  /**
   * Couple link seats (cupid lovers). null = no lovers.
   * When active, if either seat dies, the other dies too (lover suicide).
   */
  coupleLinkSeats: readonly [number, number] | null;
}

/**
 * Default role seat map (all roles not present)
 */
const DEFAULT_ROLE_SEAT_MAP: RoleSeatMap = {
  wolfQueenLinkSeat: -1,
  dreamcatcherLinkSeat: -1,
  poisonSourceSeat: -1,
  guardProtectorSeat: -1,
  poisonImmuneSeats: [],
  reflectsDamageSeats: [],
  wolfKillSilentImmuneSeats: [],
  checkDeathTargetSeats: [],
  reflectionSources: [],
  bondedLinkSeats: null,
  coupleLinkSeats: null,
};

// =============================================================================
// Death Calculation
// =============================================================================

/**
 * Calculate deaths from night actions.
 *
 * @param actions - Night actions (semantically clear, no encoding)
 * @param roleSeatMap - Role seat mapping for context-dependent rules
 * @returns Array of dead seat numbers (0-based), sorted ascending
 */
export function calculateDeaths(
  actions: NightActions,
  roleSeatMap: RoleSeatMap = DEFAULT_ROLE_SEAT_MAP,
): number[] {
  return calculateDeathsDetailed(actions, roleSeatMap).deaths;
}

/**
 * Calculate deaths with detailed reason tracking.
 *
 * Always tracks why each player died. Each processXxx writes a reason alongside
 * the death. Callers that need only the death list should use calculateDeaths().
 *
 * @param actions - Night actions (semantically clear, no encoding)
 * @param roleSeatMap - Role seat mapping for context-dependent rules
 * @returns Deaths array (sorted) + per-seat death reasons
 */
export function calculateDeathsDetailed(
  actions: NightActions,
  roleSeatMap: RoleSeatMap = DEFAULT_ROLE_SEAT_MAP,
): DeathsDetailed {
  const deaths = new Set<number>();
  const reasons = new Map<number, DeathReason>();
  const sources = new Map<number, Set<DeathReason>>();

  // Order matters: some effects depend on prior death state

  // 1. Process wolf kill (with guard/witch/nightmare interaction)
  processWolfKill(actions, roleSeatMap, deaths, reasons, sources);

  // 1.5. Process check death (cursedFox: dies when checked by seer family)
  processCheckDeath(roleSeatMap, deaths, reasons, sources);

  // 2. Process poison death (witch or poisoner, with immunity and nightmare block)
  processPoisonDeath(actions, roleSeatMap, deaths, reasons, sources);

  // 3. Process wolf queen link death
  processWolfQueenLink(actions, roleSeatMap, deaths, reasons, sources);

  // 3.5. Process bonded link death (shadow ↔ avenger)
  processBondedLink(roleSeatMap, deaths, reasons, sources);

  // 3.6. Process couple link death (cupid lovers — lover suicide)
  processCoupleLink(roleSeatMap, deaths, reasons, sources);

  // 4. Process dreamcatcher effect (protection + link death)
  processDreamcatcherEffect(actions, roleSeatMap, deaths, reasons, sources);

  // 5. Process damage reflection (seer/witch attacking reflectsDamage target dies)
  processReflection(actions, roleSeatMap, deaths, reasons, sources);

  // 6. Process magician swap (swap death between two targets)
  processMagicianSwap(actions, deaths, reasons, sources);

  const sortedDeaths = Array.from(deaths).sort((a, b) => a - b);
  const deathReasons: Record<number, DeathReason> = {};
  const deathSources: Record<number, readonly DeathReason[]> = {};
  for (const seat of sortedDeaths) {
    const reason = reasons.get(seat);
    if (reason !== undefined) {
      deathReasons[seat] = reason;
    }
    deathSources[seat] = [...(sources.get(seat) ?? [])];
  }

  return { deaths: sortedDeaths, deathReasons, deathSources };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if a role seat is blocked by nightmare this night.
 * Centralizes the repeated nightmareBlock + present-check pattern.
 */
function isBlockedByNightmare(roleSeat: number, nightmareBlock: number | undefined): boolean {
  return nightmareBlock !== undefined && roleSeat !== -1 && nightmareBlock === roleSeat;
}

function recordDeath(
  seat: number,
  reason: DeathReason,
  deaths: Set<number>,
  reasons: Map<number, DeathReason>,
  sources: Map<number, Set<DeathReason>>,
): void {
  deaths.add(seat);
  reasons.set(seat, reason);
  const seatSources = sources.get(seat) ?? new Set<DeathReason>();
  seatSources.add(reason);
  sources.set(seat, seatSources);
}

function clearDeath(
  seat: number,
  deaths: Set<number>,
  reasons: Map<number, DeathReason>,
  sources: Map<number, Set<DeathReason>>,
): void {
  deaths.delete(seat);
  reasons.delete(seat);
  sources.delete(seat);
}

function transferDeath(
  fromSeat: number,
  toSeat: number,
  deaths: Set<number>,
  reasons: Map<number, DeathReason>,
  sources: Map<number, Set<DeathReason>>,
): void {
  const transferredSources = new Set(sources.get(fromSeat) ?? []);
  transferredSources.add('magicianSwap');
  clearDeath(fromSeat, deaths, reasons, sources);
  deaths.add(toSeat);
  reasons.set(toSeat, 'magicianSwap');
  sources.set(toSeat, transferredSources);
}

// =============================================================================
// Rule Processors
// =============================================================================

/**
 * Process wolf kill with guard/witch save interaction and nightmare block rules.
 *
 * Rules:
 * - Wolf kills target
 * - Guard protection OR witch save can prevent death
 * - BUT: if both guard and witch save the same target, the target still dies
 * - Nightmare block:
 *   - If guard is blocked, guard protection is nullified
 *   - If witch is blocked, witch save is nullified
 *   - If nightmare blocked a wolf on night 1 (isWolfBlockedByNightmare), wolf kill is nullified
 */
function processWolfKill(
  actions: NightActions,
  roleSeatMap: RoleSeatMap,
  deaths: Set<number>,
  reasons: Map<number, DeathReason>,
  sources: Map<number, Set<DeathReason>>,
): void {
  const {
    wolfKill,
    guardProtect,
    witchAction,
    nightmareBlock,
    isWolfBlockedByNightmare,
    seedWolfInfectedSeat,
  } = actions;
  const { guardProtectorSeat, poisonSourceSeat } = roleSeatMap;

  // Nightmare blocked a wolf on night 1: wolves cannot kill
  if (isWolfBlockedByNightmare) return;

  // No wolf kill or empty kill
  if (wolfKill === undefined) return;

  if (seedWolfInfectedSeat === wolfKill) return;

  // Silent wolf kill immunity (cursedFox): wolves CAN target, but kill is silently negated.
  // Unlike regular immunity (which prevents targeting), this lets the kill go through the
  // motion — wolves don't know they failed. Witch save on this target wastes the antidote.
  if (roleSeatMap.wolfKillSilentImmuneSeats.includes(wolfKill)) return;

  // Check if guard protection is effective (not blocked by nightmare)
  // NOTE: Both nightmareBlock and roleSeatMap seats are in the same coordinate
  // space (physical seats). buildRoleSeatMap maps effective-role → physical-seat,
  // and nightmareBlock is the physical seat from ProtocolAction.targetSeat.
  // This is a defense layer — upstream actionGuards already prevents blocked
  // players from submitting actions.
  const effectiveGuardProtect = isBlockedByNightmare(guardProtectorSeat, nightmareBlock)
    ? undefined
    : guardProtect;
  const isGuarded = effectiveGuardProtect === wolfKill;

  // Check if witch save is effective (not blocked by nightmare)
  const isWitchBlocked = isBlockedByNightmare(poisonSourceSeat, nightmareBlock);
  const witchSaveTarget = getWitchSaveTarget(witchAction);
  const effectiveWitchSave = isWitchBlocked ? undefined : witchSaveTarget;
  const isSaved = effectiveWitchSave === wolfKill;

  // If BOTH guard and witch (effectively) save, target still dies
  // Otherwise: either guard OR witch can save
  const diesFromWolf = (isSaved && isGuarded) || (!isSaved && !isGuarded);

  if (diesFromWolf) {
    recordDeath(wolfKill, 'wolfKill', deaths, reasons, sources);
  }
}

/**
 * Process check death (cursedFox: dies when checked by seer family).
 *
 * Rules:
 * - checkDeathTargetSeats contains seats that are BOTH vulnerable to check death AND were
 *   actually checked this night (intersection computed by deathResolution.ts).
 * - These seats die unconditionally (seer check result still shows '好人').
 */
function processCheckDeath(
  roleSeatMap: RoleSeatMap,
  deaths: Set<number>,
  reasons: Map<number, DeathReason>,
  sources: Map<number, Set<DeathReason>>,
): void {
  for (const seat of roleSeatMap.checkDeathTargetSeats) {
    recordDeath(seat, 'checkDeath', deaths, reasons, sources);
  }
}

/**
 * Process poison death (witch or poisoner) with poison immunity and nightmare block.
 *
 * Rules:
 * - Poison kills target
 * - Roles with immuneToPoison flag are immune to poison
 * - If poison source is blocked by nightmare, poison has no effect
 */
function processPoisonDeath(
  actions: NightActions,
  roleSeatMap: RoleSeatMap,
  deaths: Set<number>,
  reasons: Map<number, DeathReason>,
  sources: Map<number, Set<DeathReason>>,
): void {
  const { nightmareBlock } = actions;
  const { poisonSourceSeat, poisonImmuneSeats } = roleSeatMap;

  // If poison source is blocked by nightmare, poison has no effect
  if (isBlockedByNightmare(poisonSourceSeat, nightmareBlock)) return;

  const witchPoisonTarget = getWitchPoisonTarget(actions.witchAction);

  if (witchPoisonTarget === undefined) return;

  // Roles with immuneToPoison flag are immune
  if (poisonImmuneSeats.includes(witchPoisonTarget)) {
    return;
  }

  recordDeath(witchPoisonTarget, 'poison', deaths, reasons, sources);
}

/**
 * Process wolf queen link death.
 *
 * Rules:
 * - If wolf queen dies, her charmed target also dies
 */
function processWolfQueenLink(
  actions: NightActions,
  roleSeatMap: RoleSeatMap,
  deaths: Set<number>,
  reasons: Map<number, DeathReason>,
  sources: Map<number, Set<DeathReason>>,
): void {
  const { wolfQueenCharm } = actions;
  const { wolfQueenLinkSeat: queenSeat } = roleSeatMap;

  if (wolfQueenCharm === undefined) return;
  if (queenSeat === -1) return;

  // If queen is dead, charmed target also dies
  if (deaths.has(queenSeat)) {
    recordDeath(wolfQueenCharm, 'wolfQueenLink', deaths, reasons, sources);
  }
}

/**
 * Process bonded link death (shadow ↔ avenger).
 *
 * Rules:
 * - When bonded (shadow mimicked avenger), if either dies the other dies too
 * - Bidirectional: shadow death → avenger death, avenger death → shadow death
 * - Only active when bondedLinkSeats is non-null (bonded state confirmed)
 */
function processBondedLink(
  roleSeatMap: RoleSeatMap,
  deaths: Set<number>,
  reasons: Map<number, DeathReason>,
  sources: Map<number, Set<DeathReason>>,
): void {
  const { bondedLinkSeats } = roleSeatMap;

  if (!bondedLinkSeats) return;

  const [seatA, seatB] = bondedLinkSeats;
  const aDead = deaths.has(seatA);
  const bDead = deaths.has(seatB);

  // If either is dead, the other dies too
  if (aDead && !bDead) {
    recordDeath(seatB, 'bondedLink', deaths, reasons, sources);
  } else if (bDead && !aDead) {
    recordDeath(seatA, 'bondedLink', deaths, reasons, sources);
  }
}

/**
 * Process couple link death (cupid lovers — lover suicide).
 *
 * Rules:
 * - If either lover dies, the other dies too (lover suicide)
 * - Bidirectional: same logic as bonded link
 * - Only active when coupleLinkSeats is non-null (cupid chose lovers)
 */
function processCoupleLink(
  roleSeatMap: RoleSeatMap,
  deaths: Set<number>,
  reasons: Map<number, DeathReason>,
  sources: Map<number, Set<DeathReason>>,
): void {
  const { coupleLinkSeats } = roleSeatMap;
  if (!coupleLinkSeats) return;

  const [seatA, seatB] = coupleLinkSeats;
  const aDead = deaths.has(seatA);
  const bDead = deaths.has(seatB);

  if (aDead && !bDead) {
    recordDeath(seatB, 'coupleLink', deaths, reasons, sources);
  } else if (bDead && !aDead) {
    recordDeath(seatA, 'coupleLink', deaths, reasons, sources);
  }
}

/**
 * Process dreamcatcher effect.
 *
 * Rules:
 * - Dreamcatcher protects her dream target from death
 * - If dreamcatcher dies, her dream target also dies
 */
function processDreamcatcherEffect(
  actions: NightActions,
  roleSeatMap: RoleSeatMap,
  deaths: Set<number>,
  reasons: Map<number, DeathReason>,
  sources: Map<number, Set<DeathReason>>,
): void {
  const { dreamcatcherDream } = actions;
  const { dreamcatcherLinkSeat: dreamcatcherSeat } = roleSeatMap;

  if (dreamcatcherDream === undefined) return;

  // Dreamcatcher dream target is protected from night deaths
  clearDeath(dreamcatcherDream, deaths, reasons, sources);

  // If dreamcatcher dies, dream target also dies
  if (dreamcatcherSeat !== -1 && deaths.has(dreamcatcherSeat)) {
    recordDeath(dreamcatcherDream, 'dreamcatcherLink', deaths, reasons, sources);
  }
}

/**
 * Process damage reflection (driven by pre-built reflectionSources).
 *
 * Each ReflectionSource represents a check or poison action that may trigger reflection.
 * If the target seat has reflectsDamage, the source seat dies.
 * Nightmare-blocked sources are excluded at construction time (not checked here).
 */
function processReflection(
  _actions: NightActions,
  roleSeatMap: RoleSeatMap,
  deaths: Set<number>,
  reasons: Map<number, DeathReason>,
  sources: Map<number, Set<DeathReason>>,
): void {
  const { reflectsDamageSeats, reflectionSources } = roleSeatMap;

  if (reflectsDamageSeats.length === 0 || reflectionSources.length === 0) return;

  for (const { sourceSeat, targetSeat } of reflectionSources) {
    if (reflectsDamageSeats.includes(targetSeat)) {
      recordDeath(sourceSeat, 'reflection', deaths, reasons, sources);
    }
  }
}

/**
 * Process magician swap.
 *
 * Rules:
 * - Magician swaps death status between two targets
 * - If exactly one of the two is dead, swap their death status
 */
function processMagicianSwap(
  actions: NightActions,
  deaths: Set<number>,
  reasons: Map<number, DeathReason>,
  sources: Map<number, Set<DeathReason>>,
): void {
  const { magicianSwap } = actions;

  if (magicianSwap === undefined) return;

  const { first, second } = magicianSwap;
  const firstDead = deaths.has(first);
  const secondDead = deaths.has(second);

  // Swap only if exactly one is dead
  if (firstDead && !secondDead) {
    transferDeath(first, second, deaths, reasons, sources);
  } else if (!firstDead && secondDead) {
    transferDeath(second, first, deaths, reasons, sources);
  }
  // If both dead or both alive, no change
}
