import type {
  AudioEffect,
  SecrethitlerCommand,
} from '@game-judge/game-engine/games/secrethitler/public';
import { useMemo } from 'react';

import type { RoomAudioPlayerPort } from '@/features/room/audio/RoomAudioOrchestrator';
import {
  type RoomAudioOrchestration,
  useRoomAudioOrchestration,
} from '@/features/room/audio/useRoomAudioOrchestration';
import { log } from '@/utils/logger';

import type { SecrethitlerAudioRuntime } from '../../audio/secrethitlerAudioRuntime';
import type { SecrethitlerRoomSession } from '../../model/SecrethitlerRoomSession';

const logger = log.extend('SecrethitlerAudio');
const ackCommand = (audioBatchId: number): SecrethitlerCommand => ({
  type: 'secrethitler.audio.ack',
  audioBatchId,
});

/** Binds required first-night narration to the same lifecycle as Avalon and Werewolf. */
export function useSecrethitlerAudioOrchestration({
  session,
  isHost,
  audio,
}: {
  readonly session: SecrethitlerRoomSession;
  readonly isHost: boolean;
  readonly audio: SecrethitlerAudioRuntime;
}): RoomAudioOrchestration {
  const player = useMemo(
    (): RoomAudioPlayerPort<AudioEffect> & { readonly stopNarration: () => void } => ({
      playEffect: audio.playEffect,
      stopBgm: audio.stopBgm,
      stopNarration: audio.stopNarration,
      prepareQueue: () => {
        audio.preload();
        return Promise.resolve();
      },
    }),
    [audio],
  );
  return useRoomAudioOrchestration({
    session,
    isHost,
    player,
    ackCommand,
    ackLabel: '播报确认',
    logger,
  });
}
