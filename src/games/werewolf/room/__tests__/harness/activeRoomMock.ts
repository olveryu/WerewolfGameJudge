/**
 * The room mock the harness screen renders. Board tests mock this module
 * (`jest.mock('.../harness/activeRoomMock', () => ({ getActiveRoomMock: () => mock }))`)
 * so each test owns which session and audio the screen mounts with.
 */

import type { WerewolfRoomMock } from './boardTestUtils';

export function getActiveRoomMock(): WerewolfRoomMock {
  throw new Error('[TEST] getActiveRoomMock must be mocked by the test file');
}
