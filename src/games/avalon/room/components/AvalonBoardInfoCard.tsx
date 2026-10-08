/**
 * 阿瓦隆板子信息卡：共享 BoardInfoCard 的阿瓦隆适配器。
 *
 * 把阿瓦隆板子数据（AVALON_BOARDS）转成共享版 props 格式。
 * 映射：坏人→wolfRoleItems，好人特殊→godRoleItems，忠臣→villagerRoleItems。
 * （共享版 props 仍是 werewolf 命名，真正泛化是后续任务）
 */

import {
  AVALON_BOARDS,
  type AvalonRoleId,
  isAvalonPlayerCount,
} from '@game-judge/game-engine/games/avalon/public';

import { BoardInfoCard } from '@/features/room/components/BoardInfoCard';
import type { RoleDisplayItem } from '@/features/room/model/SeatGameRoom';

import { getAvalonRoleDisplayName } from '../../model/avalonRoleDisplay';
import { getAvalonRoleMeta } from '../../model/avalonRoleMeta';

function toRoleItems(roles: readonly AvalonRoleId[]): RoleDisplayItem[] {
  const counts = new Map<AvalonRoleId, number>();
  for (const roleId of roles) {
    counts.set(roleId, (counts.get(roleId) ?? 0) + 1);
  }
  return [...counts.entries()].map(([roleId, count]) => ({
    roleId,
    displayName: getAvalonRoleDisplayName(roleId),
    count,
  }));
}

export function AvalonBoardInfoCard({
  playerCount,
  onRolePress,
  collapsed = false,
  styles,
}: {
  readonly playerCount: number;
  readonly onRolePress: (roleId: string) => void;
  readonly collapsed?: boolean;
  readonly styles: Parameters<typeof BoardInfoCard>[0]['styles'];
}) {
  if (!isAvalonPlayerCount(playerCount)) return null;
  const board = AVALON_BOARDS[playerCount];

  const evilRoles = board.filter((r) => getAvalonRoleMeta(r).isEvil);
  const goodSpecial = board.filter((r) => !getAvalonRoleMeta(r).isEvil && r !== 'loyalServant');
  const loyalists = board.filter((r) => r === 'loyalServant');

  return (
    <BoardInfoCard
      playerCount={playerCount}
      wolfRoleItems={toRoleItems(evilRoles)}
      godRoleItems={toRoleItems(goodSpecial)}
      specialRoleItems={[]}
      villagerCount={0}
      villagerRoleItems={toRoleItems(loyalists)}
      collapsed={collapsed}
      onRolePress={onRolePress}
      styles={styles}
    />
  );
}
