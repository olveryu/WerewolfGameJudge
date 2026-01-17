/**
 * Wolf Robot UI Test
 *
 * Tests wolfRobotLearn schema UI: prompt, seat selection, confirm dialog, reveal flow.
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
    schemaId: 'wolfRobotLearn',
    currentActionRole: 'wolfRobot',
    myRole: 'wolfRobot',
    mySeatNumber: 0,
    overrides: {
      submitAction: mockSubmitAction,
      waitForWolfRobotReveal: jest
        .fn()
        .mockResolvedValue({ kind: 'WOLF_ROBOT_REVEAL', targetSeat: 2, result: '预言家' }),
    },
  });

let mockUseGameRoomReturn: ReturnType<typeof makeMock>;

jest.mock('../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomReturn,
}));

describe('Wolf Robot UI (wolfRobotLearn schema)', () => {
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
        SCHEMAS.wolfRobotLearn.ui.prompt,
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
        SCHEMAS.wolfRobotLearn.ui.confirmTitle,
        SCHEMAS.wolfRobotLearn.ui.confirmText,
        expect.any(Array),
      );
    });
  });

  it('tapping self shows disabled alert (notSelf constraint - UX early rejection)', async () => {
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

    const seat0 = getByTestId(TESTIDS.seatTilePressable(0));
    fireEvent.press(seat0);

    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalledWith('不可选择', '不能选择自己', expect.any(Array));
    });
  });

  it('schema has notSelf constraint defined', () => {
    expect(SCHEMAS.wolfRobotLearn.constraints).toContain('notSelf');
  });

  it('schema has revealKind=wolfRobot for reveal flow', () => {
    expect(SCHEMAS.wolfRobotLearn.ui.revealKind).toBe('wolfRobot');
  });
});
