import {
  applyAudioPlaybackLock,
  AUDIO_PLAYBACK_LOCK_REASON,
  isAudioPlaybackLocked,
} from '../audioPlaybackLock';
import type { RoomHostManagementAction, RoomHostManagementModel } from '../RoomHostManagement';

function enabledAction(key: string): RoomHostManagementAction {
  return {
    key,
    label: key,
    icon: 'play-outline',
    variant: 'primary',
    isEnabled: true,
    onPress: jest.fn(),
  };
}

function disabledAction(key: string, disabledReason: string | null): RoomHostManagementAction {
  return {
    key,
    label: key,
    icon: 'play-outline',
    variant: 'secondary',
    isEnabled: false,
    disabledReason,
  };
}

function modelWith(actions: readonly RoomHostManagementAction[]): RoomHostManagementModel {
  return { sections: [{ key: 'flow', title: '流程', actions }] };
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

    const locked = result!.sections[0]!.actions[0]!;
    expect(locked).toMatchObject({
      key: 'abort-game',
      isEnabled: false,
      disabledReason: AUDIO_PLAYBACK_LOCK_REASON,
    });
    expect(locked).not.toHaveProperty('onPress');
    expect(abort.isEnabled).toBe(true);
  });

  it('keeps exempt read-only actions enabled with their press handler', () => {
    const review = enabledAction('night-review');
    const model = modelWith([review, enabledAction('abort-game')]);

    const result = applyAudioPlaybackLock(model, {
      isAudioPlaying: true,
      exemptActionKeys: new Set(['night-review']),
    });

    expect(result!.sections[0]!.actions[0]).toBe(review);
    expect(result!.sections[0]!.actions[1]).toMatchObject({ isEnabled: false });
  });

  it('keeps already-disabled actions and their own reason untouched', () => {
    const gated = disabledAction('start-game', '座位尚未坐满（还差 2 人）');
    const model = modelWith([gated]);

    const result = applyAudioPlaybackLock(model, {
      isAudioPlaying: true,
      exemptActionKeys: new Set(),
    });

    expect(result!.sections[0]!.actions[0]).toBe(gated);
  });

  it('applies the lock across every section and preserves model fields', () => {
    const model: RoomHostManagementModel = {
      hasPendingAction: true,
      sections: [
        { key: 'flow', title: '流程', actions: [enabledAction('next-round')] },
        { key: 'danger', title: '危险操作', actions: [enabledAction('abort-game')] },
      ],
    };

    const result = applyAudioPlaybackLock(model, {
      isAudioPlaying: true,
      exemptActionKeys: new Set(),
    });

    expect(result!.hasPendingAction).toBe(true);
    expect(result!.sections.map((section) => section.key)).toEqual(['flow', 'danger']);
    for (const section of result!.sections) {
      for (const action of section.actions) {
        expect(action.isEnabled).toBe(false);
      }
    }
  });
});
