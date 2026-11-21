import { act, renderHook } from '@testing-library/react';

import { dismissAlert } from '@/utils/alert';

import { useScopedAlert } from '../useScopedAlert';

vi.mock('@/utils/alert', () => ({ dismissAlert: vi.fn() }));

describe('useScopedAlert', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dismisses the tracked alert when its owning identity changes', () => {
    const { result, rerender } = renderHook(({ identity }) => useScopedAlert(identity), {
      initialProps: { identity: 'night:1' },
    });

    act(() => result.current(7));
    rerender({ identity: 'night:2' });

    expect(dismissAlert).toHaveBeenCalledWith(7);
  });

  it('only dismisses the most recently tracked alert', () => {
    const { result, rerender } = renderHook(({ identity }) => useScopedAlert(identity), {
      initialProps: { identity: 'night:1' },
    });

    act(() => {
      result.current(7);
      result.current(8);
    });
    rerender({ identity: 'night:2' });

    expect(dismissAlert).toHaveBeenCalledTimes(1);
    expect(dismissAlert).toHaveBeenCalledWith(8);
  });
});
