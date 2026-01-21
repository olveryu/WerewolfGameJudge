/**
 * LocalPlayerAdapter - Host 作为玩家的行为适配器
 *
 * 当 Host 自己也是玩家时，不需要发消息，直接调用 HostEngine 的内部处理方法。
 * 这个类把 PlayerActions 接口适配到 HostEngine 的内部方法。
 *
 * 使用 HostPlayerHandler 接口避免循环依赖。
 */

import type { RoleId } from '../../../models/roles';
import type { PlayerActions } from './PlayerActions';

/**
 * HostPlayerHandler - HostEngine 需要暴露给 LocalPlayerAdapter 的方法
 *
 * 这个接口定义了 HostEngine 处理本地玩家行为的方法。
 * 通过接口解耦，避免 LocalPlayerAdapter 直接依赖 HostEngine 类。
 */
export interface HostPlayerHandler {
  /**
   * 处理本地玩家入座
   */
  handleLocalTakeSeat(
    seat: number,
    uid: string,
    displayName?: string,
    avatarUrl?: string,
  ): Promise<boolean>;

  /**
   * 处理本地玩家离座
   */
  handleLocalLeaveSeat(seat: number, uid: string): Promise<boolean>;

  /**
   * 处理本地玩家已查看角色
   */
  handleLocalViewedRole(seat: number): Promise<void>;

  /**
   * 处理本地玩家提交行动
   */
  handleLocalAction(
    seat: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ): Promise<void>;

  /**
   * 处理本地玩家狼人投票
   */
  handleLocalWolfVote(seat: number, target: number): Promise<void>;

  /**
   * 处理本地玩家揭示确认
   */
  handleLocalRevealAck(seat: number, role: RoleId, revision: number): Promise<void>;
}

/**
 * LocalPlayerAdapter - 实现 PlayerActions 接口
 *
 * 所有方法都委托给 HostPlayerHandler（即 HostEngine）处理。
 */
export class LocalPlayerAdapter implements PlayerActions {
  constructor(private readonly hostHandler: HostPlayerHandler) {}

  async takeSeat(
    seat: number,
    uid: string,
    displayName?: string,
    avatarUrl?: string,
  ): Promise<boolean> {
    return this.hostHandler.handleLocalTakeSeat(seat, uid, displayName, avatarUrl);
  }

  async leaveSeat(seat: number, uid: string): Promise<boolean> {
    return this.hostHandler.handleLocalLeaveSeat(seat, uid);
  }

  async viewedRole(seat: number): Promise<void> {
    await this.hostHandler.handleLocalViewedRole(seat);
  }

  async submitAction(
    seat: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ): Promise<void> {
    await this.hostHandler.handleLocalAction(seat, role, target, extra);
  }

  async submitWolfVote(seat: number, target: number): Promise<void> {
    await this.hostHandler.handleLocalWolfVote(seat, target);
  }

  async submitRevealAck(seat: number, role: RoleId, revision: number): Promise<void> {
    await this.hostHandler.handleLocalRevealAck(seat, role, revision);
  }
}
