/**
 * Seat animation tier durations — single source of truth.
 *
 * All animation templates derive their phase timings proportionally from these constants.
 * Common=2s, Rare=2.5s, Epic=3s, Legendary=4s.
 */

/** Common-tier total duration (ms) — simple single-phase entrance */
export const COMMON_DURATION = 2000;

/** Rare-tier total duration (ms) — SVG particle entrance */
export const RARE_DURATION = 2500;

/** Epic-tier total duration (ms) — multi-phase archetype entrance */
export const EPIC_DURATION = 3000;

/** Legendary-tier total duration (ms) — hand-crafted multi-phase choreography */
export const LEGENDARY_DURATION = 4000;
