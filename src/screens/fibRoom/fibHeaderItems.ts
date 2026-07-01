/**
 * fibHeaderItems — Fib adapter for the shared room header menu.
 */
import type { RoomHeaderActionItem } from '@/components/room/RoomHeaderActions';
import { isMiniProgram } from '@/utils/miniProgram';

interface CreateFibHeaderActionItemsParams {
  isHost: boolean;
  isLobby: boolean;
  onShareRoom: () => void;
  onOpenSettings: () => void;
}

interface CreateFibHeaderOperationItemsParams {
  isHost: boolean;
  isLobby: boolean;
  filled: number;
  onClearSeats: () => void;
}

export function createFibHeaderActionItems({
  isHost,
  isLobby,
  onShareRoom,
  onOpenSettings,
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
    ...(isHost && isLobby
      ? [
          {
            key: 'room-settings',
            label: '房间设置',
            iconName: 'options-outline' as const,
            testID: 'fib-settings',
            onPress: onOpenSettings,
          },
        ]
      : []),
  ];
}

export function createFibHeaderOperationItems({
  isHost,
  isLobby,
  filled,
  onClearSeats,
}: CreateFibHeaderOperationItemsParams): RoomHeaderActionItem[] {
  if (!isHost || !isLobby || filled === 0) return [];
  return [
    {
      key: 'clear-seats',
      label: '清空座位',
      iconName: 'exit-outline',
      danger: true,
      testID: 'fib-clear-seats',
      onPress: onClearSeats,
    },
  ];
}
