/**
 * PureWhite Resolver (SERVER-ONLY, 纯函数)
 *
 * 纯白之女查验行动：返回精确角色身份（不只是阵营）。
 * Night-1 scope: 仅查验身份，"从第二夜起查验出局"不在当前 scope。
 * 不包含 IO（网络 / 音频 / Alert）。
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { createIdentityCheckResolver } from './shared';

export const pureWhiteCheckResolver = createIdentityCheckResolver('pureWhiteCheck');
