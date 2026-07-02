/**
 * werewolfHeaderItems — Werewolf adapter for the shared room header menu.
 */
import type { RoomHeaderActionItem } from '@/components/room/RoomHeaderActions';
import {
  createRoomHeaderActionItems,
  createRoomHeaderOperationItems,
} from '@/components/room/roomHeaderItems';

interface CreateWerewolfHeaderActionItemsParams {
  showShareRoom: boolean;
  showMusicSettings: boolean;
  onShareRoom: () => void;
  onMusicSettings: () => void;
}

interface CreateWerewolfHeaderOperationItemsParams {
  canFillBots: boolean;
  canClearSeats: boolean;
  showMarkAllBotsViewed: boolean;
  showMarkAllBotsGroupConfirmed: boolean;
  onFillBots: () => void;
  onClearSeats: () => void;
  onMarkAllBotsViewed: () => void;
  onMarkAllBotsGroupConfirmed: () => void;
}

export function createWerewolfHeaderActionItems({
  showShareRoom,
  showMusicSettings,
  onShareRoom,
  onMusicSettings,
}: CreateWerewolfHeaderActionItemsParams): RoomHeaderActionItem[] {
  return createRoomHeaderActionItems({
    canShareRoom: showShareRoom,
    onShareRoom,
    canOpenMusicSettings: showMusicSettings,
    onMusicSettings,
  });
}

export function createWerewolfHeaderOperationItems({
  canFillBots,
  canClearSeats,
  showMarkAllBotsViewed,
  showMarkAllBotsGroupConfirmed,
  onFillBots,
  onClearSeats,
  onMarkAllBotsViewed,
  onMarkAllBotsGroupConfirmed,
}: CreateWerewolfHeaderOperationItemsParams): RoomHeaderActionItem[] {
  const items = createRoomHeaderOperationItems({
    canFillBots,
    canClearSeats,
    onFillBots,
    onClearSeats,
  });

  if (showMarkAllBotsViewed) {
    items.push({
      key: 'mark-bots-viewed',
      label: '标记机器人已查看',
      iconName: 'eye-outline',
      onPress: onMarkAllBotsViewed,
    });
  }

  if (showMarkAllBotsGroupConfirmed) {
    items.push({
      key: 'mark-bots-group-confirmed',
      label: '标记机器人已确认',
      iconName: 'checkmark-done-outline',
      onPress: onMarkAllBotsGroupConfirmed,
    });
  }

  return items;
}
