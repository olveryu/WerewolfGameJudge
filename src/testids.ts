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

  // RoomScreen - Seat Grid (pressable target)
  // Purpose: avoid duplicate testID collisions when the wrapper View also has seatTile.
  seatTilePressable: (index: number) => `seat-tile-pressable-${index}`,

  // Home / Config / Room readiness gates (stable, non-copy based)
  homeScreenRoot: 'home-screen-root',
  homeEnterRoomButton: 'home-enter-room-button',
  homeCreateRoomButton: 'home-create-room-button',
  homeReturnLastGameButton: 'home-return-last-game-button',
  
  // User bar / login (HomeScreen)
  homeUserBar: 'home-user-bar',
  homeUserName: 'home-user-name',
  homeLoginButton: 'home-login-button', // "点击登录" area
  homeAnonLoginButton: 'home-anon-login-button', // "👤 匿名登录" button in modal

  configScreenRoot: 'config-screen-root',
  configPresetSection: 'config-preset-section',

  roomScreenRoot: 'room-screen-root',
  roomHeader: 'room-header',
  connectionStatusContainer: 'connection-status-container',
  forceSyncButton: 'force-sync-button',
} as const;
