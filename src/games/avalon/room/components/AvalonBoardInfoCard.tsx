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
import { useCallback, useMemo } from 'react';

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
  readonly onRolePress: (roleId: AvalonRoleId) => void;
  readonly collapsed?: boolean;
  readonly styles: Parameters<typeof BoardInfoCard>[0]['styles'];
}) {
  // Hooks 必须在 early return 之前调用。
  const board = isAvalonPlayerCount(playerCount) ? AVALON_BOARDS[playerCount] : null;

  const idByKey = useMemo(() => {
    const map = new Map<string, AvalonRoleId>();
    if (board !== null) {
      for (const r of board) map.set(r, r);
    }
    return map;
  }, [board]);

  const handleRolePress = useCallback(
    (roleId: string) => {
      const id = idByKey.get(roleId);
      if (id !== undefined) onRolePress(id);
    },
    [idByKey, onRolePress],
  );

  if (board === null) return null;

  const evilRoles = board.filter((r) => getAvalonRoleMeta(r).isEvil);
  const goodSpecial = board.filter((r) => !getAvalonRoleMeta(r).isEvil && r !== 'loyalServant');
  const loyalists = board.filter((r) => r === 'loyalServant');

  // 阿瓦隆文案：坏人/好人/忠臣，而非狼人/神职/村民。
  // 标题用缺省"配置（N人）"，板子信息已展示角色详情。

  return (
    <BoardInfoCard
      playerCount={playerCount}
      wolfRoleItems={toRoleItems(evilRoles)}
      godRoleItems={toRoleItems(goodSpecial)}
      specialRoleItems={[]}
      villagerCount={0}
      villagerRoleItems={toRoleItems(loyalists)}
      collapsed={collapsed}
      onRolePress={handleRolePress}
      sectionLabels={{ wolf: '坏人', god: '好人', villager: '忠臣' }}
      styles={styles}
    />
  );
}
