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
  seatStatusBadge: (seat: number) => `seat-status-badge-${seat}`,
  seatMarker: (seat: number, key: string) => `seat-marker-${seat}-${key}`,
  seatProgress: (seat: number) => `seat-progress-${seat}`,
  seatNumberBadge: (seat: number) => `seat-number-badge-${seat}`,
  seatNameRow: (seat: number) => `seat-name-row-${seat}`,
  seatSecondaryLabel: (seat: number) => `seat-secondary-label-${seat}`,
  mySeatBadge: 'my-seat-badge',

  // Home / Config / Room readiness gates (stable, non-copy based)
  homeScreenRoot: 'home-screen-root',
  homeEnterRoomButton: 'home-enter-room-button',
  homeCreateRoomButton: 'home-create-room-button',
  homeReturnLastGameButton: 'home-return-last-game-button',
  homeAnnouncementCloseButton: 'home-announcement-close-button',
  joinRoomDialog: 'join-room-dialog',
  joinRoomCancelButton: 'join-room-cancel-button',
  joinRoomSubmitButton: 'join-room-submit-button',
  joinRoomError: 'join-room-error',
  gameModePickerModal: 'game-mode-picker-modal',
  gameModePickerOption: (gameType: string) => `game-mode-picker-option-${gameType}`,
  // Used by: GamePickerScreen.tsx — 小游戏 section label in the tiered picker
  gameModePickerMiniSection: 'game-mode-picker-mini-section',

  // User bar / login (HomeScreen)
  homeUserName: 'home-user-name',
  loginDialog: 'login-dialog',
  homeAnonLoginButton: 'home-anon-login-button', // "👤 匿名登录" button in modal
  homeSettingsButton: 'home-settings-button', // Top bar settings icon
  screenHeaderTitle: 'screen-header-title',

  // SettingsScreen - Display section
  settingsSeatDecorationsSwitch: 'settings-seat-decorations-switch',

  // Appearance / Unlocks
  appearanceScreen: 'appearance-screen',
  appearanceAvatarInput: 'appearance-avatar-input',
  unlocksScreen: 'unlocks-screen',

  configScreenRoot: 'config-screen-root',
  configBackButton: 'config-back-button',
  configTemplatePill: 'config-template-pill',
  configNextButton: 'config-next-button',

  boardPickerScreenRoot: 'board-picker-screen-root',
  boardPickerCategoryTab: (category: string) => `board-picker-category-tab-${category}`,
  boardCardHeader: (templateName: string) => `board-card-header-${templateName}`,
  boardCardSelectButton: (templateName: string) => `board-card-select-button-${templateName}`,

  configPresetSection: 'config-preset-section',
  configOverflowReset: 'config-overflow-reset',
  configRoleChip: (id: string) => `config-role-chip-${id}`,
  configVariantOption: (id: string) => `config-variant-option-${id}`,
  configStepperDec: (roleId: string) => `config-stepper-dec-${roleId}`,
  configStepperInc: (roleId: string) => `config-stepper-inc-${roleId}`,
  configStepperCount: (roleId: string) => `config-stepper-count-${roleId}`,
  configFactionTab: (key: string) => `config-faction-tab-${key}`,
  gameRulesScreenRoot: 'game-rules-screen-root',
  /** Werewolf rules render through the shared config form; alias kept for existing callers. */
  gameRuleSwitch: (rule: string) => `werewolf-config-field-${rule}`,
  gameRulesSubmitButton: 'game-rules-submit-button',
  // Schema-driven config form (src/features/room/config); shared by every non-Werewolf game.
  gameConfigScreenRoot: (gameType: string) => `${gameType}-config`,
  gameConfigField: (gameType: string, key: string) => `${gameType}-config-field-${key}`,
  gameConfigFieldOption: (gameType: string, key: string, value: string) =>
    `${gameType}-config-field-${key}-${value}`,
  gameConfigFieldDecrement: (gameType: string, key: string) =>
    `${gameType}-config-field-${key}-decrement`,
  gameConfigFieldIncrement: (gameType: string, key: string) =>
    `${gameType}-config-field-${key}-increment`,
  gameConfigFieldIssue: (gameType: string, key: string) => `${gameType}-config-issue-${key}`,
  gameConfigReset: (gameType: string) => `${gameType}-config-reset`,
  gameConfigSubmit: (gameType: string) => `${gameType}-config-submit`,
  fibRulesScreenRoot: 'fib-rules-screen-root',
  // Shared game guide (GameGuide) and the room's guide entry
  gameGuideScreenRoot: (gameType: string) => `${gameType}-guide-screen-root`,
  gameGuideBackButton: 'game-guide-back-button',
  roomGuideButton: (gameType: string) => `${gameType}-room-guide-button`,

  roomScreenRoot: 'room-screen-root',
  roomBackButton: 'room-back-button',
  roomHeader: 'room-header',
  roomSeatContentWidthProbe: 'room-seat-content-width-probe',
  roomSeatPagination: 'room-seat-pagination',
  roomSeatPreviousPage: 'room-seat-previous-page',
  roomSeatNextPage: 'room-seat-next-page',
  roomSeatPageInput: 'room-seat-page-input',
  roomEncyclopediaButton: 'room-encyclopedia-button',
  roomShareButton: 'room-share-button',
  roomUserSettingsButton: 'room-user-settings-button',
  roomHostManagementButton: 'room-host-management-button',
  roomHostTaskCard: 'room-host-task-card',
  roomHostTaskEscapeButton: 'room-host-task-card-escape',
  roomHostManagementPanel: 'room-host-management-panel',
  roomHostManagementCloseButton: 'room-host-management-close-button',
  roomViewIdentityButton: 'room-view-identity-button',
  roomDialogCloseButton: 'room-dialog-close-button',
  playerProfileCard: 'player-profile-card',
  playerProfileLeaveSeatButton: 'player-profile-leave-seat-button',
  playerProfileKickButton: 'player-profile-kick-button',
  roleCardModal: 'role-card-modal',
  roleCardName: 'role-card-name',
  roleCardConfirmButton: 'role-card-confirm-button',
  roleBadge: 'role-badge',
  roomNextStepButton: 'room-next-step-button',
  roomNextStepRemedyButton: 'room-next-step-remedy-button',
  roomNextStepBlockedReason: 'room-next-step-blocked-reason',
  roomShareHostActionButton: 'room-share-host-action-button',
  roomSettingsButton: 'room-settings-button',
  roomFillBotsButton: 'room-fill-bots-button',
  roomClearSeatsButton: 'room-clear-seats-button',
  roomMusicSettingsButton: 'room-music-settings-button',
  roomMarkBotsViewedButton: 'room-mark-bots-viewed-button',
  roomMarkBotsConfirmedButton: 'room-mark-bots-confirmed-button',
  roomSettingsOverlay: 'room-settings-overlay',
  assignRolesButton: 'assign-roles-button',
  abortGameButton: 'abort-game-button',
  startGameButton: 'start-game-button',
  nextRoundButton: 'next-round-button',
  returnLobbyButton: 'return-lobby-button',
  restartButton: 'restart-button',
  lastNightInfoButton: 'last-night-info-button',
  lastNightInfoBottomButton: 'last-night-info-bottom-button',
  nextRoundBottomButton: 'next-round-bottom-button',
  returnLobbyBottomButton: 'return-lobby-bottom-button',
  chooseBottomCardModal: 'choose-bottom-card-modal',
  chooseBottomCardOption: (cardIndex: number) => `choose-bottom-card-option-${cardIndex}`,
  bgmToggleButton: 'bgm-toggle-button',
  connectionStatusContainer: 'connection-status-container',
  connectionPendingContainer: 'connection-pending-container',
  connectionRetryNowButton: 'connection-retry-now-button',

  // Stage settle rescue (D3 follow-up: host self-rescue for an overdue deadline)
  stageSettleRescue: 'stage-settle-rescue',
  stageSettleRescueRetryButton: 'stage-settle-rescue-retry-button',

  // Werewolf MVP selection (host, ended)
  mvpSelectionModal: 'mvp-selection-modal',

  // Werewolf night step buttons, keyed by the button spec key (skip, wolfEmpty, confirm, ...)
  werewolfNightButton: (key: string) => `werewolf-night-button-${key}`,

  // Avalon night step button
  avalonNightInfo: 'avalon-night-info',

  // Avalon bottom actions
  avalonEarlyStrike: 'avalon-early-strike',
  avalonLadyResultOpen: 'avalon-lady-result-open',
  avalonNominatePreselect: 'avalon-nominate-preselect',
  avalonNominateSubmit: 'avalon-nominate-submit',
  avalonVoteOpen: 'avalon-vote-open',
  avalonQuestOpen: 'avalon-quest-open',
  avalonLadyAcknowledgeOpen: 'avalon-lady-acknowledge-open',

  // Avalon vote / quest modals
  avalonVoteModal: 'avalon-vote-modal',
  avalonVoteTeam: (seat: number) => `avalon-vote-team-${seat}`,
  avalonVoteCountdown: 'avalon-vote-countdown',
  avalonVotePendingSeats: 'avalon-vote-pending-seats',
  avalonVoteApprove: 'avalon-vote-approve',
  avalonVoteReject: 'avalon-vote-reject',
  avalonVoteClose: 'avalon-vote-close',
  avalonQuestModal: 'avalon-quest-modal',
  avalonQuestCountdown: 'avalon-quest-countdown',
  avalonQuestPendingSeats: 'avalon-quest-pending-seats',
  avalonQuestSuccess: 'avalon-quest-success',
  avalonQuestFail: 'avalon-quest-fail',
  avalonQuestClose: 'avalon-quest-close',

  // Avalon settlement panels (kind: vote | quest)
  avalonResultPanel: (kind: 'vote' | 'quest') => `avalon-${kind}-result-panel`,
  avalonResultBanner: (kind: 'vote' | 'quest') => `avalon-${kind}-result-banner`,
  avalonResultClose: (kind: 'vote' | 'quest') => `avalon-${kind}-result-close`,
  avalonVoteResultCounts: 'avalon-vote-result-counts',
  avalonVoteResultSummary: 'avalon-vote-result-summary',
  avalonVoteResultRow: (seat: number) => `avalon-vote-result-row-${seat}`,
  avalonQuestResultCounts: 'avalon-quest-result-counts',

  // Avalon team pick
  avalonTeamPickModal: 'avalon-team-pick-modal',
  avalonTeamPickCount: 'avalon-team-pick-count',
  avalonTeamPickRow: (seat: number) => `avalon-team-pick-row-${seat}`,
  avalonTeamPickCancel: 'avalon-team-pick-cancel',
  avalonTeamPickConfirm: 'avalon-team-pick-confirm',

  // Avalon history
  avalonHistorySummary: 'avalon-history-summary',
  avalonHistorySummaryPendingSeats: 'avalon-history-summary-pending-seats',
  avalonHistoryOverlay: 'avalon-history-overlay',
  avalonHistoryTab: (round: number) => `avalon-history-tab-${round}`,
  avalonHistoryClose: 'avalon-history-close',
  avalonHistoryRound: (round: number) => `avalon-history-round-${round}`,
  avalonHistoryRoundBanner: (round: number) => `avalon-history-banner-${round}`,

  // Avalon Lady of the Lake
  avalonLadyAcknowledgeModal: 'avalon-lady-acknowledge-modal',
  avalonLadyAcknowledge: 'avalon-lady-acknowledge',
  avalonLadyAcknowledgeClose: 'avalon-lady-ack-close',
  avalonLadyResultModal: 'avalon-lady-result-modal',
  avalonLadyResultText: 'avalon-lady-result-text',
  avalonLadyResultClose: 'avalon-lady-result-close',

  // Werewolf sheriff election
  sheriffElectionPanel: 'sheriff-election-panel',
  sheriffElectionHud: 'sheriff-election-hud',
  sheriffElectionHudPhase: 'sheriff-election-hud-phase',
  sheriffDetailsButton: 'sheriff-details-button',
  sheriffDetailsCloseButton: 'sheriff-details-close-button',
  sheriffElectionSheet: 'sheriff-election-sheet',
  sheriffElectionInspector: 'sheriff-election-inspector',
  sheriffElectionPhase: 'sheriff-election-phase',
  sheriffRegisteredSeats: 'sheriff-registered-seats',
  sheriffWithdrawnSeats: 'sheriff-withdrawn-seats',
  sheriffActiveCandidateSeats: 'sheriff-active-candidate-seats',
  sheriffSpeakingInstruction: 'sheriff-speaking-instruction',
  sheriffVoteProgress: 'sheriff-vote-progress',
  sheriffHudPendingSeats: 'sheriff-hud-pending-seats',
  sheriffVoteProgressPendingSeats: 'sheriff-vote-progress-pending-seats',
  sheriffRegisterButton: 'sheriff-register-button',
  sheriffCancelRegistrationButton: 'sheriff-cancel-registration-button',
  sheriffWithdrawButton: 'sheriff-withdraw-button',
  sheriffOpenVoteButton: 'sheriff-open-vote-button',
  sheriffCandidateButton: (seat: number) => `sheriff-candidate-button-${seat}`,
  sheriffAbstainButton: 'sheriff-abstain-button',
  sheriffAdvanceButton: 'sheriff-advance-button',
  sheriffSelfDestructButton: 'sheriff-self-destruct-button',
  sheriffCompletedRound: (round: string) => `sheriff-completed-round-${round}`,
  sheriffRegisteredSeatDot: (seat: number) => `sheriff-registered-seat-${seat}`,
  sheriffActiveCandidateSeatDot: (seat: number) => `sheriff-active-candidate-seat-${seat}`,
  sheriffTallyGroup: (round: string, seat: number) => `sheriff-tally-${round}-${seat}`,
  sheriffBallotChip: (round: string, voterSeat: number) =>
    `sheriff-ballot-chip-${round}-${voterSeat}`,
  sheriffAbstainRow: (round: string) => `sheriff-abstain-${round}`,
  sheriffAbstainChip: (round: string, voterSeat: number) =>
    `sheriff-abstain-chip-${round}-${voterSeat}`,
  sheriffElectionResult: 'sheriff-election-result',

  // ActionMessage / BottomActionPanel
  actionMessage: 'action-message',
  audioWaitingMessage: 'audio-waiting-message',
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
  // Stage content (docs/room-stage-layout-design.md)
  roomStageHud: 'room-stage-hud',
  roomStageTimer: 'room-stage-timer',
  roomStageChip: (key: string) => `room-stage-chip-${key}`,
  roomStageRosterChip: 'room-stage-roster-chip',
  roomStageRosterSheet: 'room-stage-roster-sheet',
  roomStageRosterRow: (seat: number) => `room-stage-roster-row-${seat}`,
  roomStageTakeOverButton: (seat: number) => `room-stage-take-over-${seat}`,
  fibIdentityModal: 'fib-identity-modal',
  fibIdentityRole: 'fib-identity-role',
  fibIdentityWord: 'fib-identity-word',
  fibIdentityPinyin: 'fib-identity-pinyin',
  fibIdentityDefinition: 'fib-identity-definition',
  fibIdentityCoreMeaning: 'fib-identity-core-meaning',
  fibIdentityUsageNote: 'fib-identity-usage-note',
  fibRulesButton: 'fib-rules-button',
  fibPreparationStatus: 'fib-preparation-status',
  fibCancelPreparingButton: 'fib-cancel-preparing-button',
  fibRetryPreparationButton: 'fib-retry-preparation-button',
  fibRevealRoundButton: 'fib-reveal-round-button',
  fibGuessSeatButton: 'fib-guess-seat-button',
  fibRedrawRoundButton: 'fib-redraw-round-button',
  fibViewResultButton: 'fib-view-result-button',

  // Pictionary
  pictionaryStageFrame: 'pictionary-stage-frame',
  pictionaryDrawingCanvas: 'pictionary-drawing-canvas',
  pictionaryDrawingPrompt: 'pictionary-drawing-prompt',
  pictionaryDrawingSubmitButton: 'pictionary-drawing-submit-button',
  pictionaryTextInput: 'pictionary-text-input',
  pictionaryTextSubmitButton: 'pictionary-text-submit-button',
  pictionaryDrawingImageButton: 'pictionary-drawing-image-button',
  pictionaryDrawingFullscreenPreview: 'pictionary-drawing-fullscreen-preview',
  pictionaryGalleryAlbum: 'pictionary-gallery-album',
  pictionaryGalleryEntry: 'pictionary-gallery-entry',
  pictionaryGalleryAdvanceButton: 'pictionary-gallery-advance-button',
  pictionaryGalleryShareButton: 'pictionary-gallery-share-button',

  // StoryRelay
  storyRelayStage: 'storyrelay-stage',
  storyRelayTask: 'storyrelay-task',
  storyRelayEditor: 'storyrelay-editor',
  storyRelayReady: 'storyrelay-ready',
  storyRelayPreviousEntry: 'storyrelay-previous-entry',
  storyRelayGallery: 'storyrelay-gallery',
  storyRelayGalleryList: 'storyrelay-gallery-list',
  storyRelayEntry: (index: number) => `storyrelay-entry-${index}`,
  storyRelayGalleryShareButton: 'storyrelay-gallery-share-button',

  // Gallery (shared heading, playback and pager controls)
  galleryAlbumEyebrow: 'gallery-album-eyebrow',
  galleryAlbumTitle: 'gallery-album-title',
  galleryAlbumDescription: 'gallery-album-description',
  galleryRewindButton: 'gallery-rewind-button',
  galleryAdvanceButton: 'gallery-advance-button',
  galleryTogglePlayButton: 'gallery-toggle-play-button',
  galleryFinishButton: 'gallery-finish-button',
  galleryPagerPrevButton: (scope: string) => `${scope}-pager-prev`,
  galleryPagerNextButton: (scope: string) => `${scope}-pager-next`,
  galleryPagerPosition: (scope: string) => `${scope}-pager-position`,

  // Undercover
  undercoverWordModal: 'undercover-word-modal',
  undercoverWord: 'undercover-word',
  undercoverConfirm: 'undercover-confirm',
  undercoverSelectPlayer: 'undercover-select-player',
  undercoverCancelSelection: 'undercover-cancel-selection',
  undercoverRetry: 'undercover-retry',
  undercoverAllowRepeated: 'undercover-allow-repeated',
  undercoverRevealModal: 'undercover-reveal-modal',
  undercoverRevealSeat: 'undercover-reveal-seat',
  undercoverRevealPlayer: 'undercover-reveal-player',
  undercoverRevealCancel: 'undercover-reveal-cancel',
  undercoverReveal: 'undercover-reveal',

  // DrawGuess
  drawGuessDrawingCanvas: 'drawguess-drawing-canvas',
  drawGuessDrawerZeroedNote: 'drawguess-drawer-zeroed-note',
  drawGuessGuessPeek: 'drawguess-guess-peek',
  drawGuessGuessLogSheet: 'drawguess-guess-log-sheet',
  drawGuessWordChoice: (index: number) => `drawguess-word-choice-${index}`,

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

  // Room review （本局复盘）
  roomReviewOpenButton: 'room-review-open',
  roomReviewHostAction: 'room-review-host-action',
  roomReviewDialog: 'room-review-dialog',
  roomReviewShareButton: 'room-review-share',
  roomReviewSharePageButton: 'room-review-share-page',
  roomReviewProgress: 'room-review-progress',
  roomReviewStagePage: (pageKey: string) => `room-review-stage-page-${pageKey}`,
  roomReviewRosterRow: (seat: number) => `room-review-roster-row-${seat}`,

  // Music settings page
  musicSettingsBack: 'music-settings-back',
  musicBgmTrack: (trackId: string) => `music-bgm-track-${trackId}`,

  // ShareReviewModal (werewolf: grant seats access to the review)
  shareReviewButton: 'share-review-button',
  shareReviewModal: 'share-review-modal',

  // QRCodeModal
  qrCodeModal: 'qr-code-modal',
  qrCodeShareButton: 'qr-code-share-button',
  qrCodeCloseButton: 'qr-code-close-button',

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
