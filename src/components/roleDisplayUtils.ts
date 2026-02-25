/**
 * roleDisplayUtils - 角色展示相关共享工具函数
 *
 * 提供阵营名称推导，供多个 RoleCard 组件复用。
 * 导出纯函数（基于 ROLE_SPECS 推导）。
 * 不 import service，不含副作用或 React hooks。颜色由各组件按自身 theme 定义。
 *
 * 角色 emoji 已内聚到 RoleSpec.emoji（SSOT），通过 getRoleEmoji() 获取。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { getRoleSpec, isWolfRole } from '@werewolf/game-engine/models/roles';
import { Faction } from '@werewolf/game-engine/models/roles/spec/types';

/** 根据 roleId 获取阵营中文名称 */
export const getFactionName = (roleId: RoleId): string => {
  if (isWolfRole(roleId)) return '狼人阵营';
  const spec = getRoleSpec(roleId);
  if (spec?.faction === Faction.God) return '神职阵营';
  if (spec?.faction === Faction.Special) return '第三方阵营';
  return '平民阵营';
};
