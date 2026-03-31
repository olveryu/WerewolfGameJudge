/**
 * HostMenuDropdown.tsx - Dropdown menu for Host actions
 *
 * Shows a "..." button in the header that opens a dropdown menu with:
 * - Fill with Bots (填充机器人) - only in unseated phase
 * - Mark All Bots Viewed (标记机器人已查看) - only in assigned phase with debug mode
 * - Clear All Seats (全员起立) - only in unseated/seated phase when players are seated
 *
 * Performance: Memoized, receives pre-created styles from parent.
 * Only imports types, styles, and UI components. Does not import Service singletons or showAlert.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { TESTIDS } from '@/testids';
import { componentSizes, useColors } from '@/theme';

import { type HostMenuDropdownStyles } from './styles';

const MENU_ICON_SIZE = componentSizes.icon.md;

interface HostMenuDropdownProps {
  /** Whether to show the menu (Host only) */
  visible: boolean;
  /** Show user settings option */
  showUserSettings: boolean;
  /** Show share room option (only in unseated/seated phase) */
  showShareRoom: boolean;
  /** Show game settings option (only before game starts) */
  showSettings: boolean;
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
  onSettings: () => void;
  onUserSettings: () => void;
  onShareRoom: () => void;
  /** Pre-created styles from parent */
  styles: HostMenuDropdownStyles;
}

const HostMenuDropdownComponent: React.FC<HostMenuDropdownProps> = ({
  visible,
  showUserSettings,
  showShareRoom,
  showSettings,
  showFillWithBots,
  showMarkAllBotsViewed,
  showMarkAllBotsGroupConfirmed,
  showClearAllSeats,
  onFillWithBots,
  onMarkAllBotsViewed,
  onMarkAllBotsGroupConfirmed,
  onClearAllSeats,
  onSettings,
  onUserSettings,
  onShareRoom,
  styles,
}) => {
  const colors = useColors();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleOpenMenu = useCallback(() => {
    setMenuOpen(true);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const handleFillWithBots = useCallback(() => {
    setMenuOpen(false);
    onFillWithBots();
  }, [onFillWithBots]);

  const handleMarkAllBotsViewed = useCallback(() => {
    setMenuOpen(false);
    onMarkAllBotsViewed();
  }, [onMarkAllBotsViewed]);

  const handleMarkAllBotsGroupConfirmed = useCallback(() => {
    setMenuOpen(false);
    onMarkAllBotsGroupConfirmed();
  }, [onMarkAllBotsGroupConfirmed]);

  const handleClearAllSeats = useCallback(() => {
    setMenuOpen(false);
    onClearAllSeats();
  }, [onClearAllSeats]);

  const handleSettings = useCallback(() => {
    setMenuOpen(false);
    onSettings();
  }, [onSettings]);

  const handleUserSettings = useCallback(() => {
    setMenuOpen(false);
    onUserSettings();
  }, [onUserSettings]);

  const handleShareRoom = useCallback(() => {
    setMenuOpen(false);
    onShareRoom();
  }, [onShareRoom]);

  // Don't render if not visible
  if (!visible) {
    return <View style={styles.triggerButton} />;
  }

  const hasDropdownItems =
    showUserSettings ||
    showShareRoom ||
    showSettings ||
    showFillWithBots ||
    showMarkAllBotsViewed ||
    showMarkAllBotsGroupConfirmed ||
    showClearAllSeats;

  return (
    <View style={styles.headerRightContainer}>
      {/* Dropdown menu trigger - only show if there are dropdown items */}
      {hasDropdownItems && (
        <>
          <Button variant="icon" onPress={handleOpenMenu} testID={TESTIDS.roomMenuButton}>
            <Ionicons
              name="ellipsis-horizontal"
              size={componentSizes.icon.md}
              color={colors.text}
            />
          </Button>

          <Modal
            visible={menuOpen}
            transparent
            animationType="fade"
            onRequestClose={handleCloseMenu}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={handleCloseMenu}
            >
              <View>
                <View style={styles.menuArrow} />
                <View style={styles.menuContainer}>
                  {/* Group 1: Actions */}
                  {showShareRoom && (
                    <TouchableOpacity style={styles.menuItem} onPress={handleShareRoom}>
                      <Ionicons name="share-outline" size={MENU_ICON_SIZE} color={colors.text} />
                      <Text style={styles.menuItemText}>分享房间</Text>
                    </TouchableOpacity>
                  )}
                  {showSettings && (
                    <TouchableOpacity style={styles.menuItem} onPress={handleSettings}>
                      <Ionicons name="settings-outline" size={MENU_ICON_SIZE} color={colors.text} />
                      <Text style={styles.menuItemText}>游戏设置</Text>
                    </TouchableOpacity>
                  )}
                  {showUserSettings && (
                    <TouchableOpacity style={styles.menuItem} onPress={handleUserSettings}>
                      <Ionicons name="person-outline" size={MENU_ICON_SIZE} color={colors.text} />
                      <Text style={styles.menuItemText}>用户设置</Text>
                    </TouchableOpacity>
                  )}

                  {/* Gap: Actions → Operations */}
                  {(showShareRoom || showSettings || showUserSettings) &&
                    (showClearAllSeats ||
                      showFillWithBots ||
                      showMarkAllBotsViewed ||
                      showMarkAllBotsGroupConfirmed) && <View style={styles.sectionGap} />}

                  {/* Group 3: Operations */}
                  {showClearAllSeats && (
                    <TouchableOpacity style={styles.menuItem} onPress={handleClearAllSeats}>
                      <Ionicons name="exit-outline" size={MENU_ICON_SIZE} color={colors.text} />
                      <Text style={styles.menuItemText}>全员起立</Text>
                    </TouchableOpacity>
                  )}
                  {showFillWithBots && (
                    <TouchableOpacity style={styles.menuItem} onPress={handleFillWithBots}>
                      <Ionicons name="people-outline" size={MENU_ICON_SIZE} color={colors.text} />
                      <Text style={styles.menuItemText}>填充机器人</Text>
                    </TouchableOpacity>
                  )}
                  {showMarkAllBotsViewed && (
                    <TouchableOpacity style={styles.menuItem} onPress={handleMarkAllBotsViewed}>
                      <Ionicons name="eye-outline" size={MENU_ICON_SIZE} color={colors.text} />
                      <Text style={styles.menuItemText}>标记机器人已查看</Text>
                    </TouchableOpacity>
                  )}
                  {showMarkAllBotsGroupConfirmed && (
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={handleMarkAllBotsGroupConfirmed}
                    >
                      <Ionicons
                        name="checkmark-done-outline"
                        size={MENU_ICON_SIZE}
                        color={colors.text}
                      />
                      <Text style={styles.menuItemText}>标记机器人已确认</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </Modal>
        </>
      )}
    </View>
  );
};

export const HostMenuDropdown = memo(HostMenuDropdownComponent);

HostMenuDropdown.displayName = 'HostMenuDropdown';
