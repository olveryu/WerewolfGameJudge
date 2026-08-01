/** Game-neutral overflow actions for the shared room header. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo, useCallback, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Modal } from '@/components/AppModal';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { UserAvatar } from '@/components/UserAvatar';
import type {
  RoomHeaderMenuItem,
  RoomHeaderUserAction,
} from '@/features/room/model/RoomShellModel';
import { TESTIDS } from '@/testids';
import { colors, componentSizes } from '@/theme';

import type { HeaderActionsStyles } from './styles';

const MENU_ICON_SIZE = componentSizes.icon.md;

interface RoomHeaderActionsProps {
  readonly userAction: RoomHeaderUserAction | null;
  readonly items: readonly RoomHeaderMenuItem[];
  readonly styles: HeaderActionsStyles;
}

const RoomHeaderActionsComponent: React.FC<RoomHeaderActionsProps> = ({
  userAction,
  items,
  styles,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const utilityItems = useMemo(() => items.filter((item) => item.group === 'utility'), [items]);
  const operationItems = useMemo(() => items.filter((item) => item.group === 'operation'), [items]);

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  const runItem = useCallback((item: RoomHeaderMenuItem) => {
    setIsMenuOpen(false);
    item.onPress();
  }, []);
  const runUserAction = useCallback(() => {
    if (!userAction) {
      throw new Error('Room header user action is not available');
    }
    setIsMenuOpen(false);
    userAction.onPress();
  }, [userAction]);

  if (!userAction && items.length === 0) {
    return <View style={styles.triggerButton} />;
  }

  if (userAction && items.length === 0) {
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
  }

  const hasUtilityGroup = utilityItems.length > 0 || userAction !== null;

  return (
    <View style={styles.headerRightContainer}>
      <Button
        variant="icon"
        onPress={() => setIsMenuOpen(true)}
        testID={TESTIDS.roomMenuButton}
        accessibilityLabel="房间菜单"
      >
        <Ionicons name="ellipsis-horizontal" size={componentSizes.icon.md} color={colors.text} />
      </Button>

      <Modal visible={isMenuOpen} transparent animationType="fade" onRequestClose={closeMenu}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeMenu}>
          <View>
            <View style={styles.menuArrow} />
            <View style={styles.menuContainer}>
              {utilityItems.map((item) => (
                <MenuItem key={item.id} item={item} styles={styles} onPress={runItem} />
              ))}

              {userAction && (
                <TouchableOpacity
                  testID={TESTIDS.roomUserSettingsButton}
                  style={styles.menuItem}
                  onPress={runUserAction}
                >
                  {userAction.user ? (
                    <Avatar
                      value={userAction.user.id}
                      size={MENU_ICON_SIZE}
                      avatarUrl={userAction.user.avatarUrl}
                      borderRadius={MENU_ICON_SIZE / 2}
                    />
                  ) : (
                    <Ionicons name="person-outline" size={MENU_ICON_SIZE} color={colors.text} />
                  )}
                  <Text style={styles.menuItemText}>用户设置</Text>
                </TouchableOpacity>
              )}

              {hasUtilityGroup && operationItems.length > 0 && <View style={styles.sectionGap} />}

              {operationItems.map((item) => (
                <MenuItem key={item.id} item={item} styles={styles} onPress={runItem} />
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

interface MenuItemProps {
  readonly item: RoomHeaderMenuItem;
  readonly styles: HeaderActionsStyles;
  readonly onPress: (item: RoomHeaderMenuItem) => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ item, styles, onPress }) => {
  const isDanger = item.tone === 'danger';
  return (
    <TouchableOpacity
      testID={item.testID}
      style={[styles.menuItem, isDanger && styles.menuItemDanger]}
      onPress={() => onPress(item)}
    >
      <Ionicons
        name={item.icon}
        size={MENU_ICON_SIZE}
        color={isDanger ? colors.error : colors.text}
      />
      <Text style={[styles.menuItemText, isDanger && styles.menuItemTextDanger]}>{item.label}</Text>
    </TouchableOpacity>
  );
};

export const RoomHeaderActions = memo(RoomHeaderActionsComponent);
RoomHeaderActions.displayName = 'RoomHeaderActions';
