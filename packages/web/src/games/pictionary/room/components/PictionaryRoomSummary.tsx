/** Pictionary lobby summary above the shared seat board. */

import type { PictionaryConfig } from '@game-judge/game-engine/games/pictionary/public';
import type { ComponentProps } from 'react';

import { RoomGameSummary } from '@/features/room/components/RoomGameSummary';

function formatDuration(value: number | null): string {
  return value === null ? '不限时' : `${value} 秒`;
}

/** Renders the player count, seated count and drawing time limit. */
export function PictionaryRoomSummary({
  guide,
  config,
  occupiedSeatCount,
}: {
  readonly guide: ComponentProps<typeof RoomGameSummary>['guide'];
  readonly config: PictionaryConfig;
  readonly occupiedSeatCount: number;
}) {
  return (
    <RoomGameSummary
      guide={guide}
      title="你画我猜接龙"
      playerCount={config.numberOfPlayers}
      settings={[{ label: '绘画时限', value: formatDuration(config.drawingDurationSeconds) }]}
      status={`${occupiedSeatCount}/${config.numberOfPlayers} 人就座`}
    />
  );
}
