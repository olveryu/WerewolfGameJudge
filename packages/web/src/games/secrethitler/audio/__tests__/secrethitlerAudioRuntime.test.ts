import type {
  SecrethitlerCommand,
  SecrethitlerState,
} from '@game-judge/game-engine/games/secrethitler/public';
import type { AudioEffect } from '@game-judge/game-engine/platform/audio';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AudioClip } from '@/features/product/model/AudioClip';
import { createFakeBgm } from '@/test-utils/fakeBgm';
import { createFakeRoomLink, readyLinkSnapshot, testIdentity } from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import {
  buildSecrethitlerTestLobby,
  startSecrethitlerTestGame,
} from '@/test-utils/secrethitlerState';
import * as errors from '@/utils/errorPipeline';

import { useSecrethitlerAudioOrchestration } from '../../room/hooks/useSecrethitlerAudioOrchestration';
import {
  getSecrethitlerPreloadAudio,
  MissingSecrethitlerAudioError,
  resolveSecrethitlerAudio,
} from '../secrethitlerAudioRegistry';
import {
  type SecrethitlerAudioPlaybackPort,
  SecrethitlerAudioPlayer,
  type SecrethitlerAudioRuntime,
} from '../secrethitlerAudioRuntime';

function createAudioService() {
  const playedClips: AudioClip[] = [];
  const audioService: SecrethitlerAudioPlaybackPort = {
    playClip: vi.fn(async (clip: AudioClip) => {
      playedClips.push(clip);
    }),
    preloadClips: vi.fn(),
    stop: vi.fn(),
    ...createFakeBgm(),
    setBgmVolume: vi.fn(),
    setGameAudioVolume: vi.fn(),
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

  describe('Secret Hitler narration recovery', () => {
    afterEach(() => vi.restoreAllMocks());

    function createRecovery(phase: 'night' | 'election' = 'night') {
      const nights: SecrethitlerState[] = [];
      startSecrethitlerTestGame(buildSecrethitlerTestLobby(), (state) => {
        if (state.phase.kind === phase && state.isAudioPlaying) nights.push(state);
      });
      const night = nights[0];
      if (night === undefined) throw new Error('Missing opening night');
      const state = night;
      const link = createFakeRoomLink<SecrethitlerState, SecrethitlerCommand>(
        readyLinkSnapshot(testIdentity('secrethitler'), createRoomSnapshot(state, 1)),
        async () =>
          successfulRoomCommand(
            {
              ...state,
              pendingAudioEffects: [],
              isAudioPlaying: false,
            },
            'audio-ack',
            2,
          ),
      );
      const timeline: string[] = [];
      const audio = {
        playEffect: vi.fn(async ({ audioKey }: AudioEffect) => {
          timeline.push(audioKey);
        }),
        preload: vi.fn(),
        stopNarration: vi.fn(),
        ...createFakeBgm(),
        setBgmVolume: vi.fn(),
        setGameAudioVolume: vi.fn(),
      } satisfies SecrethitlerAudioRuntime;
      audio.stopBgm.mockImplementation(() => {
        timeline.push('stopBgm');
      });
      return { audio, link, timeline, state };
    }

    it.each(['night', 'election'] as const)(
      'resumes the complete %s narration batch after a gesture',
      async (phase) => {
        const { audio, link, timeline, state } = createRecovery(phase);
        const { result } = renderHook(() =>
          useSecrethitlerAudioOrchestration({ session: link, isHost: true, audio }),
        );
        expect(result.current.isResumeRequired).toBe(true);
        expect(audio.playEffect).not.toHaveBeenCalled();
        expect(link.dispatch).not.toHaveBeenCalled();
        await act(async () => {
          await result.current.resumeAfterRejoin();
        });
        expect(timeline).toEqual(
          phase === 'night'
            ? ['night_start', 'fascist_reveal_7_10']
            : ['evil_close', 'stopBgm', 'night_end'],
        );
        expect(audio.preload).toHaveBeenCalledOnce();
        expect(link.dispatch).toHaveBeenCalledExactlyOnceWith(
          { type: 'secrethitler.audio.ack', audioBatchId: state.audioBatchId },
          { controlledSeat: null, label: '播报确认', durable: true },
        );
      },
    );

    it('reports playback failure without acknowledging or advancing the batch', async () => {
      const { audio, link } = createRecovery();
      const failure = new Error('media output unavailable');
      audio.playEffect.mockRejectedValue(failure);
      const handleError = vi.spyOn(errors, 'handleError').mockImplementation(() => undefined);
      const { result } = renderHook(() =>
        useSecrethitlerAudioOrchestration({ session: link, isHost: true, audio }),
      );
      await act(async () => {
        await result.current.resumeAfterRejoin();
      });
      expect(handleError).toHaveBeenCalledWith(
        failure,
        expect.objectContaining({ feedback: 'toast' }),
      );
      expect(link.dispatch).not.toHaveBeenCalled();
      expect(result.current.isResumeRequired).toBe(true);
      audio.playEffect.mockResolvedValue(undefined);
      await act(async () => result.current.resumeAfterRejoin());
      expect(result.current.isResumeRequired).toBe(false);
      expect(link.dispatch).toHaveBeenCalledOnce();
    });

    it('does not continue the replay batch after the room unmounts', async () => {
      const { audio, link } = createRecovery();
      const { result, unmount } = renderHook(() =>
        useSecrethitlerAudioOrchestration({ session: link, isHost: true, audio }),
      );
      audio.playEffect.mockImplementationOnce(async () => {
        unmount();
      });
      await act(async () => {
        await result.current.resumeAfterRejoin();
      });
      expect(audio.playEffect).toHaveBeenCalledOnce();
      expect(audio.stopNarration).toHaveBeenCalledOnce();
      expect(link.dispatch).not.toHaveBeenCalled();
    });
  });
});
