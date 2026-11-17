/**
 * useWerewolfAudioOrchestration — the platform `useRoomAudioOrchestration`
 * bound to the Werewolf session. Only Werewolf's ports live here:
 * - player: effects on WerewolfAudioRuntime, with public-board narration
 *   preloaded before playback (a missing clip is a fail-fast asset error);
 * - ack: `werewolf.audio.ack`;
 * - narrated phase: the night (`GameStatus.Ongoing`);
 * - rejoin replay: the current step's beginning clip (seer label variants
 *   resolved from state), nothing at night end.
 */

import type { AudioEffect, GameState } from '@game-judge/game-engine/games/werewolf/public';
import {
  GameStatus,
  getStepSpec,
  resolveSeerAudioKey,
  type WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { useMemo } from 'react';

import type { RoomAudioPlayerPort } from '@/features/room/audio/RoomAudioOrchestrator';
import {
  type RoomAudioOrchestration,
  useRoomAudioOrchestration,
} from '@/features/room/audio/useRoomAudioOrchestration';
import { MissingWerewolfAudioError } from '@/games/werewolf/audio/audioRegistry';
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

const isNarratedPhase = (state: GameState): boolean => state.status === GameStatus.Ongoing;

/** Outside a night step (night end) the gate closes on a batch with nothing to replay. */
function resolveReplayAudioKey(state: GameState): string | null {
  const stepId = state.nightStep?.kind === 'inStep' ? state.nightStep.stepId : null;
  if (stepId === null) return null;
  const stepSpec = getStepSpec(stepId);
  if (stepSpec === undefined) throw new Error(`[FAIL-FAST] Night step has no spec: ${stepId}`);
  return resolveSeerAudioKey(stepSpec.audioKey, state.seerLabelMap);
}

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
    isMissingAssetError: (error) => error instanceof MissingWerewolfAudioError,
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
    isNarratedPhase,
    resolveReplayAudioKey,
    logger: werewolfRuntimeLog,
  });
}
