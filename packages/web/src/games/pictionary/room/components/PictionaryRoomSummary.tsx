/** Pictionary lobby summary above the shared seat board. */

import type { PictionaryConfig } from '@game-judge/game-engine/games/pictionary/public';
import type { ReactNode } from 'react';

import { RoomGameSummary } from '@/features/room/components/RoomGameSummary';

function formatDuration(value: number | null): string {
  return value === null ? '不限时' : `${value} 秒`;
}

/** Renders the player count, seated count and drawing time limit. */
export function PictionaryRoomSummary({
  headerRight,
  config,
  occupiedSeatCount,
}: {
  readonly headerRight?: ReactNode;
  readonly config: PictionaryConfig;
  readonly occupiedSeatCount: number;
}) {
  return (
    <RoomGameSummary
      headerRight={headerRight}
      icon="brush-outline"
      title={`你画我猜接龙 · ${config.numberOfPlayers}人局`}
      subtitle={`${occupiedSeatCount}/${config.numberOfPlayers} 人就座 · 绘画 ${formatDuration(config.drawingDurationSeconds)}`}
    />
  );
}
