import type { Mocked } from 'vitest';

import type { AudioClip } from '@/features/product/model/AudioClip';
import { MissingWerewolfAudioError } from '@/games/werewolf/audio/audioRegistry';
import {
  type WerewolfAudioPlaybackPort,
  WerewolfAudioPlayer,
} from '@/games/werewolf/audio/WerewolfAudioPlayer';

function createPlayback(): Mocked<WerewolfAudioPlaybackPort> {
  return {
    playClip: vi.fn(async (_clip: AudioClip) => undefined),
    preloadClips: vi.fn((_clips: readonly AudioClip[]) => undefined),
    stop: vi.fn(),
    startBgm: vi.fn(),
    stopBgm: vi.fn(),
    isBgmPlaying: vi.fn(() => false),
    subscribeBgm: vi.fn(() => () => undefined),
    setBgmVolume: vi.fn(),
    setGameAudioVolume: vi.fn(),
    clearPreloaded: vi.fn(),
  };
}

describe('WerewolfAudioPlayer', () => {
  it('maps game narration semantics to generic playback clips', async () => {
    const playback = createPlayback();
    const audio = new WerewolfAudioPlayer(playback);

    await audio.playEffect('wolf');
    await audio.playEffect('wolf', true);
    await audio.playEffect('night');
    await audio.playEffect('night_end');

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

  it.each([false, true])('fails fast for a missing clip (ending: %s)', (isEndAudio) => {
    const playback = createPlayback();
    const audio = new WerewolfAudioPlayer(playback);

    expect(() => audio.playEffect('missing-clip', isEndAudio)).toThrow(MissingWerewolfAudioError);
    expect(playback.playClip).not.toHaveBeenCalled();
  });

  it('delegates preload and lifecycle operations', () => {
    const playback = createPlayback();
    const audio = new WerewolfAudioPlayer(playback);

    audio.preload(['wolf', 'villager']);
    audio.stopNarration();
    audio.startBgm(['a.m4a']);
    audio.stopBgm();
    audio.setBgmVolume(0.3);
    audio.setGameAudioVolume(0.8);
    audio.clearPreloaded();

    expect(playback.preloadClips).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ key: 'night' }),
        expect.objectContaining({ key: 'role_begin_wolf' }),
      ]),
    );
    expect(playback.preloadClips.mock.calls[0]?.[0]).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'role_begin_witch' })]),
    );
    expect(playback.stop).toHaveBeenCalledTimes(1);
    expect(playback.startBgm).toHaveBeenCalledWith(['a.m4a']);
    expect(playback.stopBgm).toHaveBeenCalledTimes(1);
    expect(playback.setBgmVolume).toHaveBeenCalledWith(0.3);
    expect(playback.setGameAudioVolume).toHaveBeenCalledWith(0.8);
    expect(playback.clearPreloaded).toHaveBeenCalledTimes(1);
  });
});
