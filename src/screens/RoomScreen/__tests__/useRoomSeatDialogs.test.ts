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
import { act,renderHook } from '@testing-library/react-native';

import { GameStatus } from '@/models/GameStatus';
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
    pendingSeatIndex: null as number | null,
    setPendingSeatIndex: mockSetPendingSeatIndex,
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
    it('should set pendingSeatIndex, modalType to enter, and show modal', () => {
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
    it('should set pendingSeatIndex, modalType to leave, and show modal', () => {
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
    it('should early return when pendingSeatIndex is null', async () => {
      const { result } = renderHook(() =>
        useRoomSeatDialogs(
          createHookParams({
            pendingSeatIndex: null,
          }),
        ),
      );

      await act(async () => {
        await result.current.handleConfirmSeat();
      });

      expect(mockTakeSeat).not.toHaveBeenCalled();
      expect(mockSetSeatModalVisible).not.toHaveBeenCalled();
    });

    it('should call takeSeat with correct index on success', async () => {
      mockTakeSeat.mockResolvedValue(true);

      const { result } = renderHook(() =>
        useRoomSeatDialogs(
          createHookParams({
            pendingSeatIndex: 2,
          }),
        ),
      );

      await act(async () => {
        await result.current.handleConfirmSeat();
      });

      expect(mockTakeSeat).toHaveBeenCalledWith(2);
      expect(mockSetSeatModalVisible).toHaveBeenCalledWith(false);
      expect(mockShowAlert).not.toHaveBeenCalled();
      expect(mockSetPendingSeatIndex).toHaveBeenCalledWith(null);
    });

    it('should show alert when takeSeat fails', async () => {
      mockTakeSeat.mockResolvedValue(false);

      const { result } = renderHook(() =>
        useRoomSeatDialogs(
          createHookParams({
            pendingSeatIndex: 4,
          }),
        ),
      );

      await act(async () => {
        await result.current.handleConfirmSeat();
      });

      expect(mockTakeSeat).toHaveBeenCalledWith(4);
      expect(mockSetSeatModalVisible).toHaveBeenCalledWith(false);
      expect(mockShowAlert).toHaveBeenCalledWith('入座失败', '5号座位已被占用，请选择其他位置。');
      expect(mockSetPendingSeatIndex).toHaveBeenCalledWith(null);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // handleCancelSeat
  // ─────────────────────────────────────────────────────────────────────────

  describe('handleCancelSeat', () => {
    it('should close modal and reset pendingSeatIndex', () => {
      const { result } = renderHook(() =>
        useRoomSeatDialogs(
          createHookParams({
            pendingSeatIndex: 7,
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
    it('should early return when pendingSeatIndex is null', async () => {
      const { result } = renderHook(() =>
        useRoomSeatDialogs(
          createHookParams({
            pendingSeatIndex: null,
          }),
        ),
      );

      await act(async () => {
        await result.current.handleConfirmLeave();
      });

      expect(mockLeaveSeat).not.toHaveBeenCalled();
      expect(mockSetSeatModalVisible).not.toHaveBeenCalled();
    });

    it('should call leaveSeat and close modal when pendingSeatIndex is set', async () => {
      mockLeaveSeat.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useRoomSeatDialogs(
          createHookParams({
            pendingSeatIndex: 3,
          }),
        ),
      );

      await act(async () => {
        await result.current.handleConfirmLeave();
      });

      expect(mockLeaveSeat).toHaveBeenCalled();
      expect(mockSetSeatModalVisible).toHaveBeenCalledWith(false);
      expect(mockSetPendingSeatIndex).toHaveBeenCalledWith(null);
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
});
