/**
 * 板子信息（BoardInfoCard）的共享数据形状。
 *
 * 游戏在自己的房间组装里构造这些分组数据，共享 BoardInfoCard 负责渲染。
 * （原 SeatGameRoom 契约接口从未被任何游戏实现，已于 2026-10-09 删除。）
 */

/** 通用角色展示项（从 werewolf 抽取）。 */
export interface RoleDisplayItem {
  readonly roleId: string;
  readonly displayName: string;
  readonly count: number;
}

/** 板子信息的一个分组（如"狼人阵营"），BoardInfoCard 渲染用。 */
export interface BoardInfoSection {
  readonly title: string;
  readonly items: readonly RoleDisplayItem[];
  readonly color: string;
}
