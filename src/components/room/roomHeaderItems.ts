/**
 * roomHeaderItems — shared room header menu item builders.
 */
import type { RoomHeaderActionItem } from './RoomHeaderActions';

export interface CreateRoomHeaderActionItemsParams {
  canShareRoom: boolean;
  onShareRoom: () => void;
  canOpenMusicSettings?: boolean;
  onMusicSettings?: () => void;
}

export interface CreateRoomHeaderOperationItemsParams {
  canFillBots: boolean;
  canClearSeats: boolean;
  onFillBots: () => void;
  onClearSeats: () => void;
  testIdPrefix?: string;
}

export function createRoomHeaderActionItems({
  canShareRoom,
  onShareRoom,
  canOpenMusicSettings = false,
  onMusicSettings,
}: CreateRoomHeaderActionItemsParams): RoomHeaderActionItem[] {
  const items: RoomHeaderActionItem[] = [];

  if (canShareRoom) {
    items.push({
      key: 'share-room',
      label: '分享房间',
      iconName: 'share-outline',
      onPress: onShareRoom,
    });
  }

  if (canOpenMusicSettings) {
    if (!onMusicSettings) {
      throw new Error('createRoomHeaderActionItems: onMusicSettings is required when enabled');
    }
    items.push({
      key: 'music-settings',
      label: '音乐设置',
      iconName: 'musical-notes-outline',
      onPress: onMusicSettings,
    });
  }

  return items;
}

export function createRoomHeaderOperationItems({
  canFillBots,
  canClearSeats,
  onFillBots,
  onClearSeats,
  testIdPrefix,
}: CreateRoomHeaderOperationItemsParams): RoomHeaderActionItem[] {
  const items: RoomHeaderActionItem[] = [];

  if (canFillBots) {
    items.push({
      key: 'fill-bots',
      label: '填充机器人',
      iconName: 'people-outline',
      testID: testIdPrefix ? `${testIdPrefix}-fill-bots` : undefined,
      onPress: onFillBots,
    });
  }

  if (canClearSeats) {
    items.push({
      key: 'clear-seats',
      label: '清空座位',
      iconName: 'exit-outline',
      danger: true,
      testID: testIdPrefix ? `${testIdPrefix}-clear-seats` : undefined,
      onPress: onClearSeats,
    });
  }

  return items;
}
