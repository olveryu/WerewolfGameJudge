/**
 * RoomScreen Test Harness - Public API
 *
 * Provides test infrastructure for RoomScreen UI tests.
 */

export {
  BOARD_TEST_FILE_MAP,
  type BoardConfig,
  boardHasNightmare,
  boardHasRole,
  getAll12PBoards,
  getBoardByName,
  getRequiredHostDataDialogTypes,
  getRequiredUiDialogTypes,
} from './boardDialogCoverage';
export {
  chainActionConfirm,
  chainConfirmTrigger,
  chainSkipConfirm,
  chainWolfRobotHunterStatus,
  chainWolfVoteConfirm,
  coverageChainActionPrompt,
  coverageChainConfirmTrigger,
  coverageChainMagicianSwap,
  coverageChainNightmareBlocked,
  coverageChainSeatActionConfirm,
  coverageChainSkipConfirm,
  coverageChainWitchPoisonPrompt,
  coverageChainWitchSavePrompt,
  coverageChainWolfRobotHunterStatus,
  // Coverage-integrated chain drivers
  coverageChainWolfVote,
  coverageChainWolfVoteEmpty,
  createGameRoomMock,
  createReactiveGameRoomMock,
  mockNavigation,
  MockSafeAreaView,
  tapSeat,
  waitForRoomScreen,
} from './boardTestUtils';
export {
  createShowAlertMock,
  type DialogType,
  RoomScreenTestHarness,
} from './RoomScreenTestHarness';
