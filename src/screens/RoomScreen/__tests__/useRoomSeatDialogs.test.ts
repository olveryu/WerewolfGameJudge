/**
 * Tests for useRoomSeatDialogs hook
 *
 * Covers all branches:
 * - showEnterSeatDialog: show modal for entering seat
 * - showLeaveSeatDialog: show modal for leaving seat
 * - handleConfirmSeat: confirm success, confirm fail (showAlert), early return when null
 * - handleCancelSeat: cancel and reset state
 * - handleConfirmLeave: confirm leave, early return when null
 * - handleLeaveRoom: ongoing/ended direct navigate, other status shows confirm dialog
 */
import { act, renderHook } from '@testing-library/react-native';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';

import { useRoomSeatDialogs } from '@/screens/RoomScreen/useRoomSeatDialogs';
import { showAlert } from '@/utils/alert';

// Mock showAlert
jest.mock('../../../utils/alert', () => ({
  showAlert: jest.fn(),
}));

const mockShowAlert = showAlert as jest.MockedFunction<typeof showAlert>;

// Mock navigation
const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
} as unknown as Parameters<typeof useRoomSeatDialogs>[0]['navigation'];

describe('useRoomSeatDialogs', () => {
  // Common mock functions
  let mockSetPendingSeatIndex: jest.Mock;
  let mockSetSeatModalVisible: jest.Mock;
  let mockSetModalType: jest.Mock;
  let mockTakeSeat: jest.Mock;
  let mockLeaveSeat: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetPendingSeatIndex = jest.fn();
    mockSetSeatModalVisible = jest.fn();
    mockSetModalType = jest.fn();
    mockTakeSeat = jest.fn();
    mockLeaveSeat = jest.fn();
  });

  const createHookParams = (overrides: Partial<Parameters<typeof useRoomSeatDialogs>[0]> = {}) => ({
    pendingSeat: null as number | null,
    setPendingSeat: mockSetPendingSeatIndex,
    setSeatModalVisible: mockSetSeatModalVisible,
    setModalType: mockSetModalType,
    takeSeat: mockTakeSeat,
    leaveSeat: mockLeaveSeat,
    roomStatus: GameStatus.unseated,
    navigation: mockNavigation,
    ...overrides,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // showEnterSeatDialog
  // ─────────────────────────────────────────────────────────────────────────

  describe('showEnterSeatDialog', () => {
    it('should set pendingSeat, modalType to enter, and show modal', () => {
      const { result } = renderHook(() => useRoomSeatDialogs(createHookParams()));

      act(() => {
        result.current.showEnterSeatDialog(3);
      });

      expect(mockSetPendingSeatIndex).toHaveBeenCalledWith(3);
      expect(mockSetModalType).toHaveBeenCalledWith('enter');
      expect(mockSetSeatModalVisible).toHaveBeenCalledWith(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // showLeaveSeatDialog
  // ─────────────────────────────────────────────────────────────────────────

  describe('showLeaveSeatDialog', () => {
    it('should set pendingSeat, modalType to leave, and show modal', () => {
      const { result } = renderHook(() => useRoomSeatDialogs(createHookParams()));

      act(() => {
        result.current.showLeaveSeatDialog(5);
      });

      expect(mockSetPendingSeatIndex).toHaveBeenCalledWith(5);
      expect(mockSetModalType).toHaveBeenCalledWith('leave');
      expect(mockSetSeatModalVisible).toHaveBeenCalledWith(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // handleConfirmSeat
  // ─────────────────────────────────────────────────────────────────────────

  describe('handleConfirmSeat', () => {
    it('should early return when pendingSeat is null', () => {
      const { result } = renderHook(() =>
        useRoomSeatDialogs(
          createHookParams({
            pendingSeat: null,
          }),
        ),
      );

      act(() => {
        result.current.handleConfirmSeat();
      });

      expect(mockTakeSeat).not.toHaveBeenCalled();
      expect(mockSetSeatModalVisible).not.toHaveBeenCalled();
    });

    it('should close modal immediately and call takeSeat (fire-and-forget)', async () => {
      mockTakeSeat.mockResolvedValue(true);

      const { result } = renderHook(() =>
        useRoomSeatDialogs(
          createHookParams({
            pendingSeat: 2,
          }),
        ),
      );

      // Confirm closes modal synchronously, API call is fire-and-forget
      act(() => {
        result.current.handleConfirmSeat();
      });

      // Modal closed and pendingSeat cleared immediately (before API resolves)
      expect(mockSetSeatModalVisible).toHaveBeenCalledWith(false);
      expect(mockSetPendingSeatIndex).toHaveBeenCalledWith(null);
      expect(mockTakeSeat).toHaveBeenCalledWith(2);

      // Flush the fire-and-forget promise
      await act(async () => {
        await mockTakeSeat.mock.results[0].value;
      });
      expect(mockShowAlert).not.toHaveBeenCalled();
    });

    it('should show alert when takeSeat fails (seat occupied)', async () => {
      mockTakeSeat.mockResolvedValue(false);

      const { result } = renderHook(() =>
        useRoomSeatDialogs(
          createHookParams({
            pendingSeat: 4,
          }),
        ),
      );

      act(() => {
        result.current.handleConfirmSeat();
      });

      // Modal closed immediately
      expect(mockSetSeatModalVisible).toHaveBeenCalledWith(false);
      expect(mockTakeSeat).toHaveBeenCalledWith(4);

      // Flush fire-and-forget — failure triggers showAlert
      await act(async () => {
        await mockTakeSeat.mock.results[0].value;
      });
      expect(mockShowAlert).toHaveBeenCalledWith('入座失败', '5号座位已被占用，请选择其他位置。');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // handleCancelSeat
  // ─────────────────────────────────────────────────────────────────────────

  describe('handleCancelSeat', () => {
    it('should close modal and reset pendingSeat', () => {
      const { result } = renderHook(() =>
        useRoomSeatDialogs(
          createHookParams({
            pendingSeat: 7,
          }),
        ),
      );

      act(() => {
        result.current.handleCancelSeat();
      });

      expect(mockSetSeatModalVisible).toHaveBeenCalledWith(false);
      expect(mockSetPendingSeatIndex).toHaveBeenCalledWith(null);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // handleConfirmLeave
  // ─────────────────────────────────────────────────────────────────────────

  describe('handleConfirmLeave', () => {
    it('should early return when pendingSeat is null', () => {
      const { result } = renderHook(() =>
        useRoomSeatDialogs(
          createHookParams({
            pendingSeat: null,
          }),
        ),
      );

      act(() => {
        result.current.handleConfirmLeave();
      });

      expect(mockLeaveSeat).not.toHaveBeenCalled();
      expect(mockSetSeatModalVisible).not.toHaveBeenCalled();
    });

    it('should close modal immediately and call leaveSeat (fire-and-forget)', async () => {
      mockLeaveSeat.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useRoomSeatDialogs(
          createHookParams({
            pendingSeat: 3,
          }),
        ),
      );

      act(() => {
        result.current.handleConfirmLeave();
      });

      // Modal closed immediately (before API resolves)
      expect(mockSetSeatModalVisible).toHaveBeenCalledWith(false);
      expect(mockSetPendingSeatIndex).toHaveBeenCalledWith(null);
      expect(mockLeaveSeat).toHaveBeenCalled();

      // Flush fire-and-forget promise
      await act(async () => {
        await mockLeaveSeat.mock.results[0].value;
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // handleLeaveRoom
  // ─────────────────────────────────────────────────────────────────────────

  describe('handleLeaveRoom', () => {
    it('should show confirm dialog when status is ongoing', () => {
      const { result } = renderHook(() =>
        useRoomSeatDialogs(
          createHookParams({
            roomStatus: GameStatus.ongoing,
          }),
        ),
      );

      act(() => {
        result.current.handleLeaveRoom();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockShowAlert).toHaveBeenCalledWith(
        '离开房间？',
        '',
        expect.arrayContaining([
          expect.objectContaining({ text: '确定' }),
          expect.objectContaining({ text: '取消', style: 'cancel' }),
        ]),
      );
    });

    it('should show confirm dialog when status is ended', () => {
      const { result } = renderHook(() =>
        useRoomSeatDialogs(
          createHookParams({
            roomStatus: GameStatus.ended,
          }),
        ),
      );

      act(() => {
        result.current.handleLeaveRoom();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockShowAlert).toHaveBeenCalledWith(
        '离开房间？',
        '',
        expect.arrayContaining([
          expect.objectContaining({ text: '确定' }),
          expect.objectContaining({ text: '取消', style: 'cancel' }),
        ]),
      );
    });

    it('should show confirm dialog when status is unseated', () => {
      const { result } = renderHook(() =>
        useRoomSeatDialogs(
          createHookParams({
            roomStatus: GameStatus.unseated,
          }),
        ),
      );

      act(() => {
        result.current.handleLeaveRoom();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockShowAlert).toHaveBeenCalledWith(
        '离开房间？',
        '',
        expect.arrayContaining([
          expect.objectContaining({ text: '确定' }),
          expect.objectContaining({ text: '取消', style: 'cancel' }),
        ]),
      );
    });

    it('should navigate to Home when confirm button is pressed in dialog', () => {
      const { result } = renderHook(() =>
        useRoomSeatDialogs(
          createHookParams({
            roomStatus: GameStatus.unseated,
          }),
        ),
      );

      act(() => {
        result.current.handleLeaveRoom();
      });

      // Get the buttons passed to showAlert
      const alertCall = mockShowAlert.mock.calls[0];
      const buttons = alertCall[2] as Array<{ text: string; onPress?: () => void }>;

      // Find and click the confirm button
      const confirmButton = buttons.find((b) => b.text === '确定');
      expect(confirmButton).toBeDefined();

      act(() => {
        confirmButton?.onPress?.();
      });

      expect(mockNavigate).toHaveBeenCalledWith('Home');
    });

    it('should show confirm dialog when status is seated', () => {
      const { result } = renderHook(() =>
        useRoomSeatDialogs(
          createHookParams({
            roomStatus: GameStatus.seated,
          }),
        ),
      );

      act(() => {
        result.current.handleLeaveRoom();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockShowAlert).toHaveBeenCalledWith(
        '离开房间？',
        '',
        expect.arrayContaining([
          expect.objectContaining({ text: '确定' }),
          expect.objectContaining({ text: '取消', style: 'cancel' }),
        ]),
      );
    });

    it('should call onLeaveRoom callback when confirm is pressed', () => {
      const mockOnLeaveRoom = jest.fn();
      const { result } = renderHook(() =>
        useRoomSeatDialogs(
          createHookParams({
            roomStatus: GameStatus.ongoing,
            onLeaveRoom: mockOnLeaveRoom,
          }),
        ),
      );

      act(() => {
        result.current.handleLeaveRoom();
      });

      // Get the buttons passed to showAlert
      const alertCall = mockShowAlert.mock.calls[0];
      const buttons = alertCall[2] as Array<{ text: string; onPress?: () => void }>;

      // Find and click the confirm button
      const confirmButton = buttons.find((b) => b.text === '确定');
      expect(confirmButton).toBeDefined();

      act(() => {
        confirmButton?.onPress?.();
      });

      expect(mockOnLeaveRoom).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('Home');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Double-click protection (submittingRef)
  // ─────────────────────────────────────────────────────────────────────────

  describe('double-click protection', () => {
    it('handleConfirmSeat should reject second call while first is in-flight', async () => {
      let resolveTakeSeat!: (v: boolean) => void;
      mockTakeSeat.mockImplementation(
        () => new Promise<boolean>((resolve) => (resolveTakeSeat = resolve)),
      );

      const { result, rerender } = renderHook(
        (props: Parameters<typeof useRoomSeatDialogs>[0]) => useRoomSeatDialogs(props),
        { initialProps: createHookParams({ pendingSeat: 2 }) },
      );

      // First call — fires takeSeat, closes modal immediately
      act(() => {
        result.current.handleConfirmSeat();
      });
      expect(mockTakeSeat).toHaveBeenCalledTimes(1);

      // Re-render with same pendingSeat (simulates React re-render)
      rerender(createHookParams({ pendingSeat: 2 }));

      // Second call while first in-flight — should be rejected by submittingRef guard
      act(() => {
        result.current.handleConfirmSeat();
      });
      expect(mockTakeSeat).toHaveBeenCalledTimes(1); // still 1

      // Resolve first
      await act(async () => {
        resolveTakeSeat(true);
        await mockTakeSeat.mock.results[0].value;
      });
    });

    it('handleConfirmLeave should reject second call while first is in-flight', async () => {
      let resolveLeaveSeat!: () => void;
      mockLeaveSeat.mockImplementation(
        () => new Promise<void>((resolve) => (resolveLeaveSeat = resolve)),
      );

      const { result, rerender } = renderHook(
        (props: Parameters<typeof useRoomSeatDialogs>[0]) => useRoomSeatDialogs(props),
        { initialProps: createHookParams({ pendingSeat: 3 }) },
      );

      // First call
      act(() => {
        result.current.handleConfirmLeave();
      });
      expect(mockLeaveSeat).toHaveBeenCalledTimes(1);

      // Re-render with same pendingSeat
      rerender(createHookParams({ pendingSeat: 3 }));

      // Second call rejected
      act(() => {
        result.current.handleConfirmLeave();
      });
      expect(mockLeaveSeat).toHaveBeenCalledTimes(1); // still 1

      // Resolve first
      await act(async () => {
        resolveLeaveSeat();
        await mockLeaveSeat.mock.results[0].value;
      });
    });
  });
});
