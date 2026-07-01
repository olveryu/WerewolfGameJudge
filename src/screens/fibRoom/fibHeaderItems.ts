/**
 * fibHeaderItems — Fib adapter for the shared room header menu.
 */
import type { RoomHeaderActionItem } from '@/components/room/RoomHeaderActions';
import { isMiniProgram } from '@/utils/miniProgram';

interface CreateFibHeaderActionItemsParams {
  onShareRoom: () => void;
}

interface CreateFibHeaderOperationItemsParams {
  isHost: boolean;
  isLobby: boolean;
  filled: number;
  isFull: boolean;
  onFillBots: () => void;
  onClearSeats: () => void;
}

export function createFibHeaderActionItems({
  onShareRoom,
}: CreateFibHeaderActionItemsParams): RoomHeaderActionItem[] {
  return [
    ...(!isMiniProgram()
      ? [
          {
            key: 'share-room',
            label: '分享房间',
            iconName: 'share-outline' as const,
            onPress: onShareRoom,
          },
        ]
      : []),
  ];
}

export function createFibHeaderOperationItems({
  isHost,
  isLobby,
  filled,
  isFull,
  onFillBots,
  onClearSeats,
}: CreateFibHeaderOperationItemsParams): RoomHeaderActionItem[] {
  if (!isHost || !isLobby) return [];

  const items: RoomHeaderActionItem[] = [];
  if (!isFull) {
    items.push({
      key: 'fill-bots',
      label: '填充机器人',
      iconName: 'people-outline',
      testID: 'fib-fill-bots',
      onPress: onFillBots,
    });
  }
  if (filled > 0) {
    items.push({
      key: 'clear-seats',
      label: '清空座位',
      iconName: 'exit-outline',
      danger: true,
      testID: 'fib-clear-seats',
      onPress: onClearSeats,
    });
  }
  return items;
}
