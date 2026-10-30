/**
 * Nightmare Blocked UI Test (server-authoritative version)
 *
 * NEW BEHAVIOR:
 * - UI does NOT intercept blocked players for chooseSeat/swap schemas
 * - UI shows skip button for confirm schemas when blocked
 * - Server returns ACTION_REJECTED with blocked reason
 * - UI shows error from gameState.actionRejected
 */

import { BLOCKED_UI_DEFAULTS } from '@game-judge/game-engine/games/werewolf/public';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { WerewolfRoomScreen } from '@/games/werewolf/room/__tests__/harness/ReadyWerewolfRoomScreen';
import { TESTIDS } from '@/testids';
import { showAlert } from '@/utils/alert';

import { createBaseWerewolfRoomMock, mockNavigation, mockRoom } from './schemaSmokeTestUtils';

jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
  showAlert: jest.fn(),
}));

const mockShowAlert = jest.mocked(showAlert);

/** A nightmare-blocked actor at seat 0 (the engine hint follows from the blocked seat). */
const makeBlockedPlayerMock = () =>
  createBaseWerewolfRoomMock({
    schemaId: 'seerCheck',
    currentActionRole: 'seer',
    myRole: 'seer',
    mySeat: 0,
    gameStateOverrides: { nightmareBlockedSeat: 0, currentNightResults: { blockedSeat: 0 } },
  });

const makeConfirmMock = (role: 'hunter' | 'darkWolfKing', isBlocked: boolean) =>
  createBaseWerewolfRoomMock({
    schemaId: role === 'hunter' ? 'hunterConfirm' : 'darkWolfKingConfirm',
    currentActionRole: role,
    myRole: role,
    mySeat: 0,
    gameStateOverrides: {
      confirmStatus: { role, canShoot: true },
      ...(isBlocked ? { nightmareBlockedSeat: 0, currentNightResults: { blockedSeat: 0 } } : {}),
    },
  });

let mockUseWerewolfRoomReturn: ReturnType<typeof createBaseWerewolfRoomMock>;

jest.mock('@/games/werewolf/room/__tests__/harness/activeRoomMock', () => ({
  getActiveRoomMock: () => mockUseWerewolfRoomReturn,
}));

describe('Nightmare Blocked UI (server-authoritative)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWerewolfRoomReturn = makeBlockedPlayerMock();
  });

  it('blocked player tapping a seat is inert: the engine hint leaves only the skip', async () => {
    const { getByTestId, getByText } = render(
      <WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />,
    );

    await waitFor(() => {
      expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
    });
    // The blocked prompt is the engine's override, shown once on entry.
    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalledWith(
        BLOCKED_UI_DEFAULTS.title,
        BLOCKED_UI_DEFAULTS.message,
        expect.any(Array),
      );
    });
    expect(getByText(BLOCKED_UI_DEFAULTS.skipButtonText)).toBeTruthy();

    mockShowAlert.mockClear();
    fireEvent.press(getByTestId(TESTIDS.seatTilePressable(1)));

    // No confirm, no client-side "blocked" alert: the client never re-judges the block.
    expect(mockShowAlert).not.toHaveBeenCalled();
  });

  it('actionRejected with blocked reason shows rejection alert on initial render', async () => {
    // The rejection reaches the UI through the projection (night.rejection),
    // so it must enter the mock as state, not be patched onto gameState.
    mockUseWerewolfRoomReturn = createBaseWerewolfRoomMock({
      schemaId: 'seerCheck',
      currentActionRole: 'seer',
      myRole: 'seer',
      mySeat: 0,
      gameStateOverrides: {
        nightmareBlockedSeat: 0,
        actionRejected: {
          action: 'seerCheck',
          reason: BLOCKED_UI_DEFAULTS.message,
          targetSeat: 0,
          rejectionId: 'test-rejection-1',
        },
      },
    });

    render(<WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />);

    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalledWith(
        '操作失败',
        BLOCKED_UI_DEFAULTS.message,
        expect.any(Array),
      );
    });
  });

  it.each(['hunter', 'darkWolfKing'] as const)(
    'confirm schema (%s) shows the skip button when blocked',
    async (role) => {
      mockUseWerewolfRoomReturn = makeConfirmMock(role, true);

      const { getByTestId, queryByText, getByRole } = render(
        <WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />,
      );

      await waitFor(() => {
        expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
      });

      // When blocked, the actor sees the skip button instead of the status confirm.
      await waitFor(() => {
        expect(queryByText(BLOCKED_UI_DEFAULTS.skipButtonText)).toBeTruthy();
        expect(getByRole('button', { name: '确认跳过' })).toBeTruthy();
      });
    },
  );

  it.each(['hunter', 'darkWolfKing'] as const)(
    'confirm schema (%s) does NOT show the skip button when not blocked',
    async (role) => {
      mockUseWerewolfRoomReturn = makeConfirmMock(role, false);

      const { getByTestId, queryByText } = render(
        <WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />,
      );

      await waitFor(() => {
        expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
      });

      await waitFor(() => {
        expect(queryByText(BLOCKED_UI_DEFAULTS.skipButtonText)).toBeNull();
      });
    },
  );
});
