import { renderHook } from '@testing-library/react';

import {
  type BotTakeoverGuardOptions,
  useBotTakeoverGuard,
} from '@/features/room/controllers/useBotTakeoverGuard';

describe('useBotTakeoverGuard', () => {
  it('does not release while control is legitimate', () => {
    const release = vi.fn();
    renderHook(() =>
      useBotTakeoverGuard({ controlledSeat: 2, canControlBots: true, seatStillBot: true, release }),
    );
    expect(release).not.toHaveBeenCalled();
  });

  it('does not release when no seat is controlled, even if conditions are invalid', () => {
    const release = vi.fn();
    renderHook(() =>
      useBotTakeoverGuard({
        controlledSeat: null,
        canControlBots: false,
        seatStillBot: false,
        release,
      }),
    );
    expect(release).not.toHaveBeenCalled();
  });

  it('releases when the keep condition is revoked (host or phase)', () => {
    const release = vi.fn();
    renderHook(() =>
      useBotTakeoverGuard({
        controlledSeat: 2,
        canControlBots: false,
        seatStillBot: true,
        release,
      }),
    );
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('releases when the controlled seat is no longer a bot seat', () => {
    const release = vi.fn();
    renderHook(() =>
      useBotTakeoverGuard({
        controlledSeat: 2,
        canControlBots: true,
        seatStillBot: false,
        release,
      }),
    );
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('releases on the rerender that invalidates control, not before', () => {
    const release = vi.fn();
    const initialProps: BotTakeoverGuardOptions = {
      controlledSeat: 2,
      canControlBots: true,
      seatStillBot: true,
      release,
    };
    const { rerender } = renderHook(
      (props: BotTakeoverGuardOptions) => useBotTakeoverGuard(props),
      {
        initialProps,
      },
    );
    expect(release).not.toHaveBeenCalled();
    rerender({ ...initialProps, canControlBots: false });
    expect(release).toHaveBeenCalledTimes(1);
  });
});
