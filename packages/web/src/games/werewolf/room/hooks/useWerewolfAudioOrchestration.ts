/**
 * useWerewolfAudioOrchestration — the platform `useRoomAudioOrchestration`
 * bound to the Werewolf session. Only Werewolf's ports live here:
 * - player: effects on WerewolfAudioRuntime, with public-board narration preloaded before playback;
 * - ack: `werewolf.audio.ack`;
 * The shared core recovers complete authoritative batches in every phase.
 */

import type { AudioEffect } from '@game-judge/game-engine/games/werewolf/public';
import type { WerewolfPublicCommand } from '@game-judge/game-engine/games/werewolf/public';
import { useMemo } from 'react';

import type { RoomAudioPlayerPort } from '@/features/room/audio/RoomAudioOrchestrator';
import {
  type RoomAudioOrchestration,
  useRoomAudioOrchestration,
} from '@/features/room/audio/useRoomAudioOrchestration';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import { log } from '@/utils/logger';

const werewolfRuntimeLog = log.extend('WerewolfRuntime');

interface UseWerewolfAudioOrchestrationDeps {
  readonly session: WerewolfRoomSession;
  readonly isHost: boolean;
  readonly audio: WerewolfAudioRuntime;
}

const ackCommand = (audioBatchId: number): WerewolfPublicCommand => ({
  type: 'werewolf.audio.ack',
  audioBatchId,
});

function createWerewolfPlayerPort(
  audio: WerewolfAudioRuntime,
  session: WerewolfRoomSession,
): RoomAudioPlayerPort<AudioEffect> & { readonly stopNarration: () => void } {
  return {
    playEffect: (effect) => audio.playEffect(effect.audioKey, effect.isEndAudio),
    stopBgm: audio.stopBgm,
    stopNarration: audio.stopNarration,
    prepareQueue: () => {
      const snapshot = session.getSnapshot();
      if (snapshot.phase !== 'ready') {
        throw new Error('[FAIL-FAST] Werewolf audio preload requires a ready session');
      }
      audio.preload(snapshot.room.state.templateRoles);
      return Promise.resolve();
    },
  };
}

export function useWerewolfAudioOrchestration({
  session,
  isHost,
  audio,
}: UseWerewolfAudioOrchestrationDeps): RoomAudioOrchestration {
  const player = useMemo(() => createWerewolfPlayerPort(audio, session), [audio, session]);
  return useRoomAudioOrchestration({
    session,
    isHost,
    player,
    ackCommand,
    ackLabel: '播报确认',
    logger: werewolfRuntimeLog,
  });
}
