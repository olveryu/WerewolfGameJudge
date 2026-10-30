/**
 * buildNightCommand — (model, confirmation) → the public command to submit.
 *
 * The table from interaction shape to `WerewolfActionInput` (six input
 * kinds) and to the three acknowledgement commands. The caller supplies
 * the confirmation the dialog collected (a seat, a seat pair, a set, a
 * card index, a skip / empty vote) and gets a command plus the expected
 * step the engine verifies the action against. An illegal pairing is a
 * dialog bug and throws.
 */

import type {
  SchemaId,
  WerewolfActionInput,
  WerewolfExpectedStep,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';

import type { NightInteractionModel } from './NightInteractionModel';

/** The wire sentinel for a wolf retracting its vote (the resolver removes the record). */
export const WOLF_VOTE_WITHDRAW_TARGET = -2;

export type NightConfirmation =
  | { readonly kind: 'seat'; readonly seat: number }
  | { readonly kind: 'seats'; readonly seats: readonly number[] }
  | { readonly kind: 'card'; readonly cardIndex: number }
  | { readonly kind: 'save' }
  | { readonly kind: 'poison'; readonly seat: number }
  | { readonly kind: 'emptyVote' }
  | { readonly kind: 'withdrawVote' }
  | { readonly kind: 'confirm' }
  | { readonly kind: 'skip' }
  | { readonly kind: 'ack' };

export interface NightStepScope {
  readonly stepId: SchemaId;
  readonly roleRevealRandomNonce: string | null;
}

function illegal(model: NightInteractionModel, confirmation: NightConfirmation): Error {
  return new Error(
    `[FAIL-FAST] Night confirmation ${confirmation.kind} is illegal for ${model.kind}`,
  );
}

/** The action input for an actioner model, or null when the confirmation is an ack. */
function buildActionInput(
  model: NightInteractionModel,
  confirmation: NightConfirmation,
): WerewolfActionInput {
  switch (model.kind) {
    case 'pickSeat':
      if (confirmation.kind === 'seat') return { kind: 'target', target: confirmation.seat };
      if (confirmation.kind === 'skip' && model.skipLabel !== null) return { kind: 'skip' };
      throw illegal(model, confirmation);
    case 'wolfVote':
      if (confirmation.kind === 'seat' && !model.emptyVoteOnly) {
        return { kind: 'target', target: confirmation.seat };
      }
      if (confirmation.kind === 'emptyVote') return { kind: 'target', target: null };
      if (confirmation.kind === 'withdrawVote' && model.myVote !== null) {
        return { kind: 'target', target: WOLF_VOTE_WITHDRAW_TARGET };
      }
      throw illegal(model, confirmation);
    case 'pickTwoSeats':
      if (confirmation.kind === 'seats' && confirmation.seats.length === 2) {
        return { kind: 'multiTarget', targets: [...confirmation.seats] };
      }
      if (confirmation.kind === 'skip' && model.skipLabel !== null) return { kind: 'skip' };
      throw illegal(model, confirmation);
    case 'multiSelect':
      if (
        confirmation.kind === 'seats' &&
        confirmation.seats.length > 0 &&
        confirmation.seats.length <= model.max
      ) {
        return { kind: 'multiTarget', targets: [...confirmation.seats] };
      }
      if (confirmation.kind === 'skip' && model.skipLabel !== null) return { kind: 'skip' };
      throw illegal(model, confirmation);
    case 'witch':
      if (confirmation.kind === 'save' && model.canSave && model.killedSeat !== null) {
        return { kind: 'witch', saveTarget: model.killedSeat, poisonTarget: null };
      }
      if (confirmation.kind === 'poison' && model.canPoison) {
        return { kind: 'witch', saveTarget: null, poisonTarget: confirmation.seat };
      }
      if (confirmation.kind === 'skip') return { kind: 'skip' };
      throw illegal(model, confirmation);
    case 'confirmStatus':
      if (confirmation.kind === 'confirm' && !model.isUnavailable) return { kind: 'confirm' };
      if (confirmation.kind === 'skip' && model.skipLabel !== null) return { kind: 'skip' };
      throw illegal(model, confirmation);
    case 'chooseCard':
      if (confirmation.kind === 'card') {
        const card = model.choice.cards[confirmation.cardIndex];
        if (card === undefined || !card.isSelectable) throw illegal(model, confirmation);
        return { kind: 'card', cardIndex: confirmation.cardIndex };
      }
      throw illegal(model, confirmation);
    case 'skipOnly':
      if (confirmation.kind === 'skip') return { kind: 'skip' };
      throw illegal(model, confirmation);
    case 'ackGroupReveal':
    case 'ackReveal':
    case 'ackHunterStatus':
    case 'idle':
    case 'blocked':
      throw illegal(model, confirmation);
  }
}

/**
 * The command for one confirmed interaction. Actions carry the expected
 * step so a stale submit (the step moved on underneath) is rejected by
 * the engine instead of landing on the wrong step.
 */
export function buildNightCommand(
  model: NightInteractionModel,
  confirmation: NightConfirmation,
  scope: NightStepScope,
): WerewolfPublicCommand {
  switch (model.kind) {
    case 'ackReveal':
      if (confirmation.kind !== 'ack') throw illegal(model, confirmation);
      return { type: 'werewolf.reveal.ack' };
    case 'ackGroupReveal':
      if (confirmation.kind !== 'ack') throw illegal(model, confirmation);
      return { type: 'werewolf.groupConfirm.ack' };
    case 'ackHunterStatus':
      if (confirmation.kind !== 'ack') throw illegal(model, confirmation);
      return { type: 'werewolf.wolfRobot.ackHunterStatus' };
    default: {
      const expectedStep: WerewolfExpectedStep = {
        currentStepId: scope.stepId,
        roleRevealRandomNonce: scope.roleRevealRandomNonce,
      };
      return {
        type: 'werewolf.action.submit',
        input: buildActionInput(model, confirmation),
        expectedStep,
      };
    }
  }
}

/** Whether the command is a recoverable action (durable) or an ack (not replayed). */
export function isDurableNightCommand(command: WerewolfPublicCommand): boolean {
  return command.type === 'werewolf.action.submit';
}
