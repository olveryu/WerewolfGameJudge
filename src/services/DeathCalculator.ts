/**
 * DeathCalculator - Pure function module for calculating night deaths
 *
 * This module contains all death calculation logic extracted from GameStateService.
 * It is a pure function with no side effects, no state access, and no external dependencies.
 *
 * Responsibilities:
 * - Receive night action data (semantically clear, structured types)
 * - Apply game rules to determine who dies
 * - Return list of dead seats
 *
 * NOT responsible for:
 * - Accessing GameStateService internal state
 * - Calling Supabase / Broadcast
 * - Playing audio
 * - Modifying any UI
 */

import { WitchAction, getWitchSaveTarget, getWitchPoisonTarget } from '../models/actions/WitchAction';

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

  /** Celebrity dream target seat. undefined = not used */
  celebrityDream?: number;

  /** Magician swap targets. undefined = not used */
  magicianSwap?: { first: number; second: number };

  /** Seer check target seat. undefined = not used */
  seerCheck?: number;
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

  /** Celebrity seat (for link death check). -1 if not present */
  celebrity: number;

  /** Spirit Knight seat (reflects damage to seer/witch). -1 if not present */
  spiritKnight: number;

  /** Seer seat (for spirit knight reflection). -1 if not present */
  seer: number;

  /** Witch seat (for spirit knight reflection). -1 if not present */
  witch: number;
}

/**
 * Default role seat map (all roles not present)
 */
export const DEFAULT_ROLE_SEAT_MAP: RoleSeatMap = {
  witcher: -1,
  wolfQueen: -1,
  celebrity: -1,
  spiritKnight: -1,
  seer: -1,
  witch: -1,
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
  roleSeatMap: RoleSeatMap = DEFAULT_ROLE_SEAT_MAP
): number[] {
  const deaths = new Set<number>();

  // Order matters: some effects depend on prior death state

  // 1. Process wolf kill (with guard/witch interaction)
  processWolfKill(actions, deaths);

  // 2. Process witch poison (with witcher immunity)
  processWitchPoison(actions, roleSeatMap, deaths);

  // 3. Process wolf queen link death
  processWolfQueenLink(actions, roleSeatMap, deaths);

  // 4. Process celebrity effect (protection + link death)
  processCelebrityEffect(actions, roleSeatMap, deaths);

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
 * Process wolf kill with guard/witch save interaction.
 *
 * Rules:
 * - Wolf kills target
 * - Guard protection OR witch save can prevent death
 * - BUT: 同守同救必死 (if both guard and witch save the same target, target dies)
 */
function processWolfKill(actions: NightActions, deaths: Set<number>): void {
  const { wolfKill, guardProtect, witchAction } = actions;

  // No wolf kill or empty kill
  if (wolfKill === undefined) return;

  const witchSaveTarget = getWitchSaveTarget(witchAction);
  const isSaved = witchSaveTarget === wolfKill;
  const isGuarded = guardProtect === wolfKill;

  // 同守同救必死: if BOTH guard and witch save, target still dies
  // Otherwise: either guard OR witch can save
  const diesFromWolf = (isSaved && isGuarded) || (!isSaved && !isGuarded);

  if (diesFromWolf) {
    deaths.add(wolfKill);
  }
}

/**
 * Process witch poison with witcher immunity.
 *
 * Rules:
 * - Witch poison kills target
 * - Witcher is immune to poison
 */
function processWitchPoison(
  actions: NightActions,
  roleSeatMap: RoleSeatMap,
  deaths: Set<number>
): void {
  const witchPoisonTarget = getWitchPoisonTarget(actions.witchAction);
  const { witcher: witcherSeat } = roleSeatMap;

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
  deaths: Set<number>
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
 * Process celebrity effect.
 *
 * Rules:
 * - Celebrity protects her dream target from death
 * - If celebrity dies, her dream target also dies
 */
function processCelebrityEffect(
  actions: NightActions,
  roleSeatMap: RoleSeatMap,
  deaths: Set<number>
): void {
  const { celebrityDream } = actions;
  const { celebrity: celebritySeat } = roleSeatMap;

  if (celebrityDream === undefined) return;

  // Celebrity protects dream target
  deaths.delete(celebrityDream);

  // If celebrity dies, dream target also dies
  if (celebritySeat !== -1 && deaths.has(celebritySeat)) {
    deaths.add(celebrityDream);
  }
}

/**
 * Process spirit knight reflection.
 *
 * Rules:
 * - Spirit Knight is a wolf that reflects damage to attackers
 * - If seer checks spirit knight, seer dies (reflection)
 * - If witch poisons spirit knight, witch dies and spirit knight survives (immune to poison + reflection)
 */
function processSpiritKnightReflection(
  actions: NightActions,
  roleSeatMap: RoleSeatMap,
  deaths: Set<number>
): void {
  const { seerCheck, witchAction } = actions;
  const witchPoisonTarget = getWitchPoisonTarget(witchAction);
  const { spiritKnight: spiritKnightSeat, seer: seerSeat, witch: witchSeat } = roleSeatMap;

  // Spirit knight not present
  if (spiritKnightSeat === -1) return;

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
