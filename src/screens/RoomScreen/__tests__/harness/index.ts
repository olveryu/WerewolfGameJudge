/**
 * RoomScreen Test Harness - Public API
 *
 * Provides test infrastructure for RoomScreen UI tests.
 */

export {
  RoomScreenTestHarness,
  setupHarness,
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
  getBoardSpecialRole,
  generateCoverageMatrix,
  getTestFileName,
  BOARD_TEST_FILE_MAP,
  type BoardConfig,
  type CoverageEntry,
} from './boardDialogCoverage';

export {
  mockNavigation,
  createGameRoomMock,
  createReactiveGameRoomMock,
  setupBoardTestMocks,
  waitForRoomScreen,
  tapSeat,
  tapBottomAction,
  pressDialogButton,
  MockSafeAreaView,
  chainWolfVoteConfirm,
  chainSkipConfirm,
  chainConfirmTrigger,
  chainWolfRobotHunterStatus,
  chainActionConfirm,
  type GameStateMockOptions,
  type BoardTestContext,
  type ActionRejection,
  type ReactiveGameRoomMock,
} from './boardTestUtils';
