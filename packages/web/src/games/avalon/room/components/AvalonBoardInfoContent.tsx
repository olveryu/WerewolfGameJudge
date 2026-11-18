/**
 * 阿瓦隆公开角色构成：共享 BoardInfoContent 的阿瓦隆适配器。
 *
 * 分组数据由 adapter 的 createAvalonBoardInfoSections 提供；本组件只做
 * 渲染与 roleId 回映射（把共享卡的 string 压回 AvalonRoleId）。
 */

import type { AvalonRoleId } from '@game-judge/game-engine/games/avalon/public';
import { useMemo } from 'react';

import { BoardInfoContent } from '@/features/room/components/BoardInfoContent';

import { createAvalonBoardInfoSections, isAvalonRoleId } from '../avalonRoomAdapter';

/** Avalon board composition for the room header; renders nothing off the board table. */
export function AvalonBoardInfoContent({
  playerCount,
  onRolePress,
}: {
  readonly playerCount: number;
  readonly onRolePress: (roleId: AvalonRoleId) => void;
}) {
  const sections = useMemo(() => createAvalonBoardInfoSections(playerCount), [playerCount]);

  if (sections === null) return null;

  const handleRolePress = (roleId: string) => {
    if (!isAvalonRoleId(roleId)) throw new Error(`[FAIL-FAST] Invalid avalon role ID: ${roleId}`);
    onRolePress(roleId);
  };

  return <BoardInfoContent sections={sections} onRolePress={handleRolePress} footer={null} />;
}
