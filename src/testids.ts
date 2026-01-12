/**
 * testids.ts - Centralized testID registry
 *
 * All testIDs used in the app should be defined here.
 * Components and tests import from this single source of truth.
 *
 * Rules:
 * - Only extract EXISTING testIDs from code/tests
 * - New testIDs must have corresponding test coverage
 * - Maintain backward compatibility (don't rename without migration)
 */

export const TESTIDS = {
  // RoomScreen - Seat Grid
  // Used by: RoomScreen.tsx, e2e/night1.basic.spec.ts
  seatTile: (index: number) => `seat-tile-${index}`,
} as const;
