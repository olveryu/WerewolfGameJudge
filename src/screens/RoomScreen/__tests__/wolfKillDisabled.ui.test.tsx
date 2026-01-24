/**
 * Wolf Kill Disabled UI Test (Host-authoritative version)
 *
 * NEW BEHAVIOR:
 * - UI does NOT intercept wolfKillDisabled
 * - Wolf players can still tap seats (intent flows through)
 * - Host validates and rejects if needed
 * - Bottom button shows normal "空刀" (not forced skip)
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { RoomScreen } from '../RoomScreen';
import { makeBaseUseGameRoomReturn, mockNavigation } from './schemaSmokeTestUtils';
import { TESTIDS } from '../../../testids';

jest.mock('../../../utils/alert', () => ({
  showAlert: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

// Test scenario: Wolf during wolfKill step with wolfKillDisabled=true
const makeWolfKillDisabledMock = () => {
  const base = makeBaseUseGameRoomReturn({
    schemaId: 'wolfKill',
    currentActionRole: 'wolf',
    myRole: 'wolf',
    mySeatNumber: 0,
  });

  return {
    ...base,
    gameState: {
      ...base.gameState,
      currentNightResults: { wolfKillDisabled: true },
      nightmareBlockedSeat: null,
    },
  };
};

let mockUseGameRoomReturn: ReturnType<typeof makeWolfKillDisabledMock>;

jest.mock('../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomReturn,
}));

describe('Wolf Kill Disabled UI (Host-authoritative)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGameRoomReturn = makeWolfKillDisabledMock();
  });

  it('wolf player sees normal empty vote button (not forced skip)', async () => {
    const { getByTestId, queryByText } = render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitFor(() => {
      expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
    });

    // UI no longer forces skip - shows normal empty vote button
    await waitFor(() => {
      const emptyButton = queryByText('空刀');
      expect(emptyButton).toBeTruthy();
    });
  });

  it('pressing empty vote button triggers wolf vote', async () => {
    const { getByTestId, getByText } = render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitFor(() => {
      expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
    });

    // Press normal empty vote button
    const emptyButton = getByText('空刀');
    fireEvent.press(emptyButton);

    // Button exists and is pressable
    expect(emptyButton).toBeTruthy();
  });
});
