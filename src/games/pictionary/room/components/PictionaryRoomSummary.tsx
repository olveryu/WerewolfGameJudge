/** Pictionary lobby summary above the shared seat board. */

import type { PictionaryConfig } from '@game-judge/game-engine/games/pictionary/public';
import type React from 'react';

import { RoomGameSummary } from '@/features/room/components/RoomGameSummary';

interface PictionaryRoomSummaryProps {
  readonly headerRight?: React.ReactNode;
  readonly config: PictionaryConfig;
  readonly occupiedSeatCount: number;
}

function formatDuration(value: number | null): string {
  return value === null ? '不限时' : `${value}秒`;
}

export const PictionaryRoomSummary: React.FC<PictionaryRoomSummaryProps> = ({
  headerRight,
  config,
  occupiedSeatCount,
}) => (
  <RoomGameSummary
    headerRight={headerRight}
    icon="brush-outline"
    title={`你画我猜接龙 · ${config.numberOfPlayers}人局`}
    subtitle={`${occupiedSeatCount}/${config.numberOfPlayers} 人就座 · 画画 ${formatDuration(config.drawingDurationSeconds)}`}
  />
);
