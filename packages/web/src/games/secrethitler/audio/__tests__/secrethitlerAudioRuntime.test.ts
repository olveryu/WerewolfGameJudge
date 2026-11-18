import { describe, expect, it, vi } from 'vitest';

import type { AudioClip } from '@/features/product/model/AudioClip';

import {
  getSecrethitlerPreloadAudio,
  MissingSecrethitlerAudioError,
  resolveSecrethitlerAudio,
} from '../secrethitlerAudioRegistry';
import {
  type SecrethitlerAudioPlaybackPort,
  SecrethitlerAudioPlayer,
} from '../secrethitlerAudioRuntime';

function createAudioService() {
  const playedClips: AudioClip[] = [];
  const audioService: SecrethitlerAudioPlaybackPort = {
    playClip: vi.fn(async (clip: AudioClip) => {
      playedClips.push(clip);
    }),
    preloadClips: vi.fn(),
    stop: vi.fn(),
    stopBgm: vi.fn(),
  };
  return { audioService, playedClips };
}

describe('Secret Hitler narration assets', () => {
  it('resolves and preloads the fixed offline first-night clip set', () => {
    const clips = getSecrethitlerPreloadAudio();

    expect(clips.map(({ key }) => key)).toEqual([
      'night_start',
      'evil_reveal_5_6',
      'fascist_reveal_7_10',
      'evil_close',
      'night_end',
    ]);
    expect(clips.every(({ url }) => url.endsWith('.mp3'))).toBe(true);
    expect(resolveSecrethitlerAudio('night_start')).toEqual(clips[0]);
  });

  it('fails fast for an unregistered engine audio key', () => {
    expect(() => resolveSecrethitlerAudio('unknown')).toThrow(MissingSecrethitlerAudioError);
  });
});

describe('SecrethitlerAudioPlayer', () => {
  it('plays engine cues, preloads all clips and stops narration through the shared audio service', async () => {
    const { audioService, playedClips } = createAudioService();
    const player = new SecrethitlerAudioPlayer(audioService);

    await player.playEffect({ audioKey: 'night_start' });
    player.preload();
    player.stopNarration();
    player.stopBgm();

    expect(playedClips).toEqual([resolveSecrethitlerAudio('night_start')]);
    expect(audioService.preloadClips).toHaveBeenCalledWith(getSecrethitlerPreloadAudio());
    expect(audioService.stop).toHaveBeenCalledOnce();
    expect(audioService.stopBgm).toHaveBeenCalledOnce();
  });
});
