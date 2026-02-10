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
 * - Calling Supabase / Broadcast
 * - Playing audio
 * - Modifying any UI
 */

import {
  getWitchPoisonTarget,
  getWitchSaveTarget,
  WitchAction,
} from '@/models/actions/WitchAction';

// =============================================================================
// Types
// =============================================================================

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

  /** Seer check target seat. undefined = not used */
  seerCheck?: number;

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
}

/**
 * Role seat mapping for context-dependent death rules
 * All seat numbers are 0-based indices. -1 means role not present.
 */
export interface RoleSeatMap {
  /** Witcher seat (immune to poison). -1 if not present */
  witcher: number;

  /** Wolf Queen seat (for link death check). -1 if not present */
  wolfQueen: number;

  /** Dreamcatcher seat (for link death check). -1 if not present */
  dreamcatcher: number;

  /** Spirit Knight seat (reflects damage to seer/witch). -1 if not present */
  spiritKnight: number;

  /** Seer seat (for spirit knight reflection). -1 if not present */
  seer: number;

  /** Witch seat (for spirit knight reflection). -1 if not present */
  witch: number;

  /** Guard seat (for nightmare block check). -1 if not present */
  guard: number;
}

/**
 * Default role seat map (all roles not present)
 */
const DEFAULT_ROLE_SEAT_MAP: RoleSeatMap = {
  witcher: -1,
  wolfQueen: -1,
  dreamcatcher: -1,
  spiritKnight: -1,
  seer: -1,
  witch: -1,
  guard: -1,
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
  const deaths = new Set<number>();

  // Order matters: some effects depend on prior death state

  // 1. Process wolf kill (with guard/witch/nightmare interaction)
  processWolfKill(actions, roleSeatMap, deaths);

  // 2. Process witch poison (with witcher immunity and nightmare block)
  processWitchPoison(actions, roleSeatMap, deaths);

  // 3. Process wolf queen link death
  processWolfQueenLink(actions, roleSeatMap, deaths);

  // 4. Process dreamcatcher effect (protection + link death)
  processDreamcatcherEffect(actions, roleSeatMap, deaths);

  // 5. Process spirit knight reflection (seer/witch attacking spirit knight dies)
  processSpiritKnightReflection(actions, roleSeatMap, deaths);

  // 6. Process magician swap (swap death between two targets)
  processMagicianSwap(actions, deaths);

  return Array.from(deaths).sort((a, b) => a - b);
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
 * - BUT: 同守同救必死 (if both guard and witch save the same target, target dies)
 * - Nightmare block:
 *   - If guard is blocked, guard protection is nullified
 *   - If witch is blocked, witch save is nullified
 *   - If nightmare blocked a wolf on night 1 (isWolfBlockedByNightmare), wolf kill is nullified
 */
function processWolfKill(
  actions: NightActions,
  roleSeatMap: RoleSeatMap,
  deaths: Set<number>,
): void {
  const { wolfKill, guardProtect, witchAction, nightmareBlock, isWolfBlockedByNightmare } = actions;
  const { guard: guardSeat, witch: witchSeat } = roleSeatMap;

  // Nightmare blocked a wolf on night 1: wolves cannot kill
  if (isWolfBlockedByNightmare) return;

  // No wolf kill or empty kill
  if (wolfKill === undefined) return;

  // Check if guard protection is effective (not blocked by nightmare)
  const isGuardBlocked =
    nightmareBlock !== undefined && guardSeat !== -1 && nightmareBlock === guardSeat;
  const effectiveGuardProtect = isGuardBlocked ? undefined : guardProtect;
  const isGuarded = effectiveGuardProtect === wolfKill;

  // Check if witch save is effective (not blocked by nightmare)
  const isWitchBlocked =
    nightmareBlock !== undefined && witchSeat !== -1 && nightmareBlock === witchSeat;
  const witchSaveTarget = getWitchSaveTarget(witchAction);
  const effectiveWitchSave = isWitchBlocked ? undefined : witchSaveTarget;
  const isSaved = effectiveWitchSave === wolfKill;

  // 同守同救必死: if BOTH guard and witch (effectively) save, target still dies
  // Otherwise: either guard OR witch can save
  const diesFromWolf = (isSaved && isGuarded) || (!isSaved && !isGuarded);

  if (diesFromWolf) {
    deaths.add(wolfKill);
  }
}

/**
 * Process witch poison with witcher immunity and nightmare block.
 *
 * Rules:
 * - Witch poison kills target
 * - Witcher is immune to poison
 * - If witch is blocked by nightmare, poison has no effect
 */
function processWitchPoison(
  actions: NightActions,
  roleSeatMap: RoleSeatMap,
  deaths: Set<number>,
): void {
  const { nightmareBlock } = actions;
  const { witcher: witcherSeat, witch: witchSeat } = roleSeatMap;

  // If witch is blocked by nightmare, poison has no effect
  const isWitchBlocked =
    nightmareBlock !== undefined && witchSeat !== -1 && nightmareBlock === witchSeat;
  if (isWitchBlocked) return;

  const witchPoisonTarget = getWitchPoisonTarget(actions.witchAction);

  if (witchPoisonTarget === undefined) return;

  // Witcher is immune to poison
  if (witcherSeat !== -1 && witchPoisonTarget === witcherSeat) {
    return;
  }

  deaths.add(witchPoisonTarget);
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
): void {
  const { wolfQueenCharm } = actions;
  const { wolfQueen: queenSeat } = roleSeatMap;

  if (wolfQueenCharm === undefined) return;
  if (queenSeat === -1) return;

  // If queen is dead, charmed target also dies
  if (deaths.has(queenSeat)) {
    deaths.add(wolfQueenCharm);
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
): void {
  const { dreamcatcherDream } = actions;
  const { dreamcatcher: dreamcatcherSeat } = roleSeatMap;

  if (dreamcatcherDream === undefined) return;

  // Dreamcatcher dream target is protected from night deaths
  deaths.delete(dreamcatcherDream);

  // If dreamcatcher dies, dream target also dies
  if (dreamcatcherSeat !== -1 && deaths.has(dreamcatcherSeat)) {
    deaths.add(dreamcatcherDream);
  }
}

/**
 * Process spirit knight reflection.
 *
 * Rules:
 * - Spirit Knight is immune to wolf attack (wolf kill has no effect)
 * - If seer checks spirit knight, seer dies (reflection)
 * - If witch poisons spirit knight, witch dies and spirit knight survives (immune to poison + reflection)
 */
function processSpiritKnightReflection(
  actions: NightActions,
  roleSeatMap: RoleSeatMap,
  deaths: Set<number>,
): void {
  const { wolfKill, seerCheck, witchAction } = actions;
  const witchPoisonTarget = getWitchPoisonTarget(witchAction);
  const { spiritKnight: spiritKnightSeat, seer: seerSeat, witch: witchSeat } = roleSeatMap;

  // Spirit knight not present
  if (spiritKnightSeat === -1) return;

  // Wolf attacks spirit knight → spirit knight is immune (remove from deaths)
  if (wolfKill === spiritKnightSeat) {
    deaths.delete(spiritKnightSeat);
  }

  // Seer checks spirit knight → seer dies by reflection
  if (seerCheck === spiritKnightSeat && seerSeat !== -1) {
    deaths.add(seerSeat);
  }

  // Witch poisons spirit knight → witch dies, spirit knight is immune
  if (witchPoisonTarget === spiritKnightSeat) {
    // Remove spirit knight from deaths (immune to poison)
    deaths.delete(spiritKnightSeat);
    // Witch dies by reflection
    if (witchSeat !== -1) {
      deaths.add(witchSeat);
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
function processMagicianSwap(actions: NightActions, deaths: Set<number>): void {
  const { magicianSwap } = actions;

  if (magicianSwap === undefined) return;

  const { first, second } = magicianSwap;
  const firstDead = deaths.has(first);
  const secondDead = deaths.has(second);

  // Swap only if exactly one is dead
  if (firstDead && !secondDead) {
    deaths.delete(first);
    deaths.add(second);
  } else if (!firstDead && secondDead) {
    deaths.delete(second);
    deaths.add(first);
  }
  // If both dead or both alive, no change
}
