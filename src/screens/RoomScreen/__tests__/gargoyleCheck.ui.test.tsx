/**
 * Gargoyle UI Test
 *
 * Tests gargoyleCheck schema UI: prompt, seat selection, confirm dialog, reveal flow.
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
    schemaId: 'gargoyleCheck',
    currentActionRole: 'gargoyle',
    myRole: 'gargoyle',
    mySeatNumber: 0,
    overrides: {
      submitAction: mockSubmitAction,
      waitForGargoyleReveal: jest
        .fn()
        .mockResolvedValue({ kind: 'GARGOYLE_REVEAL', targetSeat: 2, result: '狼人' }),
    },
  });

let mockUseGameRoomReturn: ReturnType<typeof makeMock>;

jest.mock('../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomReturn,
}));

describe('Gargoyle UI (gargoyleCheck schema)', () => {
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
        SCHEMAS.gargoyleCheck.ui.prompt,
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

    // Tap on seat 2 (not self)
    const seat2 = getByTestId(TESTIDS.seatTilePressable(2));
    fireEvent.press(seat2);

    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalledWith(
        SCHEMAS.gargoyleCheck.ui.confirmTitle,
        SCHEMAS.gargoyleCheck.ui.confirmText,
        expect.any(Array),
      );
    });
  });

  it('gargoyle can check self (no notSelf constraint)', async () => {
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

    // Tap on self (seat 0) - should show confirm dialog (not disabled)
    const seat0 = getByTestId(TESTIDS.seatTilePressable(0));
    fireEvent.press(seat0);

    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalledWith(
        SCHEMAS.gargoyleCheck.ui.confirmTitle,
        SCHEMAS.gargoyleCheck.ui.confirmText,
        expect.any(Array),
      );
    });
  });

  it('schema has no notSelf constraint (can check self)', () => {
    expect(SCHEMAS.gargoyleCheck.constraints).not.toContain('notSelf');
  });

  it('schema has revealKind=gargoyle for reveal flow', () => {
    expect(SCHEMAS.gargoyleCheck.ui.revealKind).toBe('gargoyle');
  });
});
