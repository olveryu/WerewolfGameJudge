/**
 * useLastActionToast: one toast per revision marker for non-hosts; the
 * shared seat commands toast only when the viewer lost the seat; game
 * commands come from the injected table; the marker present at mount is
 * not replayed.
 */
import { renderHook } from '@testing-library/react';
import { toast } from 'sonner';

import { useLastActionToast } from '../useLastActionToast';

vi.mock('sonner', () => ({ toast: { info: vi.fn(), warning: vi.fn() } }));

const messages = {
  'demo.roles.assign': { level: 'info', text: '角色已分配' },
} as const;

interface Props {
  lastCommand: { revision: number; type: string } | null;
  isHost: boolean;
  mySeat: number | null;
}

function renderToast(initial: Props) {
  return renderHook((props: Props) => useLastActionToast({ ...props, messages }), {
    initialProps: initial,
  });
}

beforeEach(() => vi.clearAllMocks());

describe('useLastActionToast', () => {
  it('shows a game command toast once per revision to a non-host', () => {
    const { rerender } = renderToast({ lastCommand: null, isHost: false, mySeat: 1 });
    rerender({ lastCommand: { revision: 3, type: 'demo.roles.assign' }, isHost: false, mySeat: 1 });
    rerender({ lastCommand: { revision: 3, type: 'demo.roles.assign' }, isHost: false, mySeat: 1 });
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith('角色已分配');
  });

  it('shows nothing to the host or for unlisted commands', () => {
    const host = renderToast({ lastCommand: null, isHost: true, mySeat: 0 });
    host.rerender({
      lastCommand: { revision: 1, type: 'demo.roles.assign' },
      isHost: true,
      mySeat: 0,
    });
    const player = renderToast({ lastCommand: null, isHost: false, mySeat: 1 });
    player.rerender({ lastCommand: { revision: 2, type: 'demo.other' }, isHost: false, mySeat: 1 });
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('warns the kicked viewer with its former seat, and only the kicked viewer', () => {
    const { rerender } = renderToast({ lastCommand: null, isHost: false, mySeat: 4 });
    rerender({ lastCommand: { revision: 5, type: 'room.seat.kick' }, isHost: false, mySeat: null });
    expect(toast.warning).toHaveBeenCalledWith('你已被移出 5 号座位');

    const other = renderToast({ lastCommand: null, isHost: false, mySeat: 2 });
    other.rerender({
      lastCommand: { revision: 6, type: 'room.seat.kick' },
      isHost: false,
      mySeat: 2,
    });
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it('warns seated viewers when the host clears all seats', () => {
    const { rerender } = renderToast({ lastCommand: null, isHost: false, mySeat: 1 });
    rerender({
      lastCommand: { revision: 7, type: 'room.seat.clear' },
      isHost: false,
      mySeat: null,
    });
    expect(toast.warning).toHaveBeenCalledWith('房主已清空所有座位');
  });

  it('does not replay the marker present when the room page mounts', () => {
    const { rerender } = renderToast({
      lastCommand: { revision: 8, type: 'demo.roles.assign' },
      isHost: false,
      mySeat: 1,
    });
    expect(toast.info).not.toHaveBeenCalled();
    rerender({ lastCommand: { revision: 9, type: 'demo.roles.assign' }, isHost: false, mySeat: 1 });
    expect(toast.info).toHaveBeenCalledTimes(1);
  });
});
