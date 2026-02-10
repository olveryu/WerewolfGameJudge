/**
 * RoomScreen Test Harness - Public API
 *
 * Provides test infrastructure for RoomScreen UI tests.
 */

export {
  RoomScreenTestHarness,
  createShowAlertMock,
  type DialogType,
  type DialogEvent,
} from './RoomScreenTestHarness';

export {
  getAll12PBoards,
  getBoardByName,
  getRequiredUiDialogTypes,
  getRequiredHostDataDialogTypes,
  boardHasRole,
  boardHasNightmare,
  BOARD_TEST_FILE_MAP,
  type BoardConfig,
} from './boardDialogCoverage';

export {
  mockNavigation,
  createGameRoomMock,
  createReactiveGameRoomMock,
  waitForRoomScreen,
  tapSeat,
  MockSafeAreaView,
  chainWolfVoteConfirm,
  chainSkipConfirm,
  chainConfirmTrigger,
  chainWolfRobotHunterStatus,
  chainActionConfirm,
  // Coverage-integrated chain drivers
  coverageChainWolfVote,
  coverageChainSkipConfirm,
  coverageChainConfirmTrigger,
  coverageChainWolfRobotHunterStatus,
  coverageChainActionPrompt,
  coverageChainWitchSavePrompt,
  coverageChainWitchPoisonPrompt,
  coverageChainMagicianSwap,
  coverageChainNightmareBlocked,
  coverageChainSeatActionConfirm,
  coverageChainWolfVoteEmpty,
  coverageChainWitchNoKill,
  coverageChainWitchSkipAll,
} from './boardTestUtils';
