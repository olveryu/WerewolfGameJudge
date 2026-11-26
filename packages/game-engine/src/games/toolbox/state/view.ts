/**
 * 工具箱网络视图：公开配置、计数和当前用户本人的状态。不含其他人的
 * 骰盅或手牌、分类剩余数、参与名单或随机种子。
 *
 * 本人数据「缺席」（观众、工具未启用）用 `null` 或 `spectator` 表示，
 * 与「尚未摇/尚未抽」（空骰盅、空手牌）严格区分。
 */

import type { BaseGameState } from '../../../platform/protocol/roomSnapshot';
import {
  failDecode,
  finishObject,
  parseArray,
  parseBoolean,
  parseChoice,
  parseInteger,
  parseNonEmptyString,
  parseNullable,
  parseObject,
} from '../../../platform/protocol/runtimeDecoder';
import { isStorableToolboxConfig } from '../domain/config';
import { parseToolboxConfig, parseToolboxDiceCup, parseToolboxIdentityConfig } from './parseState';
import {
  TOOLBOX_GAME_TYPE,
  type ToolboxConfig,
  type ToolboxDiceCup,
  type ToolboxIdentityConfig,
} from './types';

export interface ToolboxIdentityRoundView {
  readonly config: ToolboxIdentityConfig;
  /** 仅公开总剩余张数。 */
  readonly remainingTotal: number;
}

export type ToolboxParticipationView =
  | { readonly kind: 'spectator' }
  | {
      readonly kind: 'participant';
      /** 未启用骰子时为 null。 */
      readonly dice: ToolboxDiceCup | null;
      /** 未启用身份时为 null；空数组表示尚未抽牌。 */
      readonly hand: readonly number[] | null;
    };

export type ToolboxPhaseView =
  | {
      readonly kind: 'preparing';
      readonly seatedCount: number;
      readonly isViewerSeated: boolean;
    }
  | {
      readonly kind: 'active';
      readonly sessionId: string;
      readonly participantCount: number;
      readonly identity: ToolboxIdentityRoundView | null;
      readonly participation: ToolboxParticipationView;
    };

export interface ToolboxView extends BaseGameState<typeof TOOLBOX_GAME_TYPE> {
  readonly viewerUserId: string;
  readonly isViewerMember: boolean;
  readonly memberCount: number;
  readonly config: ToolboxConfig;
  readonly configVersion: number;
  readonly phase: ToolboxPhaseView;
}

function parseNonNegativeInteger(value: unknown, path: string): number {
  const parsed = parseInteger(value, path);
  return parsed >= 0 ? parsed : failDecode(path, 'a non-negative integer');
}

function parseParticipation(value: unknown, path: string): ToolboxParticipationView {
  const raw = parseObject(value, path);
  const kind = parseChoice(raw.kind, `${path}.kind`, ['spectator', 'participant'] as const);
  if (kind === 'spectator') return finishObject(raw, { kind }, path);
  return finishObject(
    raw,
    {
      kind,
      dice: parseNullable(raw.dice, `${path}.dice`, parseToolboxDiceCup),
      hand: parseNullable(raw.hand, `${path}.hand`, (hand, handPath) =>
        parseArray(hand, handPath, parseNonNegativeInteger),
      ),
    },
    path,
  );
}

function parseIdentityRoundView(value: unknown, path: string): ToolboxIdentityRoundView {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      config: parseToolboxIdentityConfig(raw.config, `${path}.config`),
      remainingTotal: parseNonNegativeInteger(raw.remainingTotal, `${path}.remainingTotal`),
    },
    path,
  );
}

function parsePhaseView(value: unknown, path: string, config: ToolboxConfig): ToolboxPhaseView {
  const raw = parseObject(value, path);
  const kind = parseChoice(raw.kind, `${path}.kind`, ['preparing', 'active'] as const);
  if (kind === 'preparing') {
    return finishObject(
      raw,
      {
        kind,
        seatedCount: parseNonNegativeInteger(raw.seatedCount, `${path}.seatedCount`),
        isViewerSeated: parseBoolean(raw.isViewerSeated, `${path}.isViewerSeated`),
      },
      path,
    );
  }
  const phase = finishObject(
    raw,
    {
      kind,
      sessionId: parseNonEmptyString(raw.sessionId, `${path}.sessionId`),
      participantCount: parseNonNegativeInteger(raw.participantCount, `${path}.participantCount`),
      identity: parseNullable(raw.identity, `${path}.identity`, parseIdentityRoundView),
      participation: parseParticipation(raw.participation, `${path}.participation`),
    },
    path,
  );
  if (phase.participantCount === 0) failDecode(`${path}.participantCount`, 'positive');
  if ((phase.identity !== null) !== config.tools.includes('identity')) {
    failDecode(`${path}.identity`, 'present exactly when the identity tool is enabled');
  }
  if (phase.participation.kind === 'participant') {
    if ((phase.participation.dice !== null) !== config.tools.includes('dice')) {
      failDecode(`${path}.participation.dice`, 'present exactly when dice are enabled');
    }
    if ((phase.participation.hand !== null) !== (phase.identity !== null)) {
      failDecode(`${path}.participation.hand`, 'present exactly when identity is enabled');
    }
  }
  return phase;
}

/** 严格解码按用户投影后的视图。 */
export function parseToolboxView(value: unknown): ToolboxView {
  const raw = parseObject(value, 'view');
  const config = parseToolboxConfig(raw.config, 'view.config');
  if (!isStorableToolboxConfig(config)) failDecode('view.config', 'a valid toolbox configuration');
  return finishObject(
    raw,
    {
      gameType: parseChoice(raw.gameType, 'view.gameType', [TOOLBOX_GAME_TYPE] as const),
      roomCode: parseNonEmptyString(raw.roomCode, 'view.roomCode'),
      hostUserId: parseNonEmptyString(raw.hostUserId, 'view.hostUserId'),
      viewerUserId: parseNonEmptyString(raw.viewerUserId, 'view.viewerUserId'),
      isViewerMember: parseBoolean(raw.isViewerMember, 'view.isViewerMember'),
      memberCount: parseNonNegativeInteger(raw.memberCount, 'view.memberCount'),
      config,
      configVersion: parseNonNegativeInteger(raw.configVersion, 'view.configVersion'),
      phase: parsePhaseView(raw.phase, 'view.phase', config),
    },
    'view',
  );
}
