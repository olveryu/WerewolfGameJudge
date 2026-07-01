import { act, renderHook } from '@testing-library/react-native';

import { type RoomSeatOperation, useRoomSeatOperations } from '../useRoomSeatOperations';

describe('useRoomSeatOperations', () => {
  it('opens an operation and clears it after a successful confirm', async () => {
    const runOperation = jest.fn<Promise<boolean>, [RoomSeatOperation]>().mockResolvedValue(true);
    const { result } = renderHook(() => useRoomSeatOperations({ runOperation }));

    act(() => {
      result.current.openOperation({ kind: 'move', seat: 3 });
    });

    expect(result.current.operation).toEqual({ kind: 'move', seat: 3 });

    await act(async () => {
      await result.current.confirmOperation();
    });

    expect(runOperation).toHaveBeenCalledWith({ kind: 'move', seat: 3 });
    expect(result.current.operation).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
  });

  it('keeps the operation open when execution returns false', async () => {
    const runOperation = jest.fn<Promise<boolean>, [RoomSeatOperation]>().mockResolvedValue(false);
    const { result } = renderHook(() => useRoomSeatOperations({ runOperation }));

    act(() => {
      result.current.openOperation({ kind: 'kick', seat: 5 });
    });

    await act(async () => {
      await result.current.confirmOperation();
    });

    expect(result.current.operation).toEqual({ kind: 'kick', seat: 5 });
    expect(result.current.isSubmitting).toBe(false);
  });

  it('fails fast when confirm is called without a pending operation', async () => {
    const runOperation = jest.fn<Promise<boolean>, [RoomSeatOperation]>().mockResolvedValue(true);
    const { result } = renderHook(() => useRoomSeatOperations({ runOperation }));

    await expect(result.current.confirmOperation()).rejects.toThrow(
      'useRoomSeatOperations.confirmOperation: no pending operation',
    );
    expect(runOperation).not.toHaveBeenCalled();
  });
});
