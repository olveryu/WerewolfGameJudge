/**
 * useAvalonAudioOrchestration — the platform `useRoomAudioOrchestration`
 * bound to the Avalon session. Only Avalon's ports live here:
 * - player: AvalonAudioPlayer.playEffect, batch preload (failure only warns),
 *   a missing clip is a fail-fast asset error;
 * - ack: `avalon.audio.ack`;
 * - narrated phase: the night, plus the dawn batch still playing after it;
 * - rejoin replay: the current night step's opening clip, nothing at dawn.
 */

import {
  type AudioEffect,
  type AvalonPublicCommand,
  type AvalonState,
  getAvalonNightStepDef,
} from '@game-judge/game-engine/games/avalon/public';
import { useMemo } from 'react';

import type { RoomAudioPlayerPort } from '@/features/room/audio/RoomAudioOrchestrator';
import {
  type RoomAudioOrchestration,
  useRoomAudioOrchestration,
} from '@/features/room/audio/useRoomAudioOrchestration';
import { log } from '@/utils/logger';

import type { AvalonAudioRuntime } from '../../audio/AvalonAudioPlayer';
import { MissingAvalonAudioError } from '../../audio/avalonAudioRegistry';
import type { AvalonRoomSession } from '../../model/AvalonRoomSession';

const avalonAudioLog = log.extend('AvalonAudio');

interface UseAvalonAudioOrchestrationDeps {
  readonly session: AvalonRoomSession;
  readonly isHost: boolean;
  readonly audio: AvalonAudioRuntime;
}

const ackCommand = (audioBatchId: number): AvalonPublicCommand => ({
  type: 'avalon.audio.ack',
  audioBatchId,
});

const isNarratedPhase = (state: AvalonState): boolean =>
  state.phase.kind === 'night' || state.isAudioPlaying;

const resolveReplayAudioKey = (state: AvalonState): string | null =>
  state.phase.kind === 'night' ? getAvalonNightStepDef(state.phase.step).audioKey : null;

function createAvalonPlayerPort(
  audio: AvalonAudioRuntime,
): RoomAudioPlayerPort<AudioEffect> & { readonly stopNarration: () => void } {
  return {
    playEffect: (effect) => audio.playEffect(effect.audioKey, effect.isEndAudio),
    stopBgm: audio.stopBgm,
    stopNarration: audio.stopNarration,
    prepareQueue: async () => {
      try {
        await audio.preload();
      } catch (error) {
        avalonAudioLog.warn('avalon audio preload failed', { error });
      }
    },
    isMissingAssetError: (error) => error instanceof MissingAvalonAudioError,
  };
}

export function useAvalonAudioOrchestration({
  session,
  isHost,
  audio,
}: UseAvalonAudioOrchestrationDeps): RoomAudioOrchestration {
  const player = useMemo(() => createAvalonPlayerPort(audio), [audio]);
  return useRoomAudioOrchestration({
    session,
    isHost,
    player,
    ackCommand,
    ackLabel: '播报确认',
    isNarratedPhase,
    resolveReplayAudioKey,
    logger: avalonAudioLog,
  });
}
