/** Secret Hitler first-night information on the shared step mechanism. */

import { formatSeat } from '../../../platform/room/formatSeat';
import { getBotDisplayName } from '../../../platform/room/getBotDisplayName';
import { getSeatDisplayName } from '../../../platform/room/seatIdentity';
import {
  defineCopy,
  describeStepConfirmation,
  presentStep,
  type StepContextBase,
  type StepDefinition,
  type StepRuntime,
  type StepSlice,
  type StepSubmission,
} from '../../../platform/steps';
import {
  isSecrethitlerOccupiedSeat,
  SECRETHITLER_NIGHT_STEP_IDS,
  type SecrethitlerNightStep,
  type SecrethitlerState,
} from '../state/types';
import { getKnownFascistSeats, getSecrethitlerNightParticipants } from './rules';

const COPY = defineCopy({
  stepTitle: '坏人互认',
  actionTitle: '夜间信息',
  privacyNotice: '仅你获准查看，请勿向全桌展示屏幕。',
  seatWithIdentity: '{seat} · {name} · {identity}',
  seatSeparator: '\n',
  hitler: '希特勒',
  fascist: '法西斯',
  liberal: '自由派',
});

export const SECRETHITLER_NIGHT_VIEW_ACTION_KEY = 'viewNightInfo';
type SecrethitlerNightFacts = Readonly<Record<string, never>>;
type SecrethitlerNightResult = never;
type SecrethitlerNightSlice = StepSlice<SecrethitlerNightStep, SecrethitlerNightResult>;

type SecrethitlerNightStepContext = StepContextBase<
  SecrethitlerState,
  SecrethitlerNightFacts,
  SecrethitlerNightResult
>;
type SecrethitlerNightStepDefinition = StepDefinition<
  SecrethitlerNightStep,
  SecrethitlerNightStepContext,
  SecrethitlerNightFacts,
  SecrethitlerNightResult
>;
type SecrethitlerNightRuntime = StepRuntime<
  SecrethitlerNightStep,
  SecrethitlerState,
  SecrethitlerNightStepContext,
  SecrethitlerNightFacts,
  SecrethitlerNightResult
>;

const EMPTY_FACTS: SecrethitlerNightFacts = {};

function requireViewerSeat(context: SecrethitlerNightStepContext): number {
  if (context.seat === null) throw new Error('[FAIL-FAST] Secret Hitler night needs a viewer');
  return context.seat;
}

function getIdentityName(state: SecrethitlerState, seat: number): string {
  const identity = state.identities[seat];
  if (identity === undefined) throw new Error('[FAIL-FAST] Night participant has no identity');
  if (identity === 'hitler') return COPY.hitler;
  return identity === 'fascist' ? COPY.fascist : COPY.liberal;
}

function renderRecognition(context: SecrethitlerNightStepContext): string {
  const viewerSeat = requireViewerSeat(context);
  const peers = getKnownFascistSeats(context.state, viewerSeat);
  const list = peers
    .map((seat) =>
      COPY.seatWithIdentity
        .replace('{seat}', formatSeat(seat))
        .replace('{name}', getSeatDisplayName(context.state.roster, seat, getBotDisplayName))
        .replace('{identity}', getIdentityName(context.state, seat)),
    )
    .join(COPY.seatSeparator);
  return list.length === 0 ? COPY.privacyNotice : `${COPY.privacyNotice}\n${list}`;
}

const SECRETHITLER_NIGHT_STEP_DEFINITIONS: Readonly<
  Record<SecrethitlerNightStep, SecrethitlerNightStepDefinition>
> = {
  fascistRecognition: {
    id: 'fascistRecognition',
    title: COPY.stepTitle,
    audio: () => ({ begin: null, end: null }),
    actors: (context) => getSecrethitlerNightParticipants(context.state),
    actions: [
      {
        kind: 'view',
        key: SECRETHITLER_NIGHT_VIEW_ACTION_KEY,
        name: COPY.actionTitle,
        title: COPY.actionTitle,
        contentTitle: COPY.stepTitle,
        content: renderRecognition,
      },
    ],
    skippable: () => false,
    reviewSubject: (_context, seat) => formatSeat(seat),
  },
};

/** Creates the first-night step slice. */
export function createSecrethitlerNightSlice(): SecrethitlerNightSlice {
  const firstStep = SECRETHITLER_NIGHT_STEP_IDS[0];
  if (firstStep === undefined) throw new Error('[FAIL-FAST] Secret Hitler night has no steps');
  return {
    order: [...SECRETHITLER_NIGHT_STEP_IDS],
    current: { stepId: firstStep, serial: 0 },
    records: {},
    deadlineMs: null,
  };
}

function requireSecrethitlerNightSlice(state: SecrethitlerState): SecrethitlerNightSlice {
  if (state.phase.kind !== 'night') throw new Error('[FAIL-FAST] Secret Hitler night is inactive');
  return state.phase.steps;
}

/** Binds the shared step mechanism to Secret Hitler's first-night reveal. */
export function createSecrethitlerNightRuntime(): SecrethitlerNightRuntime {
  return {
    definitions: SECRETHITLER_NIGHT_STEP_DEFINITIONS,
    getSlice: requireSecrethitlerNightSlice,
    getFacts: () => EMPTY_FACTS,
    createContext: (state, facts, seat, record) => ({ state, facts, seat, record }),
    isAudioPlaying: (state) => state.isAudioPlaying,
    seatedSeats: (state) =>
      Array.from({ length: state.config.numberOfPlayers }, (_, seat) => seat).filter((seat) =>
        isSecrethitlerOccupiedSeat(state, seat),
      ),
  };
}

/** Describes confirmation text for the current Secret Hitler night view. */
export function describeSecrethitlerStepConfirmation(
  state: SecrethitlerState,
  viewerSeat: number,
  selection: Pick<StepSubmission, 'actionKey' | 'seats' | 'cardIndex'>,
): ReturnType<typeof describeStepConfirmation> {
  return describeStepConfirmation(createSecrethitlerNightRuntime(), state, viewerSeat, selection);
}

/** Projects the current night step for this viewer, or null outside the night. */
export function presentSecrethitlerNightStep(state: SecrethitlerState, viewerSeat: number | null) {
  return state.phase.kind === 'night'
    ? presentStep(createSecrethitlerNightRuntime(), state, viewerSeat)
    : null;
}

/** Whether this seat has already viewed the current first-night information. */
export function hasViewedSecrethitlerNightStep(state: SecrethitlerState, seat: number): boolean {
  if (state.phase.kind !== 'night') return false;
  const current = state.phase.steps.current;
  if (current === null) return false;
  return (
    state.phase.steps.records[current.stepId]?.bySeat[seat]?.submissions.some(
      (submission) => submission.actionKey === SECRETHITLER_NIGHT_VIEW_ACTION_KEY,
    ) ?? false
  );
}
