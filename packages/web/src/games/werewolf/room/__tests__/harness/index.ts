/**
 * WerewolfRoomScreen Test Harness - Public API
 *
 * Provides test infrastructure for WerewolfRoomScreen UI tests.
 */

export { BOARD_TEST_FILE_MAP, getAll12PBoards } from './boardDialogCoverage';
export {
  actorStep,
  click,
  createReactiveWerewolfRoomMock,
  createWerewolfRoomMock,
  createWerewolfRoomMockFromState,
  getDispatchOutcome,
  mountRoomFor,
  mountWerewolfRoom,
  openNightActionGroup,
  tapSeat,
  type WerewolfDispatchOutcome,
  type WerewolfRoomMock,
  type WerewolfRoomMockOptions,
} from './boardTestUtils';
export {
  type DialogEvent,
  type DialogType,
  recordAlerts,
  RoomScreenTestHarness,
} from './RoomScreenTestHarness';
