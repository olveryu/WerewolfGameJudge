/**
 * useLastActionToast: one toast per revision marker for non-hosts; the
 * shared seat commands toast only when the viewer lost the seat; game
 * commands come from the injected table.
 */
import { renderHook } from '@testing-library/react-native';
import { toast } from 'sonner-native';

import { type LastActionToastMessage, useLastActionToast } from '../useLastActionToast';

jest.mock('sonner-native', () => ({ toast: { info: jest.fn(), warning: jest.fn() } }));

const messages: Readonly<Record<string, LastActionToastMessage>> = {
  'demo.roles.assign': { level: 'info', text: '角色已分配' },
};

interface Props {
  lastCommand: { revision: number; type: string } | null;
  isHost: boolean;
  mySeat: number | null;
  isFocused: boolean;
}

function renderToast(initial: Props) {
  return renderHook((props: Props) => useLastActionToast({ ...props, messages }), {
    initialProps: initial,
  });
}

beforeEach(() => jest.clearAllMocks());

describe('useLastActionToast', () => {
  it('shows a game command toast once per revision to a non-host', () => {
    const { rerender } = renderToast({
      lastCommand: { revision: 3, type: 'demo.roles.assign' },
      isHost: false,
      mySeat: 1,
      isFocused: true,
    });
    rerender({
      lastCommand: { revision: 3, type: 'demo.roles.assign' },
      isHost: false,
      mySeat: 1,
      isFocused: true,
    });
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith('角色已分配');
  });

  it('shows nothing to the host or for unlisted commands', () => {
    renderToast({
      lastCommand: { revision: 1, type: 'demo.roles.assign' },
      isHost: true,
      mySeat: 0,
      isFocused: true,
    });
    renderToast({
      lastCommand: { revision: 2, type: 'demo.other' },
      isHost: false,
      mySeat: 1,
      isFocused: true,
    });
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('warns the kicked viewer with its former seat, and only the kicked viewer', () => {
    const { rerender } = renderToast({
      lastCommand: null,
      isHost: false,
      mySeat: 4,
      isFocused: true,
    });
    rerender({
      lastCommand: { revision: 5, type: 'room.seat.kick' },
      isHost: false,
      mySeat: null,
      isFocused: true,
    });
    expect(toast.warning).toHaveBeenCalledWith('你已被移出 5 号座位');

    const other = renderToast({ lastCommand: null, isHost: false, mySeat: 2, isFocused: true });
    other.rerender({
      lastCommand: { revision: 6, type: 'room.seat.kick' },
      isHost: false,
      mySeat: 2,
      isFocused: true,
    });
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it('warns seated viewers when the host clears all seats', () => {
    const { rerender } = renderToast({
      lastCommand: null,
      isHost: false,
      mySeat: 1,
      isFocused: true,
    });
    rerender({
      lastCommand: { revision: 7, type: 'room.seat.clear' },
      isHost: false,
      mySeat: null,
      isFocused: true,
    });
    expect(toast.warning).toHaveBeenCalledWith('房主已清空所有座位');
  });

  it('defers the marker while unfocused and consumes it on return', () => {
    const { rerender } = renderToast({
      lastCommand: { revision: 8, type: 'demo.roles.assign' },
      isHost: false,
      mySeat: 1,
      isFocused: false,
    });
    expect(toast.info).not.toHaveBeenCalled();
    rerender({
      lastCommand: { revision: 8, type: 'demo.roles.assign' },
      isHost: false,
      mySeat: 1,
      isFocused: true,
    });
    expect(toast.info).toHaveBeenCalledTimes(1);
  });
});
