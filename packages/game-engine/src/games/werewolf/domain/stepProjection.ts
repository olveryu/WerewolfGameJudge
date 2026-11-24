import { formatSeat } from '../../../platform/room/formatSeat';
import {
  defineCopy,
  describeStepConfirmation,
  presentStep,
  renderCopy,
  type StepPresentation,
  type StepSubmission,
} from '../../../platform/steps';
import { getWerewolfRoleDefinition } from '../roles/nightPlan';
import {
  createWerewolfStepRuntime,
  planWerewolfGroupBotAcknowledgements,
} from '../roles/nightRuntime';
import { GameStatus } from './models';
import type { GameState } from './protocol/types';

const COPY = defineCopy({
  wolfAbstained: '放弃袭击',
  wolfAttack: '袭击{seat}',
});

export type WerewolfStepSeatStatus =
  { readonly kind: 'ready' } | { readonly kind: 'vote'; readonly label: string };

export interface WerewolfStepView {
  readonly step: StepPresentation | null;
  readonly wolfPackSeats: readonly number[] | null;
  readonly seatStatuses: Readonly<Record<number, WerewolfStepSeatStatus>>;
  readonly canAcknowledgeBots: boolean;
  readonly progressKind: 'vote' | 'confirmation' | null;
}

/** Project only the current viewer's actions and the status they may see. */
export function projectWerewolfStep(
  state: GameState,
  viewerSeat: number | null,
  isHost: boolean,
): WerewolfStepView {
  const night = state.nightState;
  if (state.status !== GameStatus.Ongoing || night === null || night.slice.current === null) {
    return {
      step: null,
      wolfPackSeats: null,
      seatStatuses: {},
      canAcknowledgeBots: false,
      progressKind: null,
    };
  }
  const runtime = createWerewolfStepRuntime(null);
  const step = presentStep(runtime, state, viewerSeat);
  const currentId = night.slice.current.stepId;
  const viewerIdentity = viewerSeat === null ? undefined : night.roles.identities[viewerSeat];
  const viewerRole =
    viewerIdentity === undefined ? null : getWerewolfRoleDefinition(viewerIdentity.currentRole);
  const canSeePack =
    viewerRole !== null &&
    ((currentId === 'wolfKill' && viewerRole.traits.recognition?.participatesInWolfVote === true) ||
      (currentId === 'wolfGirlConfess' && viewerIdentity?.currentRole === 'wolfGirl'));
  const wolfPackSeats = canSeePack
    ? night.roles.seatedSeats.filter((seat) => {
        const identity = night.roles.identities[seat];
        if (identity === undefined) throw new Error(`[FAIL-FAST] Missing night identity ${seat}`);
        return (
          getWerewolfRoleDefinition(identity.currentRole).traits.recognition?.canSeeWolves === true
        );
      })
    : null;
  const seatStatuses: Record<number, WerewolfStepSeatStatus> = {};
  const definition = runtime.definitions[currentId];
  if (definition === undefined) throw new Error(`[FAIL-FAST] Unknown night step ${currentId}`);
  const record = night.slice.records[currentId] ?? { bySeat: {} };
  if (definition.audience === 'allSeats') {
    const viewKeys = new Set(
      definition.actions.filter((action) => action.kind === 'view').map((action) => action.key),
    );
    for (const [seat, entry] of Object.entries(record.bySeat)) {
      if (entry?.submissions.some((submission) => viewKeys.has(submission.actionKey))) {
        seatStatuses[Number(seat)] = { kind: 'ready' };
      }
    }
  }
  if (currentId === 'wolfKill' && canSeePack) {
    for (const vote of night.facts.wolfVotes ?? []) {
      seatStatuses[vote.actorSeat] = {
        kind: 'vote',
        label:
          vote.chosenSeat === null
            ? COPY.wolfAbstained
            : renderCopy(COPY.wolfAttack, { seat: formatSeat(vote.chosenSeat) }),
      };
    }
  }
  return {
    step,
    wolfPackSeats,
    seatStatuses,
    canAcknowledgeBots:
      isHost && !state.isAudioPlaying && planWerewolfGroupBotAcknowledgements(state).length > 0,
    progressKind: definition.actions.some((action) => action.commit === 'revisable')
      ? 'vote'
      : 'confirmation',
  };
}

/** Describe a confirmation using the same role definition as submission. */
export function describeWerewolfStepConfirmation(
  state: GameState,
  viewerSeat: number,
  selection: Pick<StepSubmission, 'actionKey' | 'seats' | 'cardIndex'>,
): ReturnType<typeof describeStepConfirmation> {
  if (state.status !== GameStatus.Ongoing || state.nightState === null) {
    throw new Error('[FAIL-FAST] Cannot describe an inactive night step');
  }
  return describeStepConfirmation(createWerewolfStepRuntime(null), state, viewerSeat, selection);
}
