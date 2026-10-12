/**
 * AU-33: the avalon audio ack reuses one prepared envelope and
 * retries it on reconnect - it never replays the queue and never
 * prepares a second command for the same queue.
 */
import { act, renderHook } from '@testing-library/react-native';

import type { AvalonRoomSession } from '../../../model/AvalonRoomSession';
import { useAvalonAudioOrchestration } from '../useAvalonAudioOrchestration';

type Listener = () => void;

function createFakeSession() {
  const listeners = new Set<Listener>();
  let connection: 'live' | 'reconnecting' = 'live';
  let prepareCount = 0;
  const preparedObjects: unknown[] = [];
  const dispatchedPrepared: unknown[] = [];
  const dispatchPrepared = jest
    .fn(async (prepared: unknown) => {
      dispatchedPrepared.push(prepared);
      return dispatchedPrepared.length === 1
        ? { kind: 'notDecided', commandId: 'ack-1', reason: 'NETWORK_ERROR' }
        : { kind: 'decided', decision: { kind: 'committed', outcome: { kind: 'success' } } };
    })
    .mockName('dispatchPrepared');
  const session = {
    getSnapshot: () => ({
      phase: 'ready',
      connection,
      pendingCommandCount: 0,
      snapshot: { state: {} },
    }),
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    prepare: jest.fn(() => {
      prepareCount += 1;
      const prepared = { commandId: `ack-${prepareCount}` };
      preparedObjects.push(prepared);
      return prepared;
    }),
    dispatchPrepared,
    dispatch: jest.fn(async () => {
      throw new Error('the orchestration must use dispatchPrepared for the ack');
    }),
  };
  return {
    session: session as unknown as AvalonRoomSession,
    dispatchPrepared,
    dispatchedPrepared,
    preparedObjects,
    getPrepareCount: () => prepareCount,
    setConnection: (next: 'live' | 'reconnecting') => {
      connection = next;
      for (const listener of listeners) listener();
    },
  };
}

const audio = {
  preload: jest.fn(async () => undefined),
  playEffect: jest.fn(async () => undefined),
  stopNarration: jest.fn(),
};

describe('useAvalonAudioOrchestration ack reliability (AU-33)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retries the same prepared ack on reconnect without replaying', async () => {
    const fake = createFakeSession();
    renderHook(() =>
      useAvalonAudioOrchestration({
        session: fake.session,
        isHost: true,
        pendingAudioEffects: [{ audioKey: 'night' }, { audioKey: 'evil_reveal' }],
        audio,
      }),
    );

    // Queue plays once; the first ack attempt lands undecided.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(audio.playEffect).toHaveBeenCalledTimes(2);
    expect(fake.dispatchPrepared).toHaveBeenCalledTimes(1);
    expect(fake.getPrepareCount()).toBe(1);

    // Reconnect: the SAME prepared envelope is retried, no replay.
    await act(async () => {
      fake.setConnection('reconnecting');
    });
    await act(async () => {
      fake.setConnection('live');
    });
    expect(fake.dispatchPrepared).toHaveBeenCalledTimes(2);
    expect(fake.dispatchedPrepared[1]).toBe(fake.preparedObjects[0]);
    expect(fake.getPrepareCount()).toBe(1);
    expect(audio.playEffect).toHaveBeenCalledTimes(2);

    // Once committed, further reconnects resend nothing.
    await act(async () => {
      fake.setConnection('reconnecting');
    });
    await act(async () => {
      fake.setConnection('live');
    });
    expect(fake.dispatchPrepared).toHaveBeenCalledTimes(2);
  });
});
