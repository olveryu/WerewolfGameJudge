/**
 * useReadyRoomSession: fails fast outside an authenticated ready session,
 * exposes the authoritative state, and binds the single-flight submit to
 * the session's dispatch with the caller's controlled seat.
 */
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { act, renderHook } from '@testing-library/react-native';

import type { User } from '@/contexts/AuthContext';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  createFakeRoomLink,
  enteringLinkSnapshot,
  readyLinkSnapshot,
  testIdentity,
} from '@/test-utils/linkSnapshot';
import { rejectedRoomCommand, successfulRoomCommand } from '@/test-utils/roomCommand';
import { showErrorAlert } from '@/utils/alertPresets';

import { useReadyRoomSession } from '../useReadyRoomSession';

jest.mock('@/contexts/AuthContext', () => ({ useAuthContext: jest.fn() }));
jest.mock('@/utils/alertPresets', () => ({
  ...jest.requireActual<typeof import('@/utils/alertPresets')>('@/utils/alertPresets'),
  showErrorAlert: jest.fn(),
}));

type TestState = BaseGameState<'demo'>;
type TestCommand = { readonly type: 'demo.noop' };

const state: TestState = {
  gameType: 'demo',
  stateVersion: 1,
  roomCode: '1234',
  hostUserId: 'host',
};
const user: User = {
  id: 'host',
  email: null,
  displayName: 'Host',
  avatarUrl: null,
  customAvatarUrl: null,
  avatarFrame: null,
  seatFlair: null,
  nameStyle: null,
  equippedEffect: null,
  seatAnimation: null,
  isAnonymous: true,
};
const ready = readyLinkSnapshot<TestState>(testIdentity('demo'), {
  gameType: 'demo',
  stateVersion: 1,
  revision: 7,
  state,
});
const failureMessage = () => '测试失败文案';

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuthContext).mockReturnValue({ user } as ReturnType<typeof useAuthContext>);
});

describe('useReadyRoomSession', () => {
  it('exposes the ready state, revision and user', () => {
    const link = createFakeRoomLink<TestState, TestCommand>(ready);
    const { result } = renderHook(() => useReadyRoomSession(link, failureMessage));
    expect(result.current.state).toBe(state);
    expect(result.current.revision).toBe(7);
    expect(result.current.user).toBe(user);
    expect(result.current.isSubmitting).toBe(false);
  });

  it('fails fast when the session is not ready', () => {
    const link = createFakeRoomLink<TestState, TestCommand>(
      enteringLinkSnapshot<TestState>(testIdentity('demo')),
    );
    expect(() => renderHook(() => useReadyRoomSession(link, failureMessage))).toThrow(
      '[FAIL-FAST] Room session is not ready: entering',
    );
  });

  it('fails fast without an authenticated user', () => {
    jest
      .mocked(useAuthContext)
      .mockReturnValue({ user: null } as ReturnType<typeof useAuthContext>);
    const link = createFakeRoomLink<TestState, TestCommand>(ready);
    expect(() => renderHook(() => useReadyRoomSession(link, failureMessage))).toThrow(
      '[FAIL-FAST] Room session requires an authenticated user',
    );
  });

  it('submits through the session with the controlled seat and reports the outcome', async () => {
    const link = createFakeRoomLink<TestState, TestCommand>(ready, async () =>
      successfulRoomCommand(state, 'c1'),
    );
    const { result } = renderHook(() => useReadyRoomSession(link, failureMessage));
    let ok = false;
    await act(async () => {
      ok = await result.current.submit('测试', { type: 'demo.noop' }, 3);
    });
    expect(ok).toBe(true);
    expect(link.dispatch).toHaveBeenCalledWith(
      { type: 'demo.noop' },
      { controlledSeat: 3, label: '测试', durable: false },
    );

    link.dispatch.mockImplementation(async () => rejectedRoomCommand('nope', 'c2'));
    await act(async () => {
      ok = await result.current.submit('测试', { type: 'demo.noop' });
    });
    expect(ok).toBe(false);
    expect(link.dispatch).toHaveBeenLastCalledWith(
      { type: 'demo.noop' },
      { controlledSeat: null, label: '测试', durable: false },
    );
    expect(showErrorAlert).toHaveBeenCalledWith('测试失败', '测试失败文案');
  });
});
