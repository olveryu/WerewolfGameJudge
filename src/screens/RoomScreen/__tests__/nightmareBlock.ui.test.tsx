/**
 * Nightmare UI Test (Actor Perspective)
 *
 * Tests nightmareBlock schema UI: prompt, seat selection, confirm dialog.
 * Note: This tests nightmare as the actor, not being blocked.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { RoomScreen } from '../RoomScreen';
import { showAlert } from '../../../utils/alert';
import { SCHEMAS } from '../../../models/roles/spec';
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
const mockSubmitAction = jest.fn();

const makeMock = () =>
  makeBaseUseGameRoomReturn({
    schemaId: 'nightmareBlock',
    currentActionRole: 'nightmare',
    myRole: 'nightmare',
    mySeatNumber: 0,
    overrides: {
      submitAction: mockSubmitAction,
    },
  });

let mockUseGameRoomReturn: ReturnType<typeof makeMock>;

jest.mock('../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomReturn,
}));

describe('Nightmare UI (nightmareBlock schema - actor perspective)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGameRoomReturn = makeMock();
  });

  it('shows action prompt with schema.ui.prompt on render', async () => {
    render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalledWith(
        '行动提示',
        SCHEMAS.nightmareBlock.ui.prompt,
        expect.any(Array),
      );
    });
  });

  it('tapping seat shows confirm dialog with schema.ui.confirmText', async () => {
    const { getByTestId } = render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitFor(() => {
      expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
    });

    // Tap on seat 2 (any seat)
    const seat2 = getByTestId(TESTIDS.seatTilePressable(2));
    fireEvent.press(seat2);

    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalledWith(
        SCHEMAS.nightmareBlock.ui.confirmTitle,
        SCHEMAS.nightmareBlock.ui.confirmText,
        expect.any(Array),
      );
    });
  });

  it('nightmare can block self (no notSelf constraint - neutral judge)', async () => {
    const { getByTestId } = render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitFor(() => {
      expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
    });

    // Tap on self (seat 0) - should be allowed since nightmare has no notSelf constraint
    const seat0 = getByTestId(TESTIDS.seatTilePressable(0));
    fireEvent.press(seat0);

    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalledWith(
        SCHEMAS.nightmareBlock.ui.confirmTitle,
        SCHEMAS.nightmareBlock.ui.confirmText,
        expect.any(Array),
      );
    });
  });
});
