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
  getRequiredDialogTypes,
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
  setupBoardTestMocks,
  waitForRoomScreen,
  tapSeat,
  tapBottomAction,
  pressDialogButton,
  MockSafeAreaView,
  type GameStateMockOptions,
  type BoardTestContext,
} from './boardTestUtils';
