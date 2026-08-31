/** Game-neutral user settings action for the shared room header. */

import type React from 'react';
import { memo } from 'react';
import { View } from 'react-native';

import { UserAvatar } from '@/components/UserAvatar';
import type { RoomHeaderUserAction } from '@/features/room/model/RoomShellModel';
import { TESTIDS } from '@/testids';

import type { HeaderActionsStyles } from './styles';

interface RoomHeaderActionsProps {
  readonly userAction: RoomHeaderUserAction | null;
  readonly styles: HeaderActionsStyles;
}

const RoomHeaderActionsComponent: React.FC<RoomHeaderActionsProps> = ({ userAction, styles }) => {
  if (userAction === null) return <View style={styles.triggerButton} />;

  return (
    <View style={styles.headerRightContainer}>
      <UserAvatar
        user={userAction.user}
        ticketCount={userAction.ticketCount}
        onPress={userAction.onPress}
        testID={TESTIDS.roomUserSettingsButton}
      />
    </View>
  );
};

export const RoomHeaderActions = memo(RoomHeaderActionsComponent);
RoomHeaderActions.displayName = 'RoomHeaderActions';
