/** Pictionary lobby summary above the shared seat board. */

import type { PictionaryConfig } from '@game-judge/game-engine/games/pictionary/public';
import type { ComponentProps } from 'react';

import { formatDurationOption } from '@/components/GameSettings';
import { RoomGameSummary } from '@/features/room/components/RoomGameSummary';

/** Renders the complete public relay configuration. */
export function PictionaryRoomSummary({
  guide,
  config,
}: {
  readonly guide: ComponentProps<typeof RoomGameSummary>['guide'];
  readonly config: PictionaryConfig;
}) {
  return (
    <RoomGameSummary
      guide={guide}
      title="你画我猜接龙"
      playerCount={config.numberOfPlayers}
      settings={createPictionaryRoomSummarySettings(config)}
    />
  );
}

/** Public settings shared by the lobby and match configuration dialog. */
export function createPictionaryRoomSummarySettings(config: PictionaryConfig) {
  return [
    { label: '总棒数', value: `${config.numberOfPlayers} 棒` },
    {
      label: '绘画时限',
      value: formatDurationOption(config.drawingDurationSeconds),
    },
    {
      label: '文字时限',
      value: formatDurationOption(config.guessDurationSeconds),
    },
    {
      label: '每棒间隔',
      value: formatDurationOption(config.transitionDurationSeconds),
    },
    {
      label: '揭晓停留',
      value: formatDurationOption(config.galleryItemDurationSeconds, '手动翻页'),
    },
  ];
}
