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
  mySeatBadge: 'my-seat-badge',

  // Home / Config / Room readiness gates (stable, non-copy based)
  homeScreenRoot: 'home-screen-root',
  homeEnterRoomButton: 'home-enter-room-button',
  homeCreateRoomButton: 'home-create-room-button',
  homeReturnLastGameButton: 'home-return-last-game-button',
  gameModePickerModal: 'game-mode-picker-modal',
  gameModePickerOption: (gameType: string) => `game-mode-picker-option-${gameType}`,

  // User bar / login (HomeScreen)
  homeUserName: 'home-user-name',
  homeAnonLoginButton: 'home-anon-login-button', // "👤 匿名登录" button in modal
  homeSettingsButton: 'home-settings-button', // Top bar settings icon

  configScreenRoot: 'config-screen-root',
  configBackButton: 'config-back-button',
  configTemplatePill: 'config-template-pill',

  boardPickerScreenRoot: 'board-picker-screen-root',

  configPresetSection: 'config-preset-section',
  configOverflowReset: 'config-overflow-reset',
  configRoleChip: (id: string) => `config-role-chip-${id}`,
  configVariantOption: (id: string) => `config-variant-option-${id}`,
  configStepperDec: (roleId: string) => `config-stepper-dec-${roleId}`,
  configStepperInc: (roleId: string) => `config-stepper-inc-${roleId}`,
  configStepperCount: (roleId: string) => `config-stepper-count-${roleId}`,
  configFactionTab: (key: string) => `config-faction-tab-${key}`,
  fibPlayerCountInput: 'fib-player-count-input',
  fibConfigSubmitButton: 'fib-config-submit-button',
  fibRulesScreenRoot: 'fib-rules-screen-root',

  roomScreenRoot: 'room-screen-root',
  roomBackButton: 'room-back-button',
  roomHeader: 'room-header',
  roomSeatContentWidthProbe: 'room-seat-content-width-probe',
  roomSeatPagination: 'room-seat-pagination',
  roomSeatPreviousPage: 'room-seat-previous-page',
  roomSeatNextPage: 'room-seat-next-page',
  roomSeatPageInput: 'room-seat-page-input',
  roomEncyclopediaButton: 'room-encyclopedia-button',
  roomMenuButton: 'room-menu-button',
  roomUserSettingsButton: 'room-user-settings-button',
  roomSettingsButton: 'room-settings-button',
  roomSettingsOverlay: 'room-settings-overlay',
  prepareToFlipButton: 'prepare-to-flip-button',
  startGameButton: 'start-game-button',
  restartButton: 'restart-button',
  audioWaitingButton: 'audio-waiting-button',
  lastNightInfoButton: 'last-night-info-button',
  bgmToggleButton: 'bgm-toggle-button',
  connectionStatusContainer: 'connection-status-container',

  // ActionMessage / BottomActionPanel
  actionMessage: 'action-message',
  bottomActionPanel: 'bottom-action-panel',

  // SeatConfirmModal
  seatConfirmModal: 'seat-confirm-modal',
  seatConfirmTitle: 'seat-confirm-title',
  seatConfirmMessage: 'seat-confirm-message',
  seatConfirmOk: 'seat-confirm-ok',
  seatConfirmCancel: 'seat-confirm-cancel',

  // RoomProgressIndicator
  roomProgressIndicator: 'room-progress-indicator',
  controlledSeatBanner: 'controlled-seat-banner',
  controlledSeatReleaseButton: 'controlled-seat-release-button',
  fibIdentityModal: 'fib-identity-modal',
  fibIdentityRole: 'fib-identity-role',
  fibIdentityWord: 'fib-identity-word',
  fibIdentityDefinition: 'fib-identity-definition',
  fibRulesButton: 'fib-rules-button',
  fibStartRoundButton: 'fib-start-round-button',
  fibCancelPreparingButton: 'fib-cancel-preparing-button',
  fibRevealRoundButton: 'fib-reveal-round-button',
  fibViewIdentityButton: 'fib-view-identity-button',
  fibNextRoundButton: 'fib-next-round-button',
  fibViewResultButton: 'fib-view-result-button',
  fibConfigureButton: 'fib-configure-button',

  // AlertModal
  alertModalOverlay: 'alert-modal-overlay',
  alertModal: 'alert-modal',
  alertTitle: 'alert-title',
  alertMessage: 'alert-message',
  alertInput: 'alert-input',
  alertButton: (index: number) => `alert-button-${index}`,

  // Button
  buttonLoadingIndicator: 'button-loading-indicator',

  // NumPad
  numpadKey: (key: string) => `numpad-${key}`,

  // NightReviewModal
  nightReviewButton: 'night-review-button',
  nightReviewModal: 'night-review-modal',
  nightReviewShareButton: 'night-review-share-button',

  // ShareReviewModal
  shareReviewButton: 'share-review-button',
  shareReviewModal: 'share-review-modal',

  // QRCodeModal
  qrCodeModal: 'qr-code-modal',
  qrCodeShareButton: 'qr-code-share-button',

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

  // EncyclopediaScreen
  homeGuideButton: 'home-guide-button',

  // Feedback (AnnouncementModal)
  feedbackInput: 'feedback-input',
  feedbackSubmitButton: 'feedback-submit-button',
  feedbackHistoryList: 'feedback-history-list',
  feedbackHistoryItem: (id: string) => `feedback-history-item-${id}`,
  feedbackNewButton: 'feedback-new-button',
  feedbackBackButton: 'feedback-back-button',
  feedbackReplyInput: 'feedback-reply-input',
  feedbackReplySendButton: 'feedback-reply-send-button',
  feedbackResolveButton: 'feedback-resolve-button',
  feedbackFilterToggle: 'feedback-filter-toggle',

  // RecentRoomsModal
  recentRoomsModal: 'recent-rooms-modal',
  recentRoomJoin: (roomCode: string) => `recent-room-join-${roomCode}`,

  encyclopediaScreenRoot: 'encyclopedia-screen-root',
  encyclopediaRoleItem: (id: string) => `encyclopedia-role-${id}`,
  encyclopediaFactionTab: (key: string) => `encyclopedia-faction-tab-${key}`,
  encyclopediaTagFilter: (tag: string) => `encyclopedia-tag-${tag}`,
} as const;
