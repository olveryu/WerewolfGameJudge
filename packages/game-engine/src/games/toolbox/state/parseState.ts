/** 工具箱权威状态严格解码：未知字段、缺失字段和类型错误都失败。 */

import {
  finishObject,
  parseArray,
  parseBoolean,
  parseChoice,
  parseInteger,
  parseNonEmptyString,
  parseNullable,
  parseObject,
  parseString,
} from '../../../platform/protocol/runtimeDecoder';
import { normalizeToolboxState } from './normalize';
import {
  TOOLBOX_DICE_CUP_STAGES,
  TOOLBOX_GAME_TYPE,
  TOOLBOX_TOOLS,
  type ToolboxConfig,
  type ToolboxDiceCup,
  type ToolboxDie,
  type ToolboxHand,
  type ToolboxIdentityConfig,
  type ToolboxIdentityDefinition,
  type ToolboxIdentityRound,
  type ToolboxParticipantCup,
  type ToolboxPhase,
  type ToolboxState,
} from './types';

function parseIdentityDefinition(value: unknown, path: string): ToolboxIdentityDefinition {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      name: parseString(raw.name, `${path}.name`),
      description: parseString(raw.description, `${path}.description`),
      count: parseInteger(raw.count, `${path}.count`),
    },
    path,
  );
}

export function parseToolboxIdentityConfig(value: unknown, path: string): ToolboxIdentityConfig {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      identities: parseArray(raw.identities, `${path}.identities`, parseIdentityDefinition),
      cardsPerPlayer: parseInteger(raw.cardsPerPlayer, `${path}.cardsPerPlayer`),
    },
    path,
  );
}

export function parseToolboxConfig(value: unknown, path: string): ToolboxConfig {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      tools: parseArray(raw.tools, `${path}.tools`, (tool, toolPath) =>
        parseChoice(tool, toolPath, TOOLBOX_TOOLS),
      ),
      identity: parseToolboxIdentityConfig(raw.identity, `${path}.identity`),
    },
    path,
  );
}

function parseDie(value: unknown, path: string): ToolboxDie {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      id: parseInteger(raw.id, `${path}.id`),
      value: parseInteger(raw.value, `${path}.value`),
      held: parseBoolean(raw.held, `${path}.held`),
    },
    path,
  );
}

export function parseToolboxDiceCup(value: unknown, path: string): ToolboxDiceCup {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      targetCount: parseInteger(raw.targetCount, `${path}.targetCount`),
      stage: parseChoice(raw.stage, `${path}.stage`, TOOLBOX_DICE_CUP_STAGES),
      dice: parseArray(raw.dice, `${path}.dice`, parseDie),
      nextDieId: parseInteger(raw.nextDieId, `${path}.nextDieId`),
      version: parseInteger(raw.version, `${path}.version`),
    },
    path,
  );
}

function parseUserIds(value: unknown, path: string): string[] {
  return parseArray(value, path, parseNonEmptyString);
}

function parseParticipantCup(value: unknown, path: string): ToolboxParticipantCup {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      userId: parseNonEmptyString(raw.userId, `${path}.userId`),
      cup: parseToolboxDiceCup(raw.cup, `${path}.cup`),
    },
    path,
  );
}

function parseHand(value: unknown, path: string): ToolboxHand {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      userId: parseNonEmptyString(raw.userId, `${path}.userId`),
      identityIndexes: parseArray(raw.identityIndexes, `${path}.identityIndexes`, parseInteger),
    },
    path,
  );
}

function parseIdentityRound(value: unknown, path: string): ToolboxIdentityRound {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      roundId: parseNonEmptyString(raw.roundId, `${path}.roundId`),
      config: parseToolboxIdentityConfig(raw.config, `${path}.config`),
      remaining: parseArray(raw.remaining, `${path}.remaining`, parseInteger),
      hands: parseArray(raw.hands, `${path}.hands`, parseHand),
    },
    path,
  );
}

function parsePhase(value: unknown, path: string): ToolboxPhase {
  const raw = parseObject(value, path);
  const kind = parseChoice(raw.kind, `${path}.kind`, ['preparing', 'active'] as const);
  if (kind === 'preparing') {
    return finishObject(
      raw,
      { kind, seatedUserIds: parseUserIds(raw.seatedUserIds, `${path}.seatedUserIds`) },
      path,
    );
  }
  return finishObject(
    raw,
    {
      kind,
      sessionId: parseNonEmptyString(raw.sessionId, `${path}.sessionId`),
      participantUserIds: parseUserIds(raw.participantUserIds, `${path}.participantUserIds`),
      dice: parseNullable(raw.dice, `${path}.dice`, (dice, dicePath) =>
        parseArray(dice, dicePath, parseParticipantCup),
      ),
      identity: parseNullable(raw.identity, `${path}.identity`, parseIdentityRound),
      identityRoundSequence: parseInteger(
        raw.identityRoundSequence,
        `${path}.identityRoundSequence`,
      ),
    },
    path,
  );
}

/** 解码并校验完整权威状态。 */
export function parseToolboxState(value: unknown): ToolboxState {
  const raw = parseObject(value, 'state');
  return normalizeToolboxState(
    finishObject(
      raw,
      {
        gameType: parseChoice(raw.gameType, 'state.gameType', [TOOLBOX_GAME_TYPE] as const),
        roomCode: parseNonEmptyString(raw.roomCode, 'state.roomCode'),
        hostUserId: parseNonEmptyString(raw.hostUserId, 'state.hostUserId'),
        memberUserIds: parseUserIds(raw.memberUserIds, 'state.memberUserIds'),
        config: parseToolboxConfig(raw.config, 'state.config'),
        configVersion: parseInteger(raw.configVersion, 'state.configVersion'),
        sessionSequence: parseInteger(raw.sessionSequence, 'state.sessionSequence'),
        phase: parsePhase(raw.phase, 'state.phase'),
      },
      'state',
    ),
  );
}
