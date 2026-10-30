/**
 * useWerewolfAudioOrchestration — the platform `useRoomAudioOrchestration`
 * bound to the Werewolf session. Only Werewolf's ports live here:
 * - player: night / night-end / step-beginning / step-ending clips on the
 *   WerewolfAudioRuntime (a missing clip is a fail-fast asset error);
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
import { NIGHT_END_AUDIO_KEY } from '@game-judge/game-engine/platform/audio';
import { useMemo } from 'react';

import type { RoomAudioPlayerPort } from '@/features/room/audio/RoomAudioOrchestrator';
import {
  type RoomAudioOrchestration,
  useRoomAudioOrchestration,
} from '@/features/room/audio/useRoomAudioOrchestration';
import { MissingWerewolfAudioError } from '@/games/werewolf/audio/audioRegistry';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import { werewolfRuntimeLog } from '@/utils/logger';

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
): RoomAudioPlayerPort<AudioEffect> & { readonly stopNarration: () => void } {
  return {
    playEffect: async (effect) => {
      if (effect.isEndAudio) await audio.playEnding(effect.audioKey);
      else if (effect.audioKey === 'night') await audio.playNight();
      else if (effect.audioKey === NIGHT_END_AUDIO_KEY) await audio.playNightEnd();
      else await audio.playBeginning(effect.audioKey);
    },
    stopBgm: audio.stopBgm,
    stopNarration: audio.stopNarration,
    isMissingAssetError: (error) => error instanceof MissingWerewolfAudioError,
  };
}

export function useWerewolfAudioOrchestration({
  session,
  isHost,
  audio,
}: UseWerewolfAudioOrchestrationDeps): RoomAudioOrchestration {
  const player = useMemo(() => createWerewolfPlayerPort(audio), [audio]);
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
