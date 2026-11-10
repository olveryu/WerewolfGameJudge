/**
 * WerewolfRoomScreen Test Harness - Public API
 *
 * Provides test infrastructure for WerewolfRoomScreen UI tests.
 */

export {
  BOARD_TEST_FILE_MAP,
  type BoardConfig,
  boardHasNightmare,
  boardHasRole,
  getAll12PBoards,
  getBoardByName,
  getRequiredServerDataDialogTypes,
  getRequiredUiDialogTypes,
} from './boardDialogCoverage';
export {
  actorStep,
  chainActionConfirm,
  chainConfirmTrigger,
  chainSkipConfirm,
  chainWolfRobotHunterStatus,
  chainWolfVoteConfirm,
  click,
  confirmStep,
  coverageChainActionPrompt,
  coverageChainConfirmTrigger,
  coverageChainMagicianSwap,
  coverageChainNightmareBlocked,
  coverageChainSeatActionConfirm,
  coverageChainSkipConfirm,
  coverageChainWitchPoisonPrompt,
  coverageChainWitchSavePrompt,
  coverageChainWolfRobotHunterStatus,
  coverageChainWolfVote,
  coverageChainWolfVoteEmpty,
  createReactiveWerewolfRoomMock,
  createWerewolfRoomMock,
  createWerewolfRoomMockFromState,
  mountRoomFor,
  mountWerewolfRoom,
  pressText,
  renderWerewolfRoom,
  requireBottomActionText,
  requireEmptyVoteText,
  type SubmitActionMock,
  successfulWerewolfCommand,
  tapSeat,
  waitForRoomScreen,
  type WerewolfDispatchOutcome,
  type WerewolfRoomMock,
  type WerewolfRoomMockOptions,
  witchStep,
  wolfKillStep,
} from './boardTestUtils';
export {
  type DialogEvent,
  type DialogType,
  recordAlerts,
  RoomScreenTestHarness,
} from './RoomScreenTestHarness';
