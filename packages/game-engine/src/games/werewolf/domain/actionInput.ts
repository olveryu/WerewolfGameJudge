/** Convert canonical Werewolf action commands into the existing pure handler intent. */

import type { WerewolfActionInput } from '../commands/types';
import type { SubmitActionIntent } from './intents/types';
import { type ActionSchema, SCHEMAS } from './models';
import type { GameState } from './protocol/types';

export const REASON_ACTION_INPUT_MISMATCH = 'action_input_mismatch' as const;

export type SubmitActionIntentResolution =
  | { readonly kind: 'resolved'; readonly intent: SubmitActionIntent }
  | { readonly kind: 'rejected'; readonly reason: string };

type WerewolfActionInputKind = WerewolfActionInput['kind'];

function expectedInputKind(schema: ActionSchema): WerewolfActionInputKind | null {
  switch (schema.kind) {
    case 'chooseSeat':
    case 'wolfVote':
    case 'confirmTarget':
      return 'target';
    case 'swap':
    case 'multiChooseSeat':
      return 'multiTarget';
    case 'confirm':
      return 'confirm';
    case 'compound':
      return 'witch';
    case 'chooseCard':
      return 'card';
    case 'skip':
      return 'skip';
    case 'groupConfirm':
      return null;
    default: {
      const exhaustive: never = schema;
      return exhaustive;
    }
  }
}

export function resolveSubmitActionIntent(
  state: GameState,
  actorSeat: number,
  input: WerewolfActionInput,
): SubmitActionIntentResolution {
  const stepId = state.currentStepId;
  if (stepId === undefined) {
    return { kind: 'rejected', reason: 'invalid_step' };
  }

  const schema = SCHEMAS[stepId];
  if (schema === undefined) {
    return { kind: 'rejected', reason: 'invalid_step' };
  }
  const expectedKind = expectedInputKind(schema);
  const isCanonicalSkip = input.kind === 'skip' && schema.kind !== 'groupConfirm';
  if (!isCanonicalSkip && (expectedKind === null || expectedKind !== input.kind)) {
    return { kind: 'rejected', reason: REASON_ACTION_INPUT_MISMATCH };
  }

  const hasDuplicateSkipEncoding =
    (input.kind === 'target' && input.target === null && schema.kind !== 'wolfVote') ||
    (input.kind === 'multiTarget' && input.targets.length === 0) ||
    (input.kind === 'witch' && input.saveTarget === null && input.poisonTarget === null);
  if (hasDuplicateSkipEncoding) {
    return { kind: 'rejected', reason: REASON_ACTION_INPUT_MISMATCH };
  }

  const player = state.players[actorSeat];
  if (player == null) {
    throw new Error(`[FAIL-FAST] Resolved action actor seat ${actorSeat} is empty`);
  }
  if (player.role == null) {
    throw new Error(`[FAIL-FAST] Resolved action actor seat ${actorSeat} has no assigned role`);
  }

  switch (input.kind) {
    case 'target':
      return {
        kind: 'resolved',
        intent: {
          type: 'SUBMIT_ACTION',
          payload: { seat: actorSeat, role: player.role, target: input.target },
        },
      };
    case 'multiTarget':
      return {
        kind: 'resolved',
        intent: {
          type: 'SUBMIT_ACTION',
          payload: {
            seat: actorSeat,
            role: player.role,
            target: null,
            extra: { targets: [...input.targets] },
          },
        },
      };
    case 'confirm':
      return {
        kind: 'resolved',
        intent: {
          type: 'SUBMIT_ACTION',
          payload: {
            seat: actorSeat,
            role: player.role,
            target: null,
            extra: { confirmed: true },
          },
        },
      };
    case 'witch':
      return {
        kind: 'resolved',
        intent: {
          type: 'SUBMIT_ACTION',
          payload: {
            seat: actorSeat,
            role: player.role,
            target: actorSeat,
            extra: {
              stepResults: {
                save: input.saveTarget,
                poison: input.poisonTarget,
              },
            },
          },
        },
      };
    case 'card':
      return {
        kind: 'resolved',
        intent: {
          type: 'SUBMIT_ACTION',
          payload: {
            seat: actorSeat,
            role: player.role,
            target: null,
            extra: { cardIndex: input.cardIndex },
          },
        },
      };
    case 'skip':
      return {
        kind: 'resolved',
        intent: {
          type: 'SUBMIT_ACTION',
          payload: { seat: actorSeat, role: player.role, target: null },
        },
      };
    default: {
      const exhaustive: never = input;
      return exhaustive;
    }
  }
}
