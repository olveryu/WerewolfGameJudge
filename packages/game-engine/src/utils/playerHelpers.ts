/**
 * Player Iteration Helpers — 消除 Object.entries(state.players) 样板代码
 *
 * 提供三种常用 player 迭代模式的类型安全封装，
 * 避免每次手动 Number.parseInt(seatStr, 10) 转换 key 类型。
 * 仅包含纯函数，不包含 IO。
 */
import type { RoleId } from '../models';
import type { GameStatePayload } from '../protocol/types';

type Players = GameStatePayload['players'];

/** 构建 seat → RoleId 映射（仅含已分配角色的座位） */
export function buildSeatRoleMap(players: Players): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  for (const [seatStr, player] of Object.entries(players)) {
    if (player?.role) {
      map.set(Number.parseInt(seatStr, 10), player.role);
    }
  }
  return map;
}

/** 查找拥有指定角色的座位号（未找到返回 null） */
export function findSeatByRole(players: Players, roleId: RoleId): number | null {
  for (const [seatStr, player] of Object.entries(players)) {
    if (player?.role === roleId) {
      return Number.parseInt(seatStr, 10);
    }
  }
  return null;
}

/** 遍历所有非空座位，回调 (seat, player) */
export function forEachSeatedPlayer(
  players: Players,
  callback: (seat: number, player: NonNullable<Players[number]>) => void,
): void {
  for (const [seatStr, player] of Object.entries(players)) {
    if (player !== null) {
      callback(Number.parseInt(seatStr, 10), player);
    }
  }
}

/**
 * 获取底牌角色（盗贼/盗宝大师）的有效角色。
 *
 * 底牌角色选卡后以所选卡的身份行动（狼人投票、女巫用药等），
 * 但 player.role 始终保留原始角色。此函数统一"原始角色 → 有效角色"映射，
 * 供狼人投票参与判定、UI actioner 判定、推进完成度检查等场景共用。
 *
 * 非底牌角色或尚未选卡时原样返回。
 */
export function getBottomCardEffectiveRole(
  role: RoleId,
  thiefChosenCard?: RoleId | null,
  treasureMasterChosenCard?: RoleId | null,
): RoleId {
  if (role === 'thief' && thiefChosenCard) return thiefChosenCard;
  if (role === 'treasureMaster' && treasureMasterChosenCard) return treasureMasterChosenCard;
  return role;
}

/**
 * treasureMaster 永远不参与 wolfVote（即使选了狼牌也不见面、不投票）。
 * 在所有 wolfVote 消费点使用 originalRole 做排除。
 */
export function isBottomCardWolfVoteExcluded(originalRole: RoleId): boolean {
  return originalRole === 'treasureMaster';
}
