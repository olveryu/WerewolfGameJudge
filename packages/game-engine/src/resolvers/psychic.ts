/**
 * Psychic Resolver (HOST-ONLY, 纯函数)
 *
 * 通灵师查验行动：返回精确角色身份（不只是阵营）。
 * 使用 resolveRoleForChecks 统一角色解析（magician swap + wolfRobot disguise）。
 * 不包含 IO（网络 / 音频 / Alert）。
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { createIdentityCheckResolver } from './shared';

export const psychicCheckResolver = createIdentityCheckResolver('psychicCheck');
