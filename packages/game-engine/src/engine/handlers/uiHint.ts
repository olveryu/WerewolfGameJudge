/**
 * UI Hint - 夜晚步骤推进时的 UI 提示计算
 *
 * 纯函数模块，负责：
 * - 计算下一步是否需要 UI hint（nightmare blocked / wolf_kill_disabled / 清空）
 * - 返回 SET_UI_HINT action
 *
 * 仅被 handleAdvanceNight 消费。不含 IO，不修改 state。
 */

import { getWolfRoleIds, type NightPlanStep, SCHEMAS } from '../../models';
import { BLOCKED_UI_DEFAULTS, type SchemaUi } from '../../models/roles/spec';
import { getEngineLogger } from '../../utils/logger';
import { findSeatByRole } from '../../utils/playerHelpers';
import type { SetUiHintAction } from '../reducer/types';
import type { NonNullState } from './types';

const nightFlowLog = getEngineLogger().extend('NightFlow');

/**
 * 创建 UI Hint Action
 *
 * 规则：
 * 1. 如果下一步的行动者被 nightmare 封锁，设置 blocked_by_nightmare hint
 * 2. 如果下一步是 wolfVote 且 wolfKillOverride 存在，设置 wolf_kill_disabled hint
 * 3. 其他情况清空 hint（null）
 *
 * @param nextStep - 下一步的 NightPlanStep（null 表示夜晚结束）
 * @param state - 当前游戏状态
 */
export function maybeCreateUiHintAction(
  nextStep: NightPlanStep | null,
  state: NonNullState,
): SetUiHintAction {
  // 夜晚结束或没有下一步：清空 hint
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

  // Schema-driven blocked UI: 优先使用 schema.ui 的 per-role 覆盖，否则用默认值
  // 使用类型断言因为 SCHEMAS 使用 as const 推断，字面量类型不含可选的 blocked* 字段
  const schemaUi = schema?.ui as Partial<SchemaUi> | undefined;
  const blockedTitle = schemaUi?.blockedTitle ?? BLOCKED_UI_DEFAULTS.title;
  const blockedMessage = schemaUi?.blockedMessage ?? BLOCKED_UI_DEFAULTS.message;
  const blockedSkipButtonText =
    schemaUi?.blockedSkipButtonText ?? BLOCKED_UI_DEFAULTS.skipButtonText;

  // Case 1: wolfVote 且 wolfKillOverride → 所有狼人看到 wolf_kill_disabled hint
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

  // Case 1.5: wolfVote 且 cupid 在模板中 → 所有狼人看到一致性提示
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

  // Case 2: 下一步行动者被 nightmare 封锁
  if (nextActorSeat !== null && state.nightmareBlockedSeat === nextActorSeat) {
    nightFlowLog.debug('setting blocked_by_nightmare hint', { nextActorSeat, roleId });
    return {
      type: 'SET_UI_HINT',
      payload: {
        currentActorHint: {
          kind: 'blocked_by_nightmare',
          targetRoleIds: [roleId], // 只有被封锁的角色能看到
          message: blockedSkipButtonText, // 用于 skip 按钮文案
          bottomAction: 'skipOnly',
          promptOverride: {
            title: blockedTitle,
            text: blockedMessage,
          },
        },
      },
    };
  }

  // Case 3: 正常步骤，清空 hint
  nightFlowLog.debug('no hint needed, clearing');
  return { type: 'SET_UI_HINT', payload: { currentActorHint: null } };
}
