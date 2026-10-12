/**
 * 阿瓦隆板子信息卡：共享 BoardInfoCard 的阿瓦隆适配器。
 *
 * 分组数据由 adapter 的 createAvalonBoardInfoSections 提供；本组件只做
 * 渲染与 roleId 回映射（把共享卡的 string 压回 AvalonRoleId）。
 */

import type { AvalonRoleId } from '@game-judge/game-engine/games/avalon/public';
import { useCallback, useMemo } from 'react';

import { BoardInfoCard } from '@/features/room/components/BoardInfoCard';

import { createAvalonBoardInfoSections, isAvalonRoleId } from '../avalonRoomAdapter';

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
  const sections = useMemo(() => createAvalonBoardInfoSections(playerCount), [playerCount]);

  const handleRolePress = useCallback(
    (roleId: string) => {
      if (isAvalonRoleId(roleId)) onRolePress(roleId);
    },
    [onRolePress],
  );

  if (sections === null) return null;

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
