/**
 * Nightmare Blocked UI Test (Host-authoritative version)
 *
 * NEW BEHAVIOR:
 * - UI does NOT intercept blocked players for chooseSeat/swap schemas
 * - UI shows skip button for confirm schemas when blocked
 * - Host returns ACTION_REJECTED with blocked reason
 * - UI shows error from gameState.actionRejected
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { RoomScreen } from '../RoomScreen';
import { showAlert } from '../../../utils/alert';
import { BLOCKED_UI_DEFAULTS } from '../../../models/roles/spec';
import { makeBaseUseGameRoomReturn, mockNavigation } from './schemaSmokeTestUtils';
import { TESTIDS } from '../../../testids';

jest.mock('../../../utils/alert', () => ({
  showAlert: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

const mockShowAlert = showAlert as jest.Mock;

const makeBlockedPlayerMock = (overrides: Record<string, unknown> = {}) => {
  const base = makeBaseUseGameRoomReturn({
    schemaId: 'seerCheck',
    currentActionRole: 'seer',
    myRole: 'seer',
    mySeatNumber: 0,
  });
  return {
    ...base,
    gameState: {
      ...base.gameState,
      nightmareBlockedSeat: 0,
    },
    ...overrides,
  };
};

let mockUseGameRoomReturn: ReturnType<typeof makeBlockedPlayerMock>;

jest.mock('../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomReturn,
}));

describe('Nightmare Blocked UI (Host-authoritative)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGameRoomReturn = makeBlockedPlayerMock();
  });

  it('blocked player tapping a seat shows confirm dialog (not blocked alert)', async () => {
    const { getByTestId } = render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitFor(() => {
      expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
    });

    mockShowAlert.mockClear();

    const seat1 = getByTestId(TESTIDS.seatTilePressable(1));
    fireEvent.press(seat1);

    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalled();
      const calls = mockShowAlert.mock.calls;
      const hasBlockedAlert = calls.some(
        (call: unknown[]) =>
          call[0] === BLOCKED_UI_DEFAULTS.title && call[1] === BLOCKED_UI_DEFAULTS.message,
      );
      expect(hasBlockedAlert).toBe(false);
    });
  });

  it('actionRejected with blocked reason shows rejection alert on initial render', async () => {
    mockUseGameRoomReturn = {
      ...makeBlockedPlayerMock(),
      myUid: 'p0',
      gameState: {
        ...makeBlockedPlayerMock().gameState,
        actionRejected: {
          action: 'seerCheck',
          reason: BLOCKED_UI_DEFAULTS.message,
          targetUid: 'p0',
          rejectionId: 'test-rejection-1',
        },
      },
    };

    render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalledWith(
        '操作无效',
        BLOCKED_UI_DEFAULTS.message,
        expect.any(Array),
      );
    });
  });

  it('confirm schema (hunter) shows skip button when blocked', async () => {
    mockUseGameRoomReturn = {
      ...makeBaseUseGameRoomReturn({
        schemaId: 'hunterConfirm',
        currentActionRole: 'hunter',
        myRole: 'hunter',
        mySeatNumber: 0,
        overrides: {
          getConfirmStatus: jest.fn().mockReturnValue({ canShoot: true }),
        },
      }),
      gameState: {
        ...makeBaseUseGameRoomReturn({
          schemaId: 'hunterConfirm',
          currentActionRole: 'hunter',
          myRole: 'hunter',
          mySeatNumber: 0,
        }).gameState,
        nightmareBlockedSeat: 0,
        currentNightResults: {
          blockedSeat: 0,
        },
      },
    };

    const { getByTestId, queryByText } = render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitFor(() => {
      expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
    });

    // When blocked, hunter should see skip button instead of confirm
    await waitFor(() => {
      const skipButton = queryByText(BLOCKED_UI_DEFAULTS.skipButtonText);
      expect(skipButton).toBeTruthy();
    });
  });

  it('confirm schema (hunter) does NOT show skip button when NOT blocked', async () => {
    mockUseGameRoomReturn = {
      ...makeBaseUseGameRoomReturn({
        schemaId: 'hunterConfirm',
        currentActionRole: 'hunter',
        myRole: 'hunter',
        mySeatNumber: 0,
        overrides: {
          getConfirmStatus: jest.fn().mockReturnValue({ canShoot: true }),
        },
        gameStateOverrides: {
          nightmareBlockedSeat: null, // No nightmare block
          currentNightResults: {
            blockedSeat: null,
          },
        },
      }),
    };

    const { getByTestId, queryByText } = render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitFor(() => {
      expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
    });

    // When NOT blocked, hunter should NOT see skip button - only confirm button
    await waitFor(() => {
      const skipButton = queryByText(BLOCKED_UI_DEFAULTS.skipButtonText);
      expect(skipButton).toBeNull();
    });
  });

  it('confirm schema (darkWolfKing) does NOT show skip button when NOT blocked', async () => {
    mockUseGameRoomReturn = {
      ...makeBaseUseGameRoomReturn({
        schemaId: 'darkWolfKingConfirm',
        currentActionRole: 'darkWolfKing',
        myRole: 'darkWolfKing',
        mySeatNumber: 0,
        overrides: {
          getConfirmStatus: jest.fn().mockReturnValue({ canShoot: true }),
        },
        gameStateOverrides: {
          nightmareBlockedSeat: null, // No nightmare block
          currentNightResults: {
            blockedSeat: null,
          },
        },
      }),
    };

    const { getByTestId, queryByText } = render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitFor(() => {
      expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
    });

    // When NOT blocked, darkWolfKing should NOT see skip button
    await waitFor(() => {
      const skipButton = queryByText(BLOCKED_UI_DEFAULTS.skipButtonText);
      expect(skipButton).toBeNull();
    });
  });
});
