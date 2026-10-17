/**
 * AU-33: the avalon audio ack reuses one prepared envelope across
 * reconnect retries and never prepares a second command for the same
 * queue. When the queue is still in the authoritative state on
 * reconnect, the shared core replays it in full before resending the
 * retained ack (an interrupted narration is never acked away unheard).
 */
import { act, renderHook } from '@testing-library/react-native';

import type { AvalonRoomSession } from '../../../model/AvalonRoomSession';
import { useAvalonAudioOrchestration } from '../useAvalonAudioOrchestration';

type Listener = () => void;

function createFakeSession() {
  const listeners = new Set<Listener>();
  let connection: 'live' | 'reconnecting' = 'live';
  // The queue lives in the session's authoritative snapshot state, the
  // way the real session exposes it to the shared core. A committed ack
  // clears the queue there before the dispatch outcome returns (the
  // real session applies the post-command snapshot first).
  let pendingAudioEffects: readonly { audioKey: string }[] = [
    { audioKey: 'night' },
    { audioKey: 'evil_reveal' },
  ];
  let prepareCount = 0;
  const preparedObjects: unknown[] = [];
  const dispatchedPrepared: unknown[] = [];
  const dispatchPrepared = jest
    .fn(async (prepared: unknown) => {
      dispatchedPrepared.push(prepared);
      if (dispatchedPrepared.length === 1) {
        return { kind: 'notDecided', commandId: 'ack-1', reason: 'NETWORK_ERROR' };
      }
      pendingAudioEffects = [];
      return { kind: 'decided', decision: { kind: 'committed', outcome: { kind: 'success' } } };
    })
    .mockName('dispatchPrepared');
  const session = {
    getSnapshot: () => ({
      phase: 'ready',
      connection,
      pendingCommandCount: 0,
      snapshot: { state: { pendingAudioEffects } },
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

  it('replays the queue in full and retries the same prepared ack on reconnect', async () => {
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

    // Reconnect: the queue is still in the authoritative state, so it
    // replays in full before the SAME prepared envelope is retried.
    await act(async () => {
      fake.setConnection('reconnecting');
    });
    await act(async () => {
      fake.setConnection('live');
    });
    expect(fake.dispatchPrepared).toHaveBeenCalledTimes(2);
    expect(fake.dispatchedPrepared[1]).toBe(fake.preparedObjects[0]);
    expect(fake.getPrepareCount()).toBe(1);
    expect(audio.playEffect).toHaveBeenCalledTimes(4);

    // Once committed, further reconnects resend nothing.
    await act(async () => {
      fake.setConnection('reconnecting');
    });
    await act(async () => {
      fake.setConnection('live');
    });
    expect(fake.dispatchPrepared).toHaveBeenCalledTimes(2);
    expect(audio.playEffect).toHaveBeenCalledTimes(4);
  });
});
