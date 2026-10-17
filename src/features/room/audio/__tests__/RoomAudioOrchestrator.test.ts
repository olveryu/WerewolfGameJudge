/**
 * RoomAudioOrchestrator — ack 后 recheck 链式续播.
 *
 * A successful ack can progress the game into the next queued batch
 * inside the same playback window. That batch's snapshot emission is
 * skipped (the playback re-entry guard is still up) and no later
 * emission is guaranteed, so the core re-reads the queue source once
 * after the ack and chain-plays whatever it finds there.
 *
 * The fake source below reproduces exactly that race: the first ack's
 * dispatch swaps the authoritative snapshot to the second queue
 * synchronously (the way the real session applies the committed
 * snapshot before returning the outcome) and never emits again. Only
 * the post-ack recheck can observe the second queue.
 */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import { successfulRoomCommand, testRoomState } from '@/test-utils/roomCommand';

import {
  RoomAudioOrchestrator,
  type RoomAudioQueueSnapshot,
  type RoomAudioQueueSource,
} from '../RoomAudioOrchestrator';

type TestEffect = { readonly audioKey: string };
type TestPrepared = { readonly commandId: string };
type TestState = BaseGameState<'test'>;
type Snapshot = RoomAudioQueueSnapshot<TestEffect>;

const firstQueue: readonly TestEffect[] = [{ audioKey: 'night' }, { audioKey: 'evil_reveal' }];
const secondQueue: readonly TestEffect[] = [{ audioKey: 'merlin_reveal' }];

async function flushPlayback(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function createHarness() {
  let snapshot: Snapshot | null = null;
  let listener: ((next: Snapshot | null) => void) | null = null;
  let emissionCount = 0;
  const playedKeys: string[] = [];
  const preparedBatches: (readonly TestEffect[])[] = [];
  const preparedCommands: TestPrepared[] = [];
  const dispatchedCommands: TestPrepared[] = [];

  const setQueue = (effects: readonly TestEffect[]) => {
    snapshot = { pendingAudioEffects: effects, connection: 'live' };
  };

  const queueSource: RoomAudioQueueSource<TestEffect> = {
    getSnapshot: () => snapshot,
    subscribe: (next) => {
      listener = next;
      return () => {
        listener = null;
      };
    },
  };

  const orchestrator = new RoomAudioOrchestrator<TestEffect, TestPrepared, TestState>({
    queueSource,
    player: {
      playEffect: async (effect) => {
        playedKeys.push(effect.audioKey);
      },
      prepareQueue: async (effects) => {
        preparedBatches.push(effects);
      },
    },
    ack: {
      prepare: () => {
        const prepared: TestPrepared = { commandId: `ack-${preparedCommands.length + 1}` };
        preparedCommands.push(prepared);
        return prepared;
      },
      dispatch: async (prepared) => {
        dispatchedCommands.push(prepared);
        // The committed ack applies the progressed snapshot before the
        // outcome returns: ack 1 leaves the second queue in place, ack 2
        // leaves the queue drained. Neither swap emits a snapshot.
        setQueue(dispatchedCommands.length === 1 ? secondQueue : []);
        return successfulRoomCommand(testRoomState('test'), prepared.commandId);
      },
    },
    isHost: () => true,
    isAborted: () => false,
    logger: { info: jest.fn(), warn: jest.fn() },
  });

  const emitCurrent = () => {
    emissionCount += 1;
    listener?.(snapshot);
  };

  return {
    orchestrator,
    setQueue,
    emitCurrent,
    getEmissionCount: () => emissionCount,
    playedKeys,
    preparedBatches,
    preparedCommands,
    dispatchedCommands,
  };
}

describe('RoomAudioOrchestrator ack recheck chaining', () => {
  it('chain-plays and acks a queue that lands inside the playback window without any later emission', async () => {
    const harness = createHarness();
    harness.setQueue(firstQueue);

    // The one and only snapshot emission: it starts the first batch.
    harness.emitCurrent();
    await flushPlayback();

    // First batch played, then the recheck found the second queue and
    // chain-played it — no second emission ever arrived.
    expect(harness.getEmissionCount()).toBe(1);
    expect(harness.playedKeys).toEqual(['night', 'evil_reveal', 'merlin_reveal']);
    expect(harness.preparedBatches).toEqual([firstQueue, secondQueue]);

    // Each batch was released by its own prepared ack envelope.
    expect(harness.preparedCommands.map((prepared) => prepared.commandId)).toEqual([
      'ack-1',
      'ack-2',
    ]);
    expect(harness.dispatchedCommands).toEqual(harness.preparedCommands);

    harness.orchestrator.dispose();
  });
});
