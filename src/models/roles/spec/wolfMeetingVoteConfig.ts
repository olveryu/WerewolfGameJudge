/**
 * Wolf Meeting Vote Configuration
 *
 * 这个配置 **只限制** WOLF_VOTE（狼人会议投票目标），
 * **不影响** wolfKill 的 neutral judge 红线。
 *
 * 红线：wolfKill 可 target ANY seat（包括自刀/队友/恶灵骑士）。
 * 这里的禁投规则仅用于 handleWolfVote 的 meeting vote 场景。
 */

import type { RoleId } from './specs';

export const WOLF_MEETING_VOTE_CONFIG = {
  /**
   * 狼人会议投票时不能选择的目标角色
   * - spiritKnight: 恶灵骑士（狼人阵营，不可被投）
   * - wolfQueen: 狼王后（狼人阵营，不可被投）
   */
  forbiddenTargetRoleIds: ['spiritKnight', 'wolfQueen'] as const satisfies readonly RoleId[],
} as const;
