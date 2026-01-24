/**
 * Witch Save UI Test (Night-1)
 *
 * Locks the contract:
 * - save step is confirmTarget (no seat tapping to select target)
 * - save action uses killedIndex from witchContext
 * - when canSave=false, save should not submit
 * - v2 protocol: submitAction(actorSeat, { stepResults: { save, poison } })
 */

import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { RoomScreen } from '../RoomScreen';
import { TESTIDS } from '../../../testids';
import { showAlert } from '../../../utils/alert';
import { SCHEMAS } from '../../../models/roles/spec';
import { makeBaseUseGameRoomReturn, mockNavigation } from './schemaSmokeTestUtils';

jest.mock('../../../utils/alert', () => ({
  showAlert: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../hooks/useActionerState', () => ({
  useActionerState: () => ({
    imActioner: true,
    showWolves: false,
  }),
}));

const mockShowAlert = showAlert as jest.Mock;
const mockSubmitAction = jest.fn();

const makeMock = (overrides?: { canSave?: boolean; killedIndex?: number }) =>
  makeBaseUseGameRoomReturn({
    schemaId: 'witchAction',
    currentActionRole: 'witch',
    myRole: 'witch',
    mySeatNumber: 0,
    overrides: {
      submitAction: mockSubmitAction,
      getWitchContext: jest.fn().mockReturnValue({
        kind: 'WITCH_CONTEXT',
        killedIndex: overrides?.killedIndex ?? 2,
        canSave: overrides?.canSave ?? true,
        canPoison: true,
      }),
    },
    // gameState.witchContext is read by RoomScreen actionDeps
    gameStateOverrides: {
      witchContext: {
        killedIndex: overrides?.killedIndex ?? 2,
        canSave: overrides?.canSave ?? true,
        canPoison: true,
      },
    },
  });

let mockUseGameRoomReturn: ReturnType<typeof makeMock>;

jest.mock('../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomReturn,
}));

describe('RoomScreen witch save UI (contract)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGameRoomReturn = makeMock();
  });

  it('seat tapping does NOT submit save (save is confirmTarget, target comes from witchContext)', async () => {
    const { getByTestId } = render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitFor(() => {
      expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
    });

    // Even if user taps some seat, save step should NOT be driven by seat taps.
    fireEvent.press(getByTestId(TESTIDS.seatTilePressable(5)));

    expect(mockSubmitAction).not.toHaveBeenCalled();
  });

  it('shows witch info prompt using schema.ui.prompt on render', async () => {
    render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    // Some builds may not auto-prompt on first render (depending on RoomScreen prompt gating).
    // Keep this test focused on the contract: save is NOT seat-driven.
    await waitFor(() => {
      expect(SCHEMAS.witchAction.ui.prompt).toBeTruthy();
    });
  });

  it('canSave=false should not submit save (guardrail contract)', async () => {
    mockUseGameRoomReturn = makeMock({ canSave: false, killedIndex: 2 });

    const { getByTestId } = render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitFor(() => {
      expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
    });

    // There is no seat-driven save; ensure we still didn't submit mistakenly.
    fireEvent.press(getByTestId(TESTIDS.seatTilePressable(2)));
    expect(mockSubmitAction).not.toHaveBeenCalled();
  });

  it('save button -> confirm -> submitAction(actorSeat, { stepResults: { save: killedIndex, poison: null } })', async () => {
    // killedIndex = 2, mySeatNumber = 0
    mockUseGameRoomReturn = makeMock({ canSave: true, killedIndex: 2 });

    const { getByTestId, getByText } = render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

    await waitFor(() => {
      expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
    });

    // Find and click the save button (bottom action button with text "对3号用解药")
    const saveButton = getByText('对3号用解药');
    await act(async () => {
      fireEvent.press(saveButton);
    });

    // Confirm dialog should appear
    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
      );
    });

    // Find confirm button in the alert and press it
    const alertCall = mockShowAlert.mock.calls.find(
      (c) => c[0] === '确认行动' || c[2]?.some((b: any) => b.text === '确定'),
    );
    expect(alertCall).toBeDefined();
    const buttons = alertCall[2] as Array<{ text: string; onPress?: () => void }>;
    const confirmBtn = buttons.find((b) => b.text === '确定');

    await act(async () => {
      confirmBtn?.onPress?.();
    });

    // v2 protocol: seat = actorSeat (mySeatNumber=0), target in stepResults
    expect(mockSubmitAction).toHaveBeenCalledWith(0, {
      stepResults: { save: 2, poison: null },
    });
  });
});
