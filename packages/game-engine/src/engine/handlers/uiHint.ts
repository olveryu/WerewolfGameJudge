/**
 * UI Hint - UI hint computation during night step progression
 *
 * Pure function module. Responsibilities:
 * - Compute whether the next step needs a UI hint (nightmare blocked / wolf_kill_disabled / clear)
 * - Return SET_UI_HINT action
 *
 * Consumed only by handleAdvanceNight. No IO, does not mutate state.
 */

import { getWolfRoleIds, type NightPlanStep, SCHEMAS } from '../../models';
import { BLOCKED_UI_DEFAULTS, type SchemaUi } from '../../models/roles/spec';
import { getEngineLogger } from '../../utils/logger';
import { findSeatByRole } from '../../utils/playerHelpers';
import type { SetUiHintAction } from '../reducer/types';
import type { NonNullState } from './types';

const nightFlowLog = getEngineLogger().extend('NightFlow');

/**
 * Create UI Hint Action
 *
 * Rules:
 * 1. If the next step's actor is blocked by nightmare, set blocked_by_nightmare hint
 * 2. If the next step is wolfVote and wolfKillOverride exists, set wolf_kill_disabled hint
 * 3. Otherwise clear the hint (null)
 *
 * @param nextStep - Next NightPlanStep (null means night ended)
 * @param state - Current game state
 */
export function maybeCreateUiHintAction(
  nextStep: NightPlanStep | null,
  state: NonNullState,
): SetUiHintAction {
  // Night ended or no next step: clear hint
  if (!nextStep) {
    nightFlowLog.debug('nextStep is null, clearing hint');
    return { type: 'SET_UI_HINT', payload: { currentActorHint: null } };
  }

  const { stepId, roleId } = nextStep;
  const schema = SCHEMAS[stepId];

  // DEBUG: Log the hint decision inputs
  const nextActorSeat = findSeatByRole(state.players, roleId);
  nightFlowLog.debug('evaluating UI hint', {
    stepId,
    roleId,
    nextActorSeat,
    nightmareBlockedSeat: state.nightmareBlockedSeat,
    wolfKillOverride: !!state.wolfKillOverride,
    schemaKind: schema?.kind,
  });

  // Schema-driven blocked UI: prefer per-role override from schema.ui, otherwise use defaults
  // Type assertion needed because SCHEMAS uses as const inference; literal type omits optional blocked* fields
  const schemaUi = schema?.ui as Partial<SchemaUi> | undefined;
  const blockedTitle = schemaUi?.blockedTitle ?? BLOCKED_UI_DEFAULTS.title;
  const blockedMessage = schemaUi?.blockedMessage ?? BLOCKED_UI_DEFAULTS.message;
  const blockedSkipButtonText =
    schemaUi?.blockedSkipButtonText ?? BLOCKED_UI_DEFAULTS.skipButtonText;

  // Case 1: wolfVote + wolfKillOverride -> all wolves see wolf_kill_disabled hint
  if (schema?.kind === 'wolfVote' && state.wolfKillOverride) {
    const wolfRoleIds = getWolfRoleIds();
    const { ui } = state.wolfKillOverride;
    nightFlowLog.debug('setting wolf_kill_disabled hint', {
      wolfRoleIds,
      source: state.wolfKillOverride.source,
    });
    return {
      type: 'SET_UI_HINT',
      payload: {
        currentActorHint: {
          kind: 'wolf_kill_disabled',
          targetRoleIds: wolfRoleIds,
          message: ui.emptyVoteText,
          bottomAction: 'wolfEmptyOnly',
          promptOverride: {
            title: ui.promptTitle,
            text: ui.promptMessage,
          },
        },
      },
    };
  }

  // Case 1.5: wolfVote + cupid in template -> all wolves see unanimity hint
  if (schema?.kind === 'wolfVote' && state.templateRoles.includes('cupid')) {
    const wolfRoleIds = getWolfRoleIds();
    nightFlowLog.debug('setting wolf_unanimity_required hint (cupid board)');
    return {
      type: 'SET_UI_HINT',
      payload: {
        currentActorHint: {
          kind: 'wolf_unanimity_required',
          targetRoleIds: wolfRoleIds,
          message: '投票不一致将导致空刀',
        },
      },
    };
  }

  // Case 1.6: wolfVote normal board -> show tie-random-kill hint
  if (schema?.kind === 'wolfVote') {
    const wolfRoleIds = getWolfRoleIds();
    nightFlowLog.debug('setting wolf_tie_random hint (normal board)');
    return {
      type: 'SET_UI_HINT',
      payload: {
        currentActorHint: {
          kind: 'wolf_tie_random',
          targetRoleIds: wolfRoleIds,
          message: '平票将随机刀人',
        },
      },
    };
  }

  // Case 2: next actor is blocked by nightmare
  if (nextActorSeat !== null && state.nightmareBlockedSeat === nextActorSeat) {
    nightFlowLog.debug('setting blocked_by_nightmare hint', { nextActorSeat, roleId });
    return {
      type: 'SET_UI_HINT',
      payload: {
        currentActorHint: {
          kind: 'blocked_by_nightmare',
          targetRoleIds: [roleId], // only the blocked role sees this
          message: blockedSkipButtonText, // text for the skip button
          bottomAction: 'skipOnly',
          promptOverride: {
            title: blockedTitle,
            text: blockedMessage,
          },
        },
      },
    };
  }

  // Case 3: normal step, clear hint
  nightFlowLog.debug('no hint needed, clearing');
  return { type: 'SET_UI_HINT', payload: { currentActorHint: null } };
}
