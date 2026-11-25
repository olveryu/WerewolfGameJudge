import { getBotSeats } from '../../../../platform/room/seating';
import {
  decideStepSubmission,
  REASON_STEP_STALE,
  type StepSubmission,
} from '../../../../platform/steps';
import { createWerewolfNightState } from '../../roles/nightEvolution';
import {
  createWerewolfStepRuntime,
  planWerewolfGroupBotAcknowledgements,
} from '../../roles/nightRuntime';
import { createAudioQueueAction } from '../audioQueue';
import { GameStatus } from '../models';
import { resolveNightStepAudioKey } from '../nightProgression';
import type { GameState } from '../protocol/types';
import { gameReducer } from '../reducer/gameReducer';
import type { StateAction } from '../reducer/types';
import { handlerError, type HandlerResult, handlerSuccess } from './types';

/** Start a spec-driven first night and queue its initial narration. */
export function handleBeginSpecNight(state: GameState): HandlerResult {
  if (state.status !== GameStatus.Ready) return handlerError('invalid_status');
  const night = createWerewolfNightState(state);
  const firstStep = night.slice.current;
  const actions: StateAction[] = [
    { type: 'START_NIGHT' },
    { type: 'WEREWOLF_NIGHT_EVENT', event: { type: 'initialized', night } },
  ];
  if (firstStep === null) return handlerSuccess(actions);
  const started = actions.reduce(gameReducer, state);
  const runtime = createWerewolfStepRuntime(null);
  const definition = runtime.definitions[firstStep.stepId];
  if (definition === undefined) throw new Error('[FAIL-FAST] Missing first night step definition');
  const context = runtime.createContext(started, night.facts, null, { bySeat: {} });
  const begin = definition.audio(context).begin;
  actions.push(
    createAudioQueueAction([
      { audioKey: 'night', isEndAudio: false },
      ...(begin === null
        ? []
        : [
            {
              audioKey: resolveNightStepAudioKey(started, firstStep.stepId, begin),
              isEndAudio: false,
            },
          ]),
    ]),
  );
  return handlerSuccess(actions);
}

/** Submit an action using the shared step legality and staleness rules. */
export function handleSpecNightSubmission(
  state: GameState,
  actorSeat: number,
  gameSequence: number,
  submission: StepSubmission,
  randomSeed: string,
): HandlerResult {
  if (
    state.status !== GameStatus.Ongoing ||
    state.nightState === null ||
    state.gameSequence !== gameSequence ||
    state.isAudioPlaying
  ) {
    return handlerError(REASON_STEP_STALE);
  }
  const decision = decideStepSubmission(
    createWerewolfStepRuntime(randomSeed),
    state,
    actorSeat,
    submission,
  );
  if (decision.kind === 'reject') return handlerError(decision.reason);
  return handlerSuccess(
    decision.events.map((event) => ({
      type: 'WEREWOLF_NIGHT_EVENT',
      event: { type: 'step', event },
    })),
  );
}

/** Acknowledge the current shared view for bot seats on the host's request. */
export function handleSpecNightBotAcknowledgements(
  state: GameState,
  expected: { readonly gameSequence: number; readonly stepId: string; readonly serial: number },
): HandlerResult {
  const botSeats = getBotSeats(state.roster);
  if (botSeats.length === 0) return handlerError('no_bot_seats');
  const current = state.nightState?.slice.current;
  if (
    state.status !== GameStatus.Ongoing ||
    state.nightState === null ||
    state.isAudioPlaying ||
    state.gameSequence !== expected.gameSequence ||
    current?.stepId !== expected.stepId ||
    current.serial !== expected.serial
  ) {
    return handlerError(REASON_STEP_STALE);
  }
  const events = planWerewolfGroupBotAcknowledgements(state);
  if (events.length === 0) return handlerError(REASON_STEP_STALE);
  return handlerSuccess(
    events.map((event) => ({ type: 'WEREWOLF_NIGHT_EVENT', event: { type: 'step', event } })),
  );
}
