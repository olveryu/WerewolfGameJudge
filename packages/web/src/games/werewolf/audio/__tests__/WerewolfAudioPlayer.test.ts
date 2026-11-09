import type { Mocked } from 'vitest';

import type { AudioClip } from '@/features/product/model/AudioClip';
import {
  type WerewolfAudioPlaybackPort,
  WerewolfAudioPlayer,
} from '@/games/werewolf/audio/WerewolfAudioPlayer';

function createPlayback(): Mocked<WerewolfAudioPlaybackPort> {
  return {
    playClip: vi.fn(async (_clip: AudioClip) => undefined),
    preloadClips: vi.fn((_clips: readonly AudioClip[]) => undefined),
    stop: vi.fn(),
    stopBgm: vi.fn(),
    clearPreloaded: vi.fn(),
  };
}

describe('WerewolfAudioPlayer', () => {
  it('maps game narration semantics to generic playback clips', async () => {
    const playback = createPlayback();
    const audio = new WerewolfAudioPlayer(playback);

    await audio.playBeginning('wolf');
    await audio.playEnding('wolf');
    await audio.playNight();
    await audio.playNightEnd();

    expect(playback.playClip).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ key: 'role_begin_wolf' }),
    );
    expect(playback.playClip).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ key: 'role_end_wolf' }),
    );
    expect(playback.playClip).toHaveBeenNthCalledWith(3, expect.objectContaining({ key: 'night' }));
    expect(playback.playClip).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ key: 'night_end' }),
    );
  });

  it('delegates preload and lifecycle operations', () => {
    const playback = createPlayback();
    const audio = new WerewolfAudioPlayer(playback);

    audio.preloadRoles(['wolf', 'villager']);
    audio.stopNarration();
    audio.stopBgm();
    audio.clearPreloaded();

    expect(playback.preloadClips).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ key: 'night' }),
        expect.objectContaining({ key: 'role_begin_wolf' }),
      ]),
    );
    expect(playback.stop).toHaveBeenCalledTimes(1);
    expect(playback.stopBgm).toHaveBeenCalledTimes(1);
    expect(playback.clearPreloaded).toHaveBeenCalledTimes(1);
  });
});
