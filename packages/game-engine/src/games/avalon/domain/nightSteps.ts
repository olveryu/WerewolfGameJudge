/**
 * Avalon night steps on the shared step mechanism: the three private
 * reveals are "view information" steps whose actors are derived from
 * the dealt roles. Step order lives only in AVALON_NIGHT_STEPS; this
 * table is keyed by step and its copy lives in the table below. No IO.
 *
 * Narration keys are roles-derived: the evilReveal opening names Oberon
 * only when Oberon is dealt. The closing line never varies.
 */

import { formatSeat } from '../../../platform/room/formatSeat';
import { getBotDisplayName } from '../../../platform/room/getBotDisplayName';
import { getSeatDisplayName } from '../../../platform/room/seatIdentity';
import {
  defineCopy,
  describeStepConfirmation,
  renderCopy,
  type StepContextBase,
  type StepDefinition,
  type StepRuntime,
  type StepSlice,
  type StepSubmission,
} from '../../../platform/steps';
import {
  AVALON_NIGHT_STEPS,
  type AvalonNightStep,
  type AvalonRoleId,
  type AvalonState,
  isAvalonEvilRole,
  isAvalonOccupiedSeat,
} from '../state/types';

const COPY = defineCopy({
  evilRevealTitle: '坏人互认',
  merlinRevealTitle: '梅林的视野',
  percivalRevealTitle: '派西维尔的视野',
  evilPeers: '你看到的坏人同伴：{seats}',
  merlinSees: '你看到的坏人：{seats}',
  percivalSees: '你看到的两个人，其中一个是梅林，另一个是莫甘娜：{seats}',
  seatWithName: '{seat}·{name}',
  seatSeparator: '、',
});

/** The only action of every Avalon night step: view the private night information. */
export const AVALON_NIGHT_VIEW_ACTION_KEY = 'viewNightInfo';

/** Avalon nights carry no shared facts; every reveal is derived from the dealt roles. */
type AvalonNightFacts = Readonly<Record<string, never>>;

/** Avalon reveals produce no private result beyond the viewed content. */
type AvalonNightResult = never;

type AvalonNightSlice = StepSlice<AvalonNightStep, AvalonNightResult>;

export type AvalonNightStepContext = StepContextBase<
  AvalonState,
  AvalonNightFacts,
  AvalonNightResult
>;

type AvalonNightStepDefinition = StepDefinition<
  AvalonNightStep,
  AvalonNightStepContext,
  AvalonNightFacts,
  AvalonNightResult
>;

type AvalonNightRuntime = StepRuntime<
  AvalonNightStep,
  AvalonState,
  AvalonNightStepContext,
  AvalonNightFacts,
  AvalonNightResult
>;

const EMPTY_FACTS: AvalonNightFacts = {};

function isOberonRole(role: AvalonRoleId): boolean {
  return role === 'oberon';
}

function hasOberonRole(roles: Readonly<Record<number, AvalonRoleId>>): boolean {
  return Object.values(roles).some(isOberonRole);
}

function seatsWithRole(
  roles: Readonly<Record<number, AvalonRoleId>>,
  matches: (role: AvalonRoleId) => boolean,
): readonly number[] {
  return Object.entries(roles)
    .filter(([, role]) => matches(role))
    .map(([seat]) => Number(seat));
}

const AVALON_NIGHT_PARTICIPANTS: Readonly<
  Record<AvalonNightStep, (roles: Readonly<Record<number, AvalonRoleId>>) => readonly number[]>
> = {
  // 坏人互认：奥伯伦全程闭眼，不参与、不确认。
  evilReveal: (roles) =>
    seatsWithRole(roles, (role) => isAvalonEvilRole(role) && !isOberonRole(role)),
  merlinReveal: (roles) => seatsWithRole(roles, (role) => role === 'merlin'),
  percivalReveal: (roles) => seatsWithRole(roles, (role) => role === 'percival'),
};

/** The seats that must view one night step's information for the dealt roles. */
export function getAvalonNightParticipants(
  roles: Readonly<Record<number, AvalonRoleId>>,
  step: AvalonNightStep,
): readonly number[] {
  return AVALON_NIGHT_PARTICIPANTS[step](roles);
}

const AVALON_NIGHT_AUDIO: Readonly<
  Record<
    AvalonNightStep,
    (roles: Readonly<Record<number, AvalonRoleId>>) => {
      readonly begin: string;
      readonly end: string;
    }
  >
> = {
  evilReveal: (roles) => ({
    begin: hasOberonRole(roles) ? 'evil_reveal_except_oberon' : 'evil_reveal',
    end: 'evil_reveal',
  }),
  merlinReveal: () => ({ begin: 'merlin_reveal', end: 'merlin_reveal' }),
  percivalReveal: () => ({ begin: 'percival_reveal', end: 'percival_reveal' }),
};

function formatSeatList(state: AvalonState, seats: readonly number[]): string {
  return seats
    .map((seat) =>
      renderCopy(COPY.seatWithName, {
        seat: formatSeat(seat),
        name: getSeatDisplayName(state.roster, seat, getBotDisplayName),
      }),
    )
    .join(COPY.seatSeparator);
}

function requireViewerSeat(context: AvalonNightStepContext): number {
  if (context.seat === null) throw new Error('[FAIL-FAST] Avalon night content needs a viewer');
  return context.seat;
}

function defineRevealStep(input: {
  readonly id: AvalonNightStep;
  readonly title: string;
  readonly content: (context: AvalonNightStepContext) => string;
}): AvalonNightStepDefinition {
  return {
    id: input.id,
    title: input.title,
    audio: (context) => getAvalonNightStepAudio(input.id, context.state.roles),
    actors: (context) => getAvalonNightParticipants(context.state.roles, input.id),
    actions: [
      {
        kind: 'view',
        key: AVALON_NIGHT_VIEW_ACTION_KEY,
        name: input.title,
        title: input.title,
        content: input.content,
      },
    ],
    skippable: () => false,
    reviewSubject: (_context, seat) => formatSeat(seat),
  };
}

export const AVALON_NIGHT_STEP_DEFINITIONS: Readonly<
  Record<AvalonNightStep, AvalonNightStepDefinition>
> = {
  evilReveal: defineRevealStep({
    id: 'evilReveal',
    title: COPY.evilRevealTitle,
    content: (context) =>
      renderCopy(COPY.evilPeers, {
        seats: formatSeatList(
          context.state,
          context.state.nightInfo.evilPeers[requireViewerSeat(context)] ?? [],
        ),
      }),
  }),
  merlinReveal: defineRevealStep({
    id: 'merlinReveal',
    title: COPY.merlinRevealTitle,
    content: (context) =>
      renderCopy(COPY.merlinSees, {
        seats: formatSeatList(context.state, context.state.nightInfo.merlinSees),
      }),
  }),
  percivalReveal: defineRevealStep({
    id: 'percivalReveal',
    title: COPY.percivalRevealTitle,
    content: (context) =>
      renderCopy(COPY.percivalSees, {
        seats: formatSeatList(context.state, context.state.nightInfo.percivalSees),
      }),
  }),
};

/** The night slice that opens the first step of a freshly begun game. */
export function createAvalonNightSlice(): AvalonNightSlice {
  const firstStep = AVALON_NIGHT_STEPS[0];
  if (firstStep === undefined) throw new Error('[FAIL-FAST] Avalon night has no steps');
  return {
    order: [...AVALON_NIGHT_STEPS],
    current: { stepId: firstStep, serial: 0 },
    records: {},
    deadlineMs: null,
  };
}

/** Reads the current night slice; callers only ask during the night phase. */
function requireAvalonNightSlice(state: AvalonState): AvalonNightSlice {
  if (state.phase.kind !== 'night') throw new Error('[FAIL-FAST] Avalon night is not active');
  return state.phase.steps;
}

/** Binds the shared step mechanism to the Avalon night. */
export function createAvalonNightRuntime(): AvalonNightRuntime {
  return {
    definitions: AVALON_NIGHT_STEP_DEFINITIONS,
    getSlice: requireAvalonNightSlice,
    getFacts: () => EMPTY_FACTS,
    createContext: (state, facts, seat, record) => ({ state, facts, seat, record }),
    isAudioPlaying: (state) => state.isAudioPlaying,
    seatedSeats: (state) =>
      Array.from({ length: state.config.numberOfPlayers }, (_, seat) => seat).filter((seat) =>
        isAvalonOccupiedSeat(state, seat),
      ),
  };
}

/** The narration of one step for the dealt roles. */
export function getAvalonNightStepAudio(
  step: AvalonNightStep,
  roles: Readonly<Record<number, AvalonRoleId>>,
): { readonly begin: string; readonly end: string } {
  return AVALON_NIGHT_AUDIO[step](roles);
}

/** Whether one seat has viewed the given night step's information. */
export function hasViewedNightStep(
  state: AvalonState,
  step: AvalonNightStep,
  seat: number,
): boolean {
  if (state.phase.kind !== 'night') return false;
  return (
    state.phase.steps.records[step]?.bySeat[seat]?.submissions.some(
      (submission) => submission.actionKey === AVALON_NIGHT_VIEW_ACTION_KEY,
    ) === true
  );
}

/** Describe a night-step confirmation with the same definitions submission uses. */
export function describeAvalonStepConfirmation(
  state: AvalonState,
  viewerSeat: number,
  selection: Pick<StepSubmission, 'actionKey' | 'seats' | 'cardIndex'>,
): ReturnType<typeof describeStepConfirmation> {
  if (state.phase.kind !== 'night') {
    throw new Error('[FAIL-FAST] Cannot describe an inactive Avalon night step');
  }
  return describeStepConfirmation(createAvalonNightRuntime(), state, viewerSeat, selection);
}
