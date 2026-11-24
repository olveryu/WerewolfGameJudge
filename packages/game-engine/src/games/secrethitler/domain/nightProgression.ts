/** Secret Hitler first-night progression through the shared step mechanism. */

import { evaluateStepProgress } from '../../../platform/steps';
import type { SecrethitlerState } from '../state/types';
import type { SecrethitlerEvent } from './decision';
import { createSecrethitlerNightRuntime } from './nightSteps';

/** Evaluates one step progression and preserves the existing close-and-dawn audio batch. */
export function evaluateSecrethitlerNightProgress(
  state: SecrethitlerState,
  nowMs: number,
): readonly SecrethitlerEvent[] {
  if (state.phase.kind !== 'night') return [];
  return evaluateStepProgress(createSecrethitlerNightRuntime(), state, nowMs).flatMap(
    (event): SecrethitlerEvent[] =>
      event.type === 'advanced' && event.next === null
        ? [
            { type: 'secrethitler.night.step', event },
            {
              type: 'secrethitler.audio.queued',
              effects: [{ audioKey: 'evil_close', isEndAudio: true }, { audioKey: 'night_end' }],
            },
          ]
        : [{ type: 'secrethitler.night.step', event }],
  );
}
