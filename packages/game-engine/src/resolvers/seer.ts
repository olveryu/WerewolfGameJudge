/**
 * Seer Resolver (HOST-ONLY, 纯函数)
 *
 * 预言家查验行动：返回目标阵营（好人/狼人）。
 * 使用 resolveRoleForChecks 统一角色解析（magician swap + wolfRobot disguise）。
 * 不包含 IO（网络 / 音频 / Alert）。
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { createSeerCheckResolver } from './shared';

/** Seer: 原样返回查验结果 */
export const seerCheckResolver = createSeerCheckResolver('seerCheck', (result) => result);
