/**
 * 有座位游戏的 UI 契约（2026-10-07）。
 *
 * 游戏只提供数据，框架负责渲染。实现此接口的游戏自动获得一致的 UI，
 * 无需自己写 BoardInfoCard、接管横幅等组件。
 *
 * 顺序：契约 → 共享组件 → 游戏接入。先有契约，后抽实现。
 */

import type { RoomSeatDataSource } from './RoomSeatDataSource';

/** 通用角色展示项（从 werewolf 抽取）。 */
export interface RoleDisplayItem {
  readonly roleId: string;
  readonly displayName: string;
  readonly count: number;
}

/** 板子信息的一个分组（如"狼人阵营"）。 */
export interface BoardInfoSection {
  /** 分组标题，如"狼人阵营"。 */
  readonly title: string;
  /** 角色 chip 列表，如 [{ name: '狼人', count: 4 }]。 */
  readonly roles: readonly BoardInfoRole[];
  /** chip 底色调。 */
  readonly tone: 'danger' | 'primary' | 'success' | 'muted';
}

export interface BoardInfoRole {
  readonly name: string;
  /** 数量，1 则不显示 ×N。 */
  readonly count: number;
}

/** 机器人接管配置。 */
export interface TakeoverConfig {
  /** 是否允许当前用户接管。 */
  readonly canControl: boolean;
  /** 当前接管的座位，null 表示未接管。 */
  readonly controlledSeat: number | null;
  /** 接管/释放回调。 */
  readonly onTakeOver: (seat: number) => void;
  readonly onRelease: () => void;
}

/**
 * 有座位游戏必须实现的 UI 数据契约。
 *
 * - werewolf/avalon/fibking/undercover 实现此接口
 * - 框架用这些数据渲染共享 UI（BoardInfoCard、ControlledSeatBanner 等）
 * - 游戏不直接写这些 UI 组件
 *
 * 注意：boardInfo 目前为规划中。现有的 BoardInfoCard 仍是 werewolf 专有 props，
 * 泛化为接受 BoardInfoSection[] 是后续任务。
 */
export interface SeatGameRoom {
  /** 板子信息：这局有什么角色。（规划中，暂未消费） */
  readonly boardInfo: readonly BoardInfoSection[];
  /** 座位数据源：座位盘渲染用。 */
  readonly seatDataSource: RoomSeatDataSource;
  /** 机器人接管配置。 */
  readonly takeover: TakeoverConfig;
}
