/**
 * Slacker (懒汉) UI Test
 * 
 * Tests slackerChooseIdol schema UI: prompt, seat selection, confirm dialog.
 * Special: canSkip = false (slacker MUST choose an idol).
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

const makeMock = () => makeBaseUseGameRoomReturn({
  schemaId: 'slackerChooseIdol',
  currentActionRole: 'slacker',
  myRole: 'slacker',
  mySeatNumber: 0,
  overrides: {
    submitAction: mockSubmitAction,
  },
});

let mockUseGameRoomReturn: ReturnType<typeof makeMock>;

jest.mock('../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomReturn,
}));

describe('Slacker UI (slackerChooseIdol schema)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGameRoomReturn = makeMock();
  });

  it('shows action prompt with schema.ui.prompt on render', async () => {
    render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />
    );

    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalledWith(
        '行动提示',
        SCHEMAS.slackerChooseIdol.ui.prompt,
        expect.any(Array)
      );
    });
  });

  it('tapping seat shows confirm dialog with schema.ui.confirmText', async () => {
    const { getByTestId } = render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />
    );

    await waitFor(() => {
      expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
    });

    // Tap on seat 2 (not self)
    const seat2 = getByTestId(TESTIDS.seatTilePressable(2));
    fireEvent.press(seat2);

    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalledWith(
        SCHEMAS.slackerChooseIdol.ui.confirmTitle,
        SCHEMAS.slackerChooseIdol.ui.confirmText,
        expect.any(Array)
      );
    });
  });

  it('schema has canSkip=false (slacker must choose idol)', () => {
    expect(SCHEMAS.slackerChooseIdol.canSkip).toBe(false);
  });

  it('schema has notSelf constraint (enforced by Host resolver)', () => {
    // Schema-first constraint: notSelf is defined in schema
    // Host resolver enforces this; UI tests just verify schema config
    expect(SCHEMAS.slackerChooseIdol.constraints).toContain('notSelf');
  });
});
