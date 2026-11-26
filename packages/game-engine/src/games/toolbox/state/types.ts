/**
 * 聚会工具（toolbox）权威状态：无座位、无终局、无奖励的现场道具房间。
 *
 * 成员、准备入座和锁定参与者是三个独立的账号集合；骰子与身份牌是
 * 按开始时启用的工具建立的子状态。权威状态只在 Durable Object 内
 * 持久化，网络上只发送 `ToolboxView`（见 `view.ts`）。
 */

import type { BaseGameState } from '../../../platform/protocol/roomSnapshot';

export const TOOLBOX_GAME_TYPE = 'toolbox' as const;

export const TOOLBOX_TOOLS = ['dice', 'identity'] as const;
export type ToolboxTool = (typeof TOOLBOX_TOOLS)[number];

export const TOOLBOX_DICE_MIN_COUNT = 1;
export const TOOLBOX_DICE_MAX_COUNT = 20;
export const TOOLBOX_DICE_DEFAULT_COUNT = 5;
export const TOOLBOX_DICE_FACES = 6;

/** 身份配置输入上限；客户端与服务端共用同一来源。 */
export const TOOLBOX_IDENTITY_LIMITS = {
  nameMaxLength: 20,
  descriptionMaxLength: 200,
  maxIdentityTypes: 30,
  maxCountPerIdentity: 99,
  maxCardsPerPlayer: 10,
} as const;

export interface ToolboxIdentityDefinition {
  readonly name: string;
  readonly description: string;
  readonly count: number;
}

export interface ToolboxIdentityConfig {
  readonly identities: readonly ToolboxIdentityDefinition[];
  readonly cardsPerPlayer: number;
}

/** 本局公开配置；`tools` 为空只出现在结束返回准备之后，开始前须重新选择。 */
export interface ToolboxConfig {
  readonly tools: readonly ToolboxTool[];
  readonly identity: ToolboxIdentityConfig;
}

export const DEFAULT_TOOLBOX_IDENTITY_CONFIG: ToolboxIdentityConfig = {
  identities: [],
  cardsPerPlayer: 1,
};

export const DEFAULT_TOOLBOX_CONFIG: ToolboxConfig = {
  tools: ['dice'],
  identity: DEFAULT_TOOLBOX_IDENTITY_CONFIG,
};

export interface ToolboxDie {
  /** 本人骰盅内稳定 ID，用于固定切换与无障碍名称。 */
  readonly id: number;
  readonly value: number;
  readonly held: boolean;
}

export const TOOLBOX_DICE_CUP_STAGES = ['unrolled', 'rolled', 'revealed'] as const;
export type ToolboxDiceCupStage = (typeof TOOLBOX_DICE_CUP_STAGES)[number];

export interface ToolboxDiceCup {
  /** 下次摇骰的骰子数量；当前骰子数量在摇骰时才对齐到它。 */
  readonly targetCount: number;
  readonly stage: ToolboxDiceCupStage;
  /** 未摇时为空；摇过后按稳定顺序排列。 */
  readonly dice: readonly ToolboxDie[];
  readonly nextDieId: number;
  /** 每次改变骰盅都递增；命令带预期版本以拒绝迟到操作。 */
  readonly version: number;
}

export interface ToolboxParticipantCup {
  readonly userId: string;
  readonly cup: ToolboxDiceCup;
}

export interface ToolboxHand {
  readonly userId: string;
  /** 按抽取顺序记录的身份下标，指向本轮配置的 `identities`。 */
  readonly identityIndexes: readonly number[];
}

export interface ToolboxIdentityRound {
  readonly roundId: string;
  readonly config: ToolboxIdentityConfig;
  /** 与 `config.identities` 一一对应的共享牌堆剩余数量。 */
  readonly remaining: readonly number[];
  /** 与锁定参与者同序的手牌。 */
  readonly hands: readonly ToolboxHand[];
}

export interface ToolboxPreparingPhase {
  readonly kind: 'preparing';
  /** 按入座先后排列的准备入座账号。 */
  readonly seatedUserIds: readonly string[];
}

export interface ToolboxActivePhase {
  readonly kind: 'active';
  readonly sessionId: string;
  /** 开始瞬间冻结的参与者；成员离开或断线都不改变它。 */
  readonly participantUserIds: readonly string[];
  readonly dice: readonly ToolboxParticipantCup[] | null;
  readonly identity: ToolboxIdentityRound | null;
  /** 本次使用内身份轮次计数，用于生成新的轮次 ID。 */
  readonly identityRoundSequence: number;
}

export type ToolboxPhase = ToolboxPreparingPhase | ToolboxActivePhase;

export interface ToolboxState extends BaseGameState<typeof TOOLBOX_GAME_TYPE> {
  /** 按进入先后排列的房间成员；只有明确离开才移除。 */
  readonly memberUserIds: readonly string[];
  readonly config: ToolboxConfig;
  /** 配置每次变更都递增，开始命令带预期版本。 */
  readonly configVersion: number;
  readonly sessionSequence: number;
  readonly phase: ToolboxPhase;
}

/** 规范化身份或方案名：去除首尾空白并统一为 NFC，重名比较使用该值。 */
export function normalizeToolboxName(name: string): string {
  return name.trim().normalize('NFC');
}

export function countToolboxIdentityCards(config: ToolboxIdentityConfig): number {
  return config.identities.reduce((total, identity) => total + identity.count, 0);
}
