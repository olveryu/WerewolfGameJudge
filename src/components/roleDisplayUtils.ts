/**
 * roleDisplayUtils - 角色展示相关共享常量和工具函数
 *
 * 提供角色 emoji 图标映射和阵营名称推导，供多个 RoleCard 组件复用。
 *
 * ✅ 允许：纯数据常量、纯函数（基于 ROLE_SPECS 推导）
 * ❌ 禁止：import service / 副作用 / React hooks / 颜色（颜色由各组件按自身 theme 定义）
 */
import type { RoleId } from '@/models/roles';
import { getRoleSpec, isWolfRole } from '@/models/roles';

/** 角色对应的 emoji 图标（SSOT：所有 RoleCard 组件共用） */
export const ROLE_ICONS: Record<string, string> = {
  // 狼人阵营
  wolf: '🐺',
  wolfKing: '👑🐺',
  darkWolfKing: '🌑👑',
  whiteWolfKing: '⚪👑',
  wolfQueen: '👸🐺',
  nightmare: '😱',
  gargoyle: '🗿',
  wolfRobot: '🤖🐺',
  // 神职阵营
  seer: '🔮',
  witch: '🧙‍♀️',
  hunter: '🏹',
  guard: '🛡️',
  psychic: '👁️',
  dreamcatcher: '🌙',
  magician: '🎩',
  spiritKnight: '⚔️',
  // 平民
  villager: '👤',
  slacker: '😴',
};

/** 根据 roleId 获取阵营中文名称 */
export const getFactionName = (roleId: RoleId): string => {
  if (isWolfRole(roleId)) return '狼人阵营';
  const spec = getRoleSpec(roleId);
  if (spec?.faction === 'god') return '神职阵营';
  return '平民阵营';
};
