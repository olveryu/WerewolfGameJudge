/** 聚会工具 Worker 边界的严格外部 schema。规则校验由引擎完成。 */

import {
  isStorableToolboxIdentityConfig,
  isUsableToolboxIdentityConfig,
  TOOLBOX_TOOLS,
  type ToolboxCommand,
  type ToolboxConfig,
  type ToolboxEffect,
  type ToolboxIdentityConfig,
  type ToolboxPublicCommand,
} from '@game-judge/game-engine/games/toolbox/public';
import { z } from 'zod';

import { definePublicCommandOptions } from '../../platform/room/commandOptions';

// 字段顺序与引擎解析结果一致：房间状态会在重新解析后按 JSON 字节比较。
export const toolboxIdentityConfigSchema: z.ZodType<ToolboxIdentityConfig> = z.strictObject({
  identities: z.array(
    z.strictObject({
      name: z.string(),
      description: z.string(),
      count: z.int(),
    }),
  ),
  cardsPerPlayer: z.int(),
});

const toolboxConfigSchema: z.ZodType<ToolboxConfig> = z.strictObject({
  tools: z.array(z.enum(TOOLBOX_TOOLS)),
  identity: toolboxIdentityConfigSchema,
});

function isCreatableToolboxConfig(config: ToolboxConfig): boolean {
  const canonicalTools = TOOLBOX_TOOLS.filter((tool) => config.tools.includes(tool));
  return (
    config.tools.length > 0 &&
    canonicalTools.length === config.tools.length &&
    canonicalTools.every((tool, index) => config.tools[index] === tool) &&
    isStorableToolboxIdentityConfig(config.identity) &&
    (!config.tools.includes('identity') || isUsableToolboxIdentityConfig(config.identity))
  );
}

/** 建房配置：至少一个规范顺序的工具，身份配置可存储；启用身份时须可用。 */
export const toolboxCreateConfigSchema: z.ZodType<ToolboxConfig> = toolboxConfigSchema.refine(
  isCreatableToolboxConfig,
  { message: 'Invalid toolbox config' },
);

const cupVersionSchema = z.int().nonnegative();

const toolboxPublicCommandOptions = definePublicCommandOptions<ToolboxPublicCommand>()([
  z.strictObject({ type: z.literal('toolbox.member.join') }),
  z.strictObject({ type: z.literal('toolbox.member.leave') }),
  z.strictObject({ type: z.literal('toolbox.seat.take') }),
  z.strictObject({ type: z.literal('toolbox.seat.release') }),
  z.strictObject({ type: z.literal('toolbox.seats.clear') }),
  z.strictObject({ type: z.literal('toolbox.config.update'), config: toolboxConfigSchema }),
  z.strictObject({
    type: z.literal('toolbox.session.begin'),
    configVersion: z.int().nonnegative(),
  }),
  z.strictObject({ type: z.literal('toolbox.session.end'), sessionId: z.string().min(1) }),
  z.strictObject({
    type: z.literal('toolbox.dice.setCount'),
    count: z.int(),
    cupVersion: cupVersionSchema,
  }),
  z.strictObject({ type: z.literal('toolbox.dice.roll'), cupVersion: cupVersionSchema }),
  z.strictObject({ type: z.literal('toolbox.dice.reveal'), cupVersion: cupVersionSchema }),
  z.strictObject({
    type: z.literal('toolbox.dice.toggleHold'),
    dieId: z.int().nonnegative(),
    cupVersion: cupVersionSchema,
  }),
  z.strictObject({ type: z.literal('toolbox.identity.draw'), sessionId: z.string().min(1) }),
]);

export const toolboxPublicCommandSchema: z.ZodType<ToolboxPublicCommand> = z.discriminatedUnion(
  'type',
  toolboxPublicCommandOptions,
);

/** 工具箱没有系统命令：无计时、无结算、无机器人。 */
export const toolboxInternalCommandSchema: z.ZodType<
  Exclude<ToolboxCommand, ToolboxPublicCommand>
> = z.never();

/** 工具箱不产生副作用：没有完成事件、奖励或统计。 */
export const toolboxEffectSchema: z.ZodType<ToolboxEffect> = z.never();
