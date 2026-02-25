/**
 * WolfWitch Resolver (SERVER-ONLY, 纯函数)
 *
 * 狼巫查验行动：返回精确角色身份（不只是阵营）。
 * 约束：不能查验狼人阵营的玩家（notWolfFaction — 需传 players 给 constraint 校验）。
 * Night-1 scope: 仅查验身份，"从第二夜起验到纯白出局"不在当前 scope。
 * 不包含 IO（网络 / 音频 / Alert）。
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { createIdentityCheckResolver } from './shared';

export const wolfWitchCheckResolver = createIdentityCheckResolver('wolfWitchCheck', {
  passPlayersToConstraints: true,
});
