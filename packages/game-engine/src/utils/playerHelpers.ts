/**
 * Player Iteration Helpers — 消除 Object.entries(state.players) 样板代码
 *
 * 提供三种常用 player 迭代模式的类型安全封装，
 * 避免每次手动 Number.parseInt(seatStr, 10) 转换 key 类型。
 * 仅包含纯函数，不包含 IO。
 */
import type { RoleId } from '../models/roles';
import type { GameState } from '../protocol/types';

type Players = GameState['players'];

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
