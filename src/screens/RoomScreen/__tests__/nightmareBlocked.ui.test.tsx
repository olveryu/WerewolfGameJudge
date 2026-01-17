/**
 * Nightmare Blocked UI Test
 *
 * Tests that nightmare-blocked players see correct UI from BLOCKED_UI_DEFAULTS.
 * This is a UI-level lock test for P2 schema-driven changes.
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

// Test scenario: Seer is blocked by nightmare
const makeBlockedPlayerMock = (overrides: Record<string, unknown> = {}) => {
  const base = makeBaseUseGameRoomReturn({
    schemaId: 'seerCheck',
    currentActionRole: 'seer',
    myRole: 'seer',
    mySeatNumber: 0,
  });

  // Override nightmareBlockedSeat to block seat 0 (mySeatNumber)
  return {
    ...base,
    gameState: {
      ...base.gameState,
      nightmareBlockedSeat: 0, // Seer at seat 0 is blocked
    },
    ...overrides,
  };
};

let mockUseGameRoomReturn: ReturnType<typeof makeBlockedPlayerMock>;

jest.mock('../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomReturn,
}));

describe('Nightmare Blocked UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGameRoomReturn = makeBlockedPlayerMock();
  });

  it('blocked player tapping a seat shows alert with BLOCKED_UI_DEFAULTS', async () => {
    const { getByTestId } = render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitFor(() => {
      expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
    });

    // Tap on a seat (should trigger blocked alert)
    const seat1 = getByTestId(TESTIDS.seatTilePressable(1));
    fireEvent.press(seat1);

    // Verify showAlert was called with BLOCKED_UI_DEFAULTS values
    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalledWith(
        BLOCKED_UI_DEFAULTS.title,
        BLOCKED_UI_DEFAULTS.message,
        expect.arrayContaining([
          expect.objectContaining({ text: BLOCKED_UI_DEFAULTS.dismissButtonText }),
        ]),
      );
    });
  });

  it('confirm schema (hunter) shows blocked prompt from BLOCKED_UI_DEFAULTS when blocked', async () => {
    // Hunter blocked by nightmare
    mockUseGameRoomReturn = makeBaseUseGameRoomReturn({
      schemaId: 'hunterConfirm',
      currentActionRole: 'hunter',
      myRole: 'hunter',
      mySeatNumber: 0,
      overrides: {
        getConfirmStatus: jest.fn().mockReturnValue({ canShoot: true }),
      },
    });
    mockUseGameRoomReturn.gameState.nightmareBlockedSeat = 0;

    render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    // Wait for the action prompt to trigger
    await waitFor(() => {
      // The blocked prompt should use BLOCKED_UI_DEFAULTS
      expect(mockShowAlert).toHaveBeenCalledWith(
        BLOCKED_UI_DEFAULTS.title,
        BLOCKED_UI_DEFAULTS.message,
        expect.any(Array),
      );
    });
  });
});
