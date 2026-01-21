/**
 * PlayerActions - 玩家行为接口
 *
 * 定义所有玩家可以执行的行动。
 * - PlayerEngine: 通过网络发送消息给 Host
 * - LocalPlayerAdapter: 本地调用 HostEngine 内部方法
 *
 * 这个接口保证 Host 模式和 Player 模式的行为一致性。
 * 新增玩家行为时，必须在此接口添加方法，TypeScript 会强制两个实现类都更新。
 */

import type { RoleId } from '../../../models/roles';

export interface PlayerActions {
  /**
   * 请求入座
   * @param seat - 座位号 (0-indexed)
   * @param uid - 玩家 UID
   * @param displayName - 显示名称
   * @param avatarUrl - 头像 URL
   * @returns true if request was sent/processed successfully
   */
  takeSeat(seat: number, uid: string, displayName?: string, avatarUrl?: string): Promise<boolean>;

  /**
   * 请求离座
   * @param seat - 座位号 (0-indexed)
   * @param uid - 玩家 UID
   * @returns true if request was sent/processed successfully
   */
  leaveSeat(seat: number, uid: string): Promise<boolean>;

  /**
   * 通知已查看角色
   * @param seat - 座位号 (0-indexed)
   */
  viewedRole(seat: number): Promise<void>;

  /**
   * 提交夜间行动
   * @param seat - 座位号 (0-indexed)
   * @param role - 角色 ID
   * @param target - 目标座位号，null 表示不行动
   * @param extra - 额外数据（如女巫的毒药/解药选择）
   */
  submitAction(
    seat: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ): Promise<void>;

  /**
   * 提交狼人投票
   * @param seat - 座位号 (0-indexed)
   * @param target - 目标座位号
   */
  submitWolfVote(seat: number, target: number): Promise<void>;

  /**
   * 提交揭示确认（预言家/通灵师等看完结果后的确认）
   * @param seat - 座位号 (0-indexed)
   * @param role - 角色 ID
   * @param revision - 状态版本号
   */
  submitRevealAck(seat: number, role: RoleId, revision: number): Promise<void>;
}
