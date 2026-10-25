/** Auto-share lifecycle and its integration with the real room share controller. */

import { act, renderHook } from '@testing-library/react-native';

import { useAutoShowRoomShareQr } from '../useAutoShowRoomShareQr';
import { useRoomPresentationController } from '../useRoomPresentationController';

jest.mock('@/features/gacha/queries/useGachaQuery', () => ({
  useGachaStatusQuery: () => ({ data: undefined }),
}));

jest.mock('../useRoomTitleActions', () => ({
  useRoomTitleActions: () => ({ handleTitlePress: jest.fn(), handleTitleLongPress: jest.fn() }),
}));

describe('useAutoShowRoomShareQr', () => {
  it('opens the share sheet once for a host who created the room', () => {
    const openShare = jest.fn();
    const { rerender } = renderHook(
      (props: { isHost: boolean }) =>
        useAutoShowRoomShareQr({ isHost: props.isHost, entryReason: 'created', openShare }),
      { initialProps: { isHost: true } },
    );
    expect(openShare).toHaveBeenCalledTimes(1);
    rerender({ isHost: true });
    rerender({ isHost: false });
    rerender({ isHost: true });
    expect(openShare).toHaveBeenCalledTimes(1);
  });

  it('never opens for non-hosts or non-created entries', () => {
    const openShare = jest.fn();
    renderHook(() => useAutoShowRoomShareQr({ isHost: false, entryReason: 'created', openShare }));
    renderHook(() => useAutoShowRoomShareQr({ isHost: true, entryReason: null, openShare }));
    expect(openShare).not.toHaveBeenCalled();
  });

  it('opens when the viewer becomes host after creation entry', () => {
    const openShare = jest.fn();
    const { rerender } = renderHook(
      (props: { isHost: boolean }) =>
        useAutoShowRoomShareQr({ isHost: props.isHost, entryReason: 'created', openShare }),
      { initialProps: { isHost: false } },
    );
    expect(openShare).not.toHaveBeenCalled();
    rerender({ isHost: true });
    expect(openShare).toHaveBeenCalledTimes(1);
  });
});

describe('useRoomPresentationController', () => {
  it('auto-opens the real share controller only once and preserves manual dismissal', () => {
    const { result, rerender } = renderHook(
      ({ isHost }: { isHost: boolean }) =>
        useRoomPresentationController({
          roomCode: '2345',
          gameDisplayName: 'Demo',
          isHost,
          entryReason: 'created',
        }),
      { initialProps: { isHost: false } },
    );
    expect(result.current.share.isVisible).toBe(false);
    expect(result.current.share.roomCode).toBe('2345');

    rerender({ isHost: true });
    expect(result.current.share.isVisible).toBe(true);
    act(() => result.current.share.close());
    expect(result.current.share.isVisible).toBe(false);

    rerender({ isHost: false });
    rerender({ isHost: true });
    expect(result.current.share.isVisible).toBe(false);
    act(() => result.current.share.open());
    expect(result.current.share.isVisible).toBe(true);
  });
});
