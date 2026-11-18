/**
 * useAvalonAudioOrchestration — the platform `useRoomAudioOrchestration`
 * bound to the Avalon session. Only Avalon's ports live here:
 * - player: AvalonAudioPlayer.playEffect, batch preload before playback,
 *   a missing clip is a fail-fast asset error;
 * - ack: `avalon.audio.ack`;
 * The shared core recovers complete authoritative batches in every phase.
 */

import type { AudioEffect, AvalonPublicCommand } from '@game-judge/game-engine/games/avalon/public';
import { useMemo } from 'react';

import type { RoomAudioPlayerPort } from '@/features/room/audio/RoomAudioOrchestrator';
import {
  type RoomAudioOrchestration,
  useRoomAudioOrchestration,
} from '@/features/room/audio/useRoomAudioOrchestration';
import { log } from '@/utils/logger';

import type { AvalonAudioRuntime } from '../../audio/AvalonAudioPlayer';
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

function createAvalonPlayerPort(
  audio: AvalonAudioRuntime,
): RoomAudioPlayerPort<AudioEffect> & { readonly stopNarration: () => void } {
  return {
    playEffect: (effect) => audio.playEffect(effect.audioKey, effect.isEndAudio),
    stopBgm: audio.stopBgm,
    stopNarration: audio.stopNarration,
    prepareQueue: () => {
      audio.preload();
      return Promise.resolve();
    },
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
    logger: avalonAudioLog,
  });
}
