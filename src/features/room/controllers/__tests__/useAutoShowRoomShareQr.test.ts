import { renderHook } from '@testing-library/react-native';

import { useAutoShowRoomShareQr } from '../useAutoShowRoomShareQr';

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
