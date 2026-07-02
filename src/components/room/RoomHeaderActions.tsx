/**
 * RoomHeaderActions — shared room header menu for all game modes.
 *
 * Pure UI: callers provide menu items and callbacks. Game-specific screens decide
 * which actions are visible; this component only renders the established room menu.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo, useCallback, useState } from 'react';
import {
  type StyleProp,
  Text,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';

import { Modal } from '@/components/AppModal';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { UserAvatar } from '@/components/UserAvatar';
import { colors, componentSizes } from '@/theme';

const MENU_ICON_SIZE = componentSizes.icon.md;

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export interface RoomHeaderActionItem {
  key: string;
  label: string;
  iconName?: IoniconName;
  danger?: boolean;
  testID?: string;
  onPress: () => void;
}

export interface RoomHeaderActionsStyles {
  triggerButton: StyleProp<ViewStyle>;
  modalOverlay: StyleProp<ViewStyle>;
  menuArrow: StyleProp<ViewStyle>;
  menuContainer: StyleProp<ViewStyle>;
  menuItem: StyleProp<ViewStyle>;
  menuItemText: StyleProp<TextStyle>;
  menuItemTextDanger: StyleProp<TextStyle>;
  sectionGap: StyleProp<ViewStyle>;
  headerRightContainer: StyleProp<ViewStyle>;
}

interface RoomHeaderActionsProps {
  visible: boolean;
  user: { id: string; avatarUrl?: string | null } | null;
  ticketCount?: number | null;
  showUserSettings: boolean;
  actionItems: readonly RoomHeaderActionItem[];
  operationItems: readonly RoomHeaderActionItem[];
  onUserSettings: () => void;
  styles: RoomHeaderActionsStyles;
  menuButtonTestID?: string;
}

const RoomHeaderActionsComponent: React.FC<RoomHeaderActionsProps> = ({
  visible,
  user,
  ticketCount,
  showUserSettings,
  actionItems,
  operationItems,
  onUserSettings,
  styles,
  menuButtonTestID,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const runItem = useCallback((item: RoomHeaderActionItem) => {
    setMenuOpen(false);
    item.onPress();
  }, []);

  const handleUserSettings = useCallback(() => {
    setMenuOpen(false);
    onUserSettings();
  }, [onUserSettings]);

  if (!visible) {
    return <View style={styles.triggerButton} />;
  }

  const hasActionItems = actionItems.length > 0;
  const hasOperationItems = operationItems.length > 0;
  const hasDropdownItems = showUserSettings || hasActionItems || hasOperationItems;

  if (showUserSettings && !hasActionItems && !hasOperationItems) {
    return (
      <View style={styles.headerRightContainer}>
        <UserAvatar user={user} ticketCount={ticketCount} onPress={onUserSettings} />
      </View>
    );
  }

  return (
    <View style={styles.headerRightContainer}>
      {hasDropdownItems ? (
        <>
          <Button variant="icon" onPress={() => setMenuOpen(true)} testID={menuButtonTestID}>
            <Ionicons
              name="ellipsis-horizontal"
              size={componentSizes.icon.md}
              color={colors.text}
            />
          </Button>

          <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={closeMenu}>
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeMenu}>
              <View>
                <View style={styles.menuArrow} />
                <View style={styles.menuContainer}>
                  {actionItems.map((item) => (
                    <TouchableOpacity
                      key={item.key}
                      style={styles.menuItem}
                      onPress={() => runItem(item)}
                      testID={item.testID}
                    >
                      <Ionicons
                        name={item.iconName ?? 'ellipse-outline'}
                        size={MENU_ICON_SIZE}
                        color={item.danger ? colors.error : colors.text}
                      />
                      <Text style={[styles.menuItemText, item.danger && styles.menuItemTextDanger]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}

                  {showUserSettings ? (
                    <TouchableOpacity style={styles.menuItem} onPress={handleUserSettings}>
                      {user ? (
                        <Avatar
                          value={user.id}
                          size={MENU_ICON_SIZE}
                          avatarUrl={user.avatarUrl}
                          borderRadius={MENU_ICON_SIZE / 2}
                        />
                      ) : (
                        <Ionicons name="person-outline" size={MENU_ICON_SIZE} color={colors.text} />
                      )}
                      <Text style={styles.menuItemText}>用户设置</Text>
                    </TouchableOpacity>
                  ) : null}

                  {(hasActionItems || showUserSettings) && hasOperationItems ? (
                    <View style={styles.sectionGap} />
                  ) : null}

                  {operationItems.map((item) => (
                    <TouchableOpacity
                      key={item.key}
                      style={styles.menuItem}
                      onPress={() => runItem(item)}
                      testID={item.testID}
                    >
                      <Ionicons
                        name={item.iconName ?? 'ellipse-outline'}
                        size={MENU_ICON_SIZE}
                        color={item.danger ? colors.error : colors.text}
                      />
                      <Text style={[styles.menuItemText, item.danger && styles.menuItemTextDanger]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          </Modal>
        </>
      ) : null}
    </View>
  );
};

export const RoomHeaderActions = memo(RoomHeaderActionsComponent);

RoomHeaderActions.displayName = 'RoomHeaderActions';
