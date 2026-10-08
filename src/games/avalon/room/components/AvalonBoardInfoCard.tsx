/**
 * 阿瓦隆板子信息卡：共享 BoardInfoCard 的阿瓦隆适配器。
 *
 * 阿瓦隆只有两个阵营：好人 / 坏人。
 * 忠臣是普通好人，不单独分组。
 */

import {
  AVALON_BOARDS,
  type AvalonRoleId,
  isAvalonPlayerCount,
} from '@game-judge/game-engine/games/avalon/public';
import { useCallback, useMemo } from 'react';

import { BoardInfoCard, type BoardInfoSection } from '@/features/room/components/BoardInfoCard';
import type { RoleDisplayItem } from '@/features/room/model/SeatGameRoom';
import { colors } from '@/theme';

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

  const sections = useMemo((): readonly BoardInfoSection[] => {
    if (board === null) return [];
    const evilRoles = board.filter((r) => getAvalonRoleMeta(r).isEvil);
    const goodRoles = board.filter((r) => !getAvalonRoleMeta(r).isEvil);
    return [
      { title: '坏人', items: toRoleItems(evilRoles), color: colors.wolf },
      { title: '好人', items: toRoleItems(goodRoles), color: colors.god },
    ];
  }, [board]);

  if (board === null) return null;

  return (
    <BoardInfoCard
      playerCount={playerCount}
      sections={sections}
      collapsed={collapsed}
      onRolePress={handleRolePress}
      styles={styles}
    />
  );
}
