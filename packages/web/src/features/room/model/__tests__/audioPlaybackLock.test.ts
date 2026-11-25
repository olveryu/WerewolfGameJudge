import {
  applyAudioPlaybackLock,
  AUDIO_PLAYBACK_LOCK_REASON,
  isAudioPlaybackLocked,
} from '../audioPlaybackLock';
import type { RoomHostAction } from '../RoomAction';
import type { RoomHostManagementModel } from '../RoomHostManagement';

function enabledAction(key: string): RoomHostAction {
  return {
    key,
    label: key,
    icon: 'play-outline',
    category: 'host',
    state: { kind: 'ready', onPress: vi.fn() },
  };
}

function disabledAction(key: string, disabledReason: string | null): RoomHostAction {
  return {
    key,
    label: key,
    icon: 'play-outline',
    category: 'host',
    state: { kind: 'blocked', reason: disabledReason },
  };
}

function modelWith(actions: readonly RoomHostAction[]): RoomHostManagementModel {
  return { task: null, actions };
}

describe('isAudioPlaybackLocked', () => {
  it('mirrors the playback flag', () => {
    expect(isAudioPlaybackLocked(true)).toBe(true);
    expect(isAudioPlaybackLocked(false)).toBe(false);
  });
});

describe('applyAudioPlaybackLock', () => {
  it('returns the model untouched while audio is idle', () => {
    const model = modelWith([enabledAction('abort-game')]);

    const result = applyAudioPlaybackLock(model, {
      isAudioPlaying: false,
      exemptActionKeys: new Set(),
    });

    expect(result).toBe(model);
  });

  it('passes a null model through', () => {
    expect(
      applyAudioPlaybackLock(null, { isAudioPlaying: true, exemptActionKeys: new Set() }),
    ).toBeNull();
  });

  it('disables enabled actions with the one lock reason and drops their press handler', () => {
    const abort = enabledAction('abort-game');
    const model = modelWith([abort]);

    const result = applyAudioPlaybackLock(model, {
      isAudioPlaying: true,
      exemptActionKeys: new Set(),
    });

    const locked = result.actions[0]!;
    expect(locked).toMatchObject({
      key: 'abort-game',
      state: { kind: 'blocked', reason: AUDIO_PLAYBACK_LOCK_REASON },
    });
    expect(locked.state).not.toHaveProperty('onPress');
    expect(abort.state.kind).toBe('ready');
  });

  it('keeps exempt read-only actions enabled with their press handler', () => {
    const review = enabledAction('night-review');
    const model = modelWith([review, enabledAction('abort-game')]);

    const result = applyAudioPlaybackLock(model, {
      isAudioPlaying: true,
      exemptActionKeys: new Set(['night-review']),
    });

    expect(result.actions[0]).toBe(review);
    expect(result.actions[1]).toMatchObject({ state: { kind: 'blocked' } });
  });

  it('keeps already-disabled actions and their own reason untouched', () => {
    const gated = disabledAction('start-game', '座位尚未坐满（还差 2 人）');
    const model = modelWith([gated]);

    const result = applyAudioPlaybackLock(model, {
      isAudioPlaying: true,
      exemptActionKeys: new Set(),
    });

    expect(result.actions[0]).toBe(gated);
  });

  it('applies the lock across every section and preserves model fields', () => {
    const model: RoomHostManagementModel = {
      task: { kind: 'action', actionKey: 'next-round' },
      actions: [enabledAction('next-round'), enabledAction('abort-game')],
    };

    const result = applyAudioPlaybackLock(model, {
      isAudioPlaying: true,
      exemptActionKeys: new Set(),
    });

    expect(result.task).toEqual({ kind: 'action', actionKey: 'next-round' });
    expect(result.actions.map((action) => action.key)).toEqual(['next-round', 'abort-game']);
    expect(result.actions.every((action) => action.state.kind === 'blocked')).toBe(true);
  });
});
