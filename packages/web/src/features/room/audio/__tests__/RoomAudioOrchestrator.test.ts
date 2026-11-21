/**
 * RoomAudioOrchestrator — batch-id acks and ack-recheck chaining.
 *
 * Every queued batch carries an `audioBatchId`; the ack names the batch it
 * played so a replayed ack can never clear a later batch. After a successful
 * ack the core re-reads the queue source once: a strictly newer batch id is
 * chain-played (its snapshot emission was skipped by the re-entry guard and no
 * later emission is guaranteed); the same id means the broadcast has not
 * arrived yet, so the loop stops without acking that batch a second time.
 *
 * The fake source below reproduces the chaining race: the ack's dispatch swaps
 * the authoritative snapshot synchronously (the way the real session applies
 * the committed snapshot before returning the outcome) and never emits again.
 */

import { NIGHT_END_AUDIO_KEY } from '@game-judge/game-engine/platform/audio';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import {
  rejectedRoomCommand,
  successfulRoomCommand,
  testRoomState,
} from '@/test-utils/roomCommand';

import {
  RoomAudioOrchestrator,
  type RoomAudioPlayerPort,
  type RoomAudioQueueSnapshot,
  type RoomAudioQueueSource,
} from '../RoomAudioOrchestrator';

type TestEffect = { readonly audioKey: string };
type TestState = BaseGameState<'test'>;
type Snapshot = RoomAudioQueueSnapshot<TestEffect>;

const firstQueue: readonly TestEffect[] = [{ audioKey: 'night' }, { audioKey: 'evil_reveal' }];
const secondQueue: readonly TestEffect[] = [{ audioKey: 'merlin_reveal' }];

async function flushPlayback(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** What the fake server leaves in the authoritative snapshot once an ack commits. */
type AckPlan = (ackedBatchId: number) => Snapshot;

function createHarness(
  onAck: AckPlan,
  playerOverrides: Partial<RoomAudioPlayerPort<TestEffect>> = {},
) {
  let snapshot: Snapshot | null = null;
  let listener: ((next: Snapshot | null) => void) | null = null;
  let emissionCount = 0;
  const playedKeys: string[] = [];
  const timeline: string[] = [];
  const preparedBatches: (readonly TestEffect[])[] = [];
  const ackedBatchIds: number[] = [];
  const onError = vi.fn();
  const onResumeRequiredChange = vi.fn();
  const logger = { info: vi.fn(), warn: vi.fn() };
  let isHost = true;

  const setQueue = (
    effects: readonly TestEffect[],
    audioBatchId: number,
    isAudioPlaying = effects.length > 0,
  ) => {
    snapshot = { pendingAudioEffects: effects, audioBatchId, isAudioPlaying };
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

  const dispatch = vi.fn(async (audioBatchId: number) => {
    ackedBatchIds.push(audioBatchId);
    snapshot = onAck(audioBatchId);
    return successfulRoomCommand(testRoomState('test'), `ack-${ackedBatchIds.length}`);
  });
  const orchestrator = new RoomAudioOrchestrator<TestEffect, TestState>({
    queueSource,
    player: {
      playEffect: async (effect) => {
        playedKeys.push(effect.audioKey);
        timeline.push(`play:${effect.audioKey}`);
      },
      stopBgm: () => {
        timeline.push('stopBgm');
      },
      prepareQueue: async (effects) => {
        preparedBatches.push(effects);
      },
      ...playerOverrides,
    },
    ack: { dispatch },
    isHost: () => isHost,
    roomCode: 'test-room',
    logger,
    onError,
    onResumeRequiredChange,
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
    timeline,
    preparedBatches,
    ackedBatchIds,
    dispatch,
    logger,
    onError,
    onResumeRequiredChange,
    setIsHost: (value: boolean) => {
      isHost = value;
    },
  };
}

/** Ack of batch 1 progresses the game into batch 2 (second queue); any later ack drains. */
const progressIntoSecondQueue: AckPlan = (ackedBatchId) =>
  ackedBatchId === 1
    ? { pendingAudioEffects: secondQueue, audioBatchId: 2, isAudioPlaying: true }
    : { pendingAudioEffects: [], audioBatchId: ackedBatchId, isAudioPlaying: false };

/** Ack clears the batch it names and nothing follows. */
const drainAckedBatch: AckPlan = (ackedBatchId) => ({
  pendingAudioEffects: [],
  audioBatchId: ackedBatchId,
  isAudioPlaying: false,
});

describe('RoomAudioOrchestrator batch-id acks', () => {
  it('does not acknowledge until required batch preparation succeeds', async () => {
    const prepareQueue = vi
      .fn<NonNullable<RoomAudioPlayerPort<TestEffect>['prepareQueue']>>()
      .mockRejectedValueOnce(new Error('Voice initialization failed'))
      .mockResolvedValue(undefined);
    const harness = createHarness(drainAckedBatch, {
      prepareQueue,
    });
    harness.setQueue(firstQueue, 7);
    harness.emitCurrent();
    await flushPlayback();
    expect(harness.ackedBatchIds).toEqual([]);
    expect(harness.orchestrator.needsResume).toBe(true);
    harness.emitCurrent();
    await flushPlayback();
    expect(prepareQueue).toHaveBeenCalledOnce();
    await harness.orchestrator.resumeInterrupted();
    expect(harness.ackedBatchIds).toEqual([7]);
    harness.orchestrator.dispose();
  });

  it('does not acknowledge failed required electronic narration and retries the retained batch', async () => {
    const playEffect = vi
      .fn<RoomAudioPlayerPort<TestEffect>['playEffect']>()
      .mockRejectedValueOnce(new Error('Audio permission denied'))
      .mockResolvedValue(undefined);
    const harness = createHarness(drainAckedBatch, { playEffect });
    harness.setQueue(firstQueue, 7);
    harness.emitCurrent();
    await flushPlayback();
    expect(harness.ackedBatchIds).toEqual([]);
    expect(harness.orchestrator.needsResume).toBe(true);
    harness.emitCurrent();
    await flushPlayback();
    expect(playEffect).toHaveBeenCalledOnce();
    await harness.orchestrator.resumeInterrupted();
    expect(harness.ackedBatchIds).toEqual([7]);
    harness.orchestrator.dispose();
  });

  it('reports playback failures with the room, batch and cue instead of skipping and acknowledging', async () => {
    const error = new Error('Playback failed');
    const harness = createHarness(drainAckedBatch, {
      playEffect: vi.fn().mockRejectedValue(error),
    });
    harness.setQueue(firstQueue, 7);
    harness.emitCurrent();
    await flushPlayback();
    expect(harness.ackedBatchIds).toEqual([]);
    expect(harness.onError).toHaveBeenCalledWith(error, '语音播报');
    expect(harness.logger.warn).toHaveBeenCalledWith(
      'Narration failed; batch remains unacknowledged',
      { roomCode: 'test-room', audioBatchId: 7, audioKey: 'night', error },
    );
    harness.orchestrator.dispose();
  });

  it('acks the batch it played with that batch id', async () => {
    const harness = createHarness(drainAckedBatch);
    harness.setQueue(firstQueue, 7);

    harness.emitCurrent();
    await flushPlayback();

    expect(harness.playedKeys).toEqual(['night', 'evil_reveal']);
    expect(harness.ackedBatchIds).toEqual([7]);

    harness.orchestrator.dispose();
  });

  it('chain-plays a strictly newer batch found after the ack and acks it by its own id', async () => {
    const harness = createHarness(progressIntoSecondQueue);
    harness.setQueue(firstQueue, 1);

    // The one and only snapshot emission: it starts the first batch.
    harness.emitCurrent();
    await flushPlayback();

    // First batch played, then the recheck found batch 2 and chain-played
    // it — no second emission ever arrived.
    expect(harness.getEmissionCount()).toBe(1);
    expect(harness.playedKeys).toEqual(['night', 'evil_reveal', 'merlin_reveal']);
    expect(harness.preparedBatches).toEqual([firstQueue, secondQueue]);
    expect(harness.ackedBatchIds).toEqual([1, 2]);

    harness.orchestrator.dispose();
  });

  it('stops without a second ack when the source still holds the acked batch', async () => {
    // The ack committed server-side but the cleared broadcast has not
    // arrived: the source still shows batch 1 with its effects pending.
    const harness = createHarness(() => ({
      pendingAudioEffects: firstQueue,
      audioBatchId: 1,
      isAudioPlaying: true,
    }));
    harness.setQueue(firstQueue, 1);

    harness.emitCurrent();
    await flushPlayback();
    harness.emitCurrent();
    await flushPlayback();

    expect(harness.playedKeys).toEqual(['night', 'evil_reveal']);
    expect(harness.ackedBatchIds).toEqual([1]);

    harness.orchestrator.dispose();
  });

  it('retries a rejected acknowledgement without replaying the completed batch', async () => {
    const harness = createHarness(drainAckedBatch);
    harness.dispatch.mockResolvedValueOnce(rejectedRoomCommand<TestState>('ack_rejected'));
    harness.setQueue(firstQueue, 5);
    harness.emitCurrent();
    await flushPlayback();
    expect(harness.onError).toHaveBeenCalledOnce();
    expect(harness.orchestrator.needsResume).toBe(true);
    await harness.orchestrator.resumeInterrupted();
    expect(harness.ackedBatchIds).toEqual([5]);
    expect(harness.dispatch).toHaveBeenCalledTimes(2);
    expect(harness.playedKeys).toEqual(['night', 'evil_reveal']);
    harness.orchestrator.dispose();
  });

  it('does not reuse completion from a previous game after the queue resets', async () => {
    const harness = createHarness(drainAckedBatch);
    harness.setQueue(firstQueue, 1);
    harness.emitCurrent();
    await flushPlayback();
    harness.setQueue([], 0);
    harness.emitCurrent();
    harness.setQueue(firstQueue, 1);
    harness.emitCurrent();
    await flushPlayback();
    expect(harness.playedKeys).toEqual(['night', 'evil_reveal', 'night', 'evil_reveal']);
    expect(harness.ackedBatchIds).toEqual([1, 1]);
    harness.orchestrator.dispose();
  });

  it('does not leave a recovery mark after an interrupted batch has been cleared', async () => {
    const playEffect = vi.fn<RoomAudioPlayerPort<TestEffect>['playEffect']>(async () => {
      harness.setQueue([], 0);
      harness.emitCurrent();
      throw new DOMException('game reset', 'AbortError');
    });
    const harness = createHarness(drainAckedBatch, { playEffect });
    harness.setQueue(firstQueue, 1);
    harness.emitCurrent();
    await flushPlayback();
    expect(harness.orchestrator.needsResume).toBe(false);
    expect(harness.ackedBatchIds).toEqual([]);
    harness.orchestrator.dispose();
  });

  it('retries the full batch after a middle cue fails, without playing the remaining cues early', async () => {
    const playEffect = vi
      .fn<RoomAudioPlayerPort<TestEffect>['playEffect']>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('missing clip'))
      .mockResolvedValue(undefined);
    const harness = createHarness(drainAckedBatch, { playEffect });
    harness.setQueue([...firstQueue, { audioKey: 'night_end' }], 7);
    harness.emitCurrent();
    await flushPlayback();
    expect(playEffect.mock.calls.map(([effect]) => effect.audioKey)).toEqual([
      'night',
      'evil_reveal',
    ]);
    expect(harness.ackedBatchIds).toEqual([]);
    await harness.orchestrator.resumeInterrupted();
    expect(playEffect.mock.calls.map(([effect]) => effect.audioKey)).toEqual([
      'night',
      'evil_reveal',
      'night',
      'evil_reveal',
      'night_end',
    ]);
    expect(harness.ackedBatchIds).toEqual([7]);
    harness.orchestrator.dispose();
  });

  it('fails fast for an active batch without cues instead of acknowledging it', async () => {
    const harness = createHarness(drainAckedBatch);
    harness.setQueue([], 5, true);
    harness.emitCurrent();
    await flushPlayback();
    expect(harness.onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '[FAIL-FAST] Active narration batch is empty: test-room/5',
      }),
      '语音播报',
    );
    expect(harness.ackedBatchIds).toEqual([]);
    harness.orchestrator.dispose();
  });

  it('does not play stale queue contents when the authoritative audio gate is open', async () => {
    const harness = createHarness(drainAckedBatch);
    harness.setQueue(firstQueue, 5, false);
    harness.emitCurrent();
    await flushPlayback();
    expect(harness.playedKeys).toEqual([]);
    expect(harness.ackedBatchIds).toEqual([]);
    harness.orchestrator.dispose();
  });
});

describe('RoomAudioOrchestrator resume after rejoin', () => {
  it('keeps recovery available when a replay fails, without acknowledging the batch', async () => {
    const playEffect = vi
      .fn<RoomAudioPlayerPort<TestEffect>['playEffect']>()
      .mockRejectedValueOnce(new Error('autoplay blocked'))
      .mockResolvedValue(undefined);
    const harness = createHarness(drainAckedBatch, { playEffect });
    harness.setQueue(firstQueue, 4);
    harness.orchestrator.setNeedsResume(true);
    await expect(harness.orchestrator.resumeInterrupted()).rejects.toThrow('autoplay blocked');
    expect(harness.ackedBatchIds).toEqual([]);
    expect(harness.orchestrator.needsResume).toBe(true);
    await harness.orchestrator.resumeInterrupted();
    expect(harness.ackedBatchIds).toEqual([4]);
    expect(harness.orchestrator.needsResume).toBe(false);
    harness.orchestrator.dispose();
  });

  it('holds the re-entry guard across the replay: a snapshot republish mid-replay does not start a second playback', async () => {
    let finishClip = (): void => {
      throw new Error('clip has not started');
    };
    const gate = new Promise<void>((resolve) => {
      finishClip = resolve;
    });
    const playEffect = vi
      .fn<RoomAudioPlayerPort<TestEffect>['playEffect']>()
      .mockImplementationOnce(() => gate)
      .mockResolvedValue(undefined);
    const harness = createHarness(drainAckedBatch, { playEffect });
    harness.setQueue(firstQueue, 3);
    harness.orchestrator.setNeedsResume(true);
    const resumed = harness.orchestrator.resumeInterrupted();
    await flushPlayback();
    expect(harness.orchestrator.needsResume).toBe(false);

    // Same epoch, same batch, broadcast again while the replay is still playing.
    harness.emitCurrent();
    await flushPlayback();
    expect(playEffect).toHaveBeenCalledOnce();
    expect(harness.ackedBatchIds).toEqual([]);

    finishClip();
    await resumed;
    expect(harness.ackedBatchIds).toEqual([3]);
    expect(playEffect.mock.calls.map(([effect]) => effect.audioKey)).toEqual([
      'night',
      'evil_reveal',
    ]);

    harness.orchestrator.dispose();
  });

  it('after the resume ack, chains a strictly newer batch like reactive playback', async () => {
    const harness = createHarness(progressIntoSecondQueue);
    harness.setQueue(firstQueue, 1);
    harness.orchestrator.setNeedsResume(true);

    await harness.orchestrator.resumeInterrupted();

    expect(harness.ackedBatchIds).toEqual([1, 2]);
    expect(harness.playedKeys).toEqual(['night', 'evil_reveal', 'merlin_reveal']);

    harness.orchestrator.dispose();
  });

  it.each(['dispose', 'host-loss'] as const)(
    'does not acknowledge or continue playback after %s',
    async (interruption) => {
      let finishClip = (): void => {
        throw new Error('clip has not started');
      };
      const gate = new Promise<void>((resolve) => {
        finishClip = resolve;
      });
      const playEffect = vi.fn<RoomAudioPlayerPort<TestEffect>['playEffect']>(() => gate);
      const harness = createHarness(drainAckedBatch, { playEffect });
      harness.setQueue(firstQueue, 4);
      harness.orchestrator.setNeedsResume(true);
      const resumed = harness.orchestrator.resumeInterrupted();
      await flushPlayback();
      if (interruption === 'dispose') harness.orchestrator.dispose();
      else harness.setIsHost(false);
      finishClip();
      await resumed;
      expect(playEffect).toHaveBeenCalledOnce();
      expect(harness.ackedBatchIds).toEqual([]);
      harness.orchestrator.dispose();
    },
  );

  it('is a no-op when nothing was interrupted', async () => {
    const harness = createHarness(drainAckedBatch);
    await harness.orchestrator.resumeInterrupted();

    expect(harness.playedKeys).toEqual([]);
    expect(harness.ackedBatchIds).toEqual([]);
    harness.orchestrator.dispose();
  });
});

describe('RoomAudioOrchestrator dawn timing', () => {
  it('stops BGM immediately before the night_end effect and before no other effect', async () => {
    const harness = createHarness(progressIntoSecondQueue);
    harness.setQueue([{ audioKey: 'percival_reveal' }, { audioKey: NIGHT_END_AUDIO_KEY }], 1);

    harness.emitCurrent();
    await flushPlayback();

    // The trailing merlin_reveal is the chained second batch released by
    // the first ack; it must not trigger another BGM stop.
    expect(harness.timeline).toEqual([
      'play:percival_reveal',
      'stopBgm',
      `play:${NIGHT_END_AUDIO_KEY}`,
      'play:merlin_reveal',
    ]);

    harness.orchestrator.dispose();
  });
});
