/**
 * HeaderActions — Right-side action area of the room header
 *
 * Renders a direct button when only one item is visible (e.g., user avatar); shows "..." to open a dropdown menu when there are multiple.
 * Menu items include: share room, music settings, user settings, fill bots, stand all, etc.
 *
 * Memoized; accepts parent-created styles. No Service / showAlert imports.
 */
import type React from 'react';
import { memo, useMemo } from 'react';

import { type RoomHeaderActionItem, RoomHeaderActions } from '@/components/room/RoomHeaderActions';
import { TESTIDS } from '@/testids';

import { type HeaderActionsStyles } from './styles';

interface HeaderActionsProps {
  /** Whether to show the menu (Host only) */
  visible: boolean;
  /** Current user (for avatar in menu item) */
  user: { id: string; avatarUrl?: string | null } | null;
  /** Ticket count for badge display */
  ticketCount?: number | null;
  /** Show user settings option */
  showUserSettings: boolean;
  /** Show share room option (only in unseated/seated phase) */
  showShareRoom: boolean;
  /** Show music settings option (only before game starts) */
  showMusicSettings: boolean;
  /** Show fill with bots option (in dropdown) */
  showFillWithBots: boolean;
  /** Show mark all bots viewed option (in dropdown) */
  showMarkAllBotsViewed: boolean;
  /** Show mark all bots group-confirmed option (in dropdown) */
  showMarkAllBotsGroupConfirmed: boolean;
  /** Show clear all seats option (in dropdown) */
  showClearAllSeats: boolean;
  /** Callbacks */
  onFillWithBots: () => void;
  onMarkAllBotsViewed: () => void;
  onMarkAllBotsGroupConfirmed: () => void;
  onClearAllSeats: () => void;
  onMusicSettings: () => void;
  onUserSettings: () => void;
  onShareRoom: () => void;
  /** Pre-created styles from parent */
  styles: HeaderActionsStyles;
}

const HeaderActionsComponent: React.FC<HeaderActionsProps> = ({
  visible,
  user,
  ticketCount,
  showUserSettings,
  showShareRoom,
  showMusicSettings,
  showFillWithBots,
  showMarkAllBotsViewed,
  showMarkAllBotsGroupConfirmed,
  showClearAllSeats,
  onFillWithBots,
  onMarkAllBotsViewed,
  onMarkAllBotsGroupConfirmed,
  onClearAllSeats,
  onMusicSettings,
  onUserSettings,
  onShareRoom,
  styles,
}) => {
  const actionItems = useMemo<RoomHeaderActionItem[]>(
    () => [
      ...(showShareRoom
        ? [
            {
              key: 'share-room',
              label: '分享房间',
              iconName: 'share-outline' as const,
              onPress: onShareRoom,
            },
          ]
        : []),
      ...(showMusicSettings
        ? [
            {
              key: 'music-settings',
              label: '音乐设置',
              iconName: 'musical-notes-outline' as const,
              onPress: onMusicSettings,
            },
          ]
        : []),
    ],
    [onMusicSettings, onShareRoom, showMusicSettings, showShareRoom],
  );

  const operationItems = useMemo<RoomHeaderActionItem[]>(
    () => [
      ...(showClearAllSeats
        ? [
            {
              key: 'clear-seats',
              label: '清空座位',
              iconName: 'exit-outline' as const,
              onPress: onClearAllSeats,
            },
          ]
        : []),
      ...(showFillWithBots
        ? [
            {
              key: 'fill-bots',
              label: '填充机器人',
              iconName: 'people-outline' as const,
              onPress: onFillWithBots,
            },
          ]
        : []),
      ...(showMarkAllBotsViewed
        ? [
            {
              key: 'mark-bots-viewed',
              label: '标记机器人已查看',
              iconName: 'eye-outline' as const,
              onPress: onMarkAllBotsViewed,
            },
          ]
        : []),
      ...(showMarkAllBotsGroupConfirmed
        ? [
            {
              key: 'mark-bots-group-confirmed',
              label: '标记机器人已确认',
              iconName: 'checkmark-done-outline' as const,
              onPress: onMarkAllBotsGroupConfirmed,
            },
          ]
        : []),
    ],
    [
      onClearAllSeats,
      onFillWithBots,
      onMarkAllBotsGroupConfirmed,
      onMarkAllBotsViewed,
      showClearAllSeats,
      showFillWithBots,
      showMarkAllBotsGroupConfirmed,
      showMarkAllBotsViewed,
    ],
  );

  return (
    <RoomHeaderActions
      visible={visible}
      user={user}
      ticketCount={ticketCount}
      showUserSettings={showUserSettings}
      actionItems={actionItems}
      operationItems={operationItems}
      onUserSettings={onUserSettings}
      styles={styles}
      menuButtonTestID={TESTIDS.roomMenuButton}
    />
  );
};

export const HeaderActions = memo(HeaderActionsComponent);

HeaderActions.displayName = 'HeaderActions';
