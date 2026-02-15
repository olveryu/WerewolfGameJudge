/**
 * testids.ts - Centralized testID registry
 *
 * All testIDs used in the app should be defined here.
 * Components and tests import from this single source of truth.
 *
 * Rules:
 * - Only extract EXISTING testIDs from code/tests
 * - New testIDs must have corresponding test coverage
 * - Do not rename testIDs without updating all E2E/unit tests
 */

export const TESTIDS = {
  // RoomScreen - Seat Grid
  // Used by: RoomScreen.tsx, e2e/night1.basic.spec.ts
  seatTile: (seat: number) => `seat-tile-${seat}`,

  // RoomScreen - Seat Grid (pressable target)
  // Purpose: avoid duplicate testID collisions when the wrapper View also has seatTile.
  seatTilePressable: (seat: number) => `seat-tile-pressable-${seat}`,

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
  configBackButton: 'config-back-button',
  configPresetSection: 'config-preset-section',
  configGearButton: 'config-gear-btn',
  configSettingsOverlay: 'config-settings-overlay',
  configAnimation: 'config-animation',
  configBgm: 'config-bgm',
  configRoleChip: (id: string) => `config-role-chip-${id}`,
  configStepperDec: (roleId: string) => `config-stepper-dec-${roleId}`,
  configStepperInc: (roleId: string) => `config-stepper-inc-${roleId}`,
  configStepperCount: (roleId: string) => `config-stepper-count-${roleId}`,
  configFactionTab: (key: string) => `config-faction-tab-${key}`,

  roomScreenRoot: 'room-screen-root',
  roomBackButton: 'room-back-button',
  roomHeader: 'room-header',
  roomSettingsButton: 'room-settings-button',
  connectionStatusContainer: 'connection-status-container',
  forceSyncButton: 'force-sync-button',

  // ActionMessage / BottomActionPanel
  actionMessage: 'action-message',
  bottomActionPanel: 'bottom-action-panel',

  // SeatConfirmModal
  seatConfirmModal: 'seat-confirm-modal',
  seatConfirmTitle: 'seat-confirm-title',
  seatConfirmMessage: 'seat-confirm-message',
  seatConfirmOk: 'seat-confirm-ok',
  seatConfirmCancel: 'seat-confirm-cancel',

  // ContinueGameOverlay
  continueGameButton: 'continue-game-button',

  // NightProgressIndicator
  nightProgressIndicator: 'night-progress-indicator',

  // AlertModal
  alertModalOverlay: 'alert-modal-overlay',
  alertModal: 'alert-modal',
  alertTitle: 'alert-title',
  alertMessage: 'alert-message',
  alertButton: (index: number) => `alert-button-${index}`,

  // Button
  buttonLoadingIndicator: 'button-loading-indicator',

  // NumPad
  numpadKey: (key: string) => `numpad-${key}`,

  // RoleRevealEffects
  // Used by: RoleRevealEffects components, unit tests
  roleRevealModal: 'role-reveal-modal',
  roleRevealContainer: (effect: string) => `${effect}-container`,
  roleRevealCard: (effect: string) => `${effect}-card`,
  roleRevealCardBack: (effect: string) => `${effect}-card-back`,
  roleRevealCardFront: (effect: string) => `${effect}-card-front`,
  roleRevealWindow: (effect: string) => `${effect}-window`,
  roleRevealAutoReveal: (effect: string) => `${effect}-auto-reveal`,
  roleRevealTapReveal: (effect: string) => `${effect}-tap-reveal`,
} as const;
