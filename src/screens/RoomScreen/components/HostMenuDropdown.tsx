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

import { useColors } from '@/theme';
import { componentSizes } from '@/theme/tokens';

import { type HostMenuDropdownStyles } from './styles';

interface HostMenuDropdownProps {
  /** Whether to show the menu (Host only) */
  visible: boolean;
  /** Show game settings option (only before game starts) */
  showSettings: boolean;
  /** Show user settings option */
  showUserSettings: boolean;
  /** Show fill with bots option (in dropdown) */
  showFillWithBots: boolean;
  /** Show mark all bots viewed option (in dropdown) */
  showMarkAllBotsViewed: boolean;
  /** Show clear all seats option (in dropdown) */
  showClearAllSeats: boolean;
  /** Callbacks */
  onFillWithBots: () => void;
  onMarkAllBotsViewed: () => void;
  onClearAllSeats: () => void;
  onSettings: () => void;
  onUserSettings: () => void;
  /** Pre-created styles from parent */
  styles: HostMenuDropdownStyles;
}

const HostMenuDropdownComponent: React.FC<HostMenuDropdownProps> = ({
  visible,
  showSettings,
  showUserSettings,
  showFillWithBots,
  showMarkAllBotsViewed,
  showClearAllSeats,
  onFillWithBots,
  onMarkAllBotsViewed,
  onClearAllSeats,
  onSettings,
  onUserSettings,
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

  // Don't render if not visible
  if (!visible) {
    return <View style={styles.triggerButton} />;
  }

  const hasDropdownItems =
    showSettings ||
    showUserSettings ||
    showFillWithBots ||
    showMarkAllBotsViewed ||
    showClearAllSeats;

  // Only user settings — render direct icon button, no dropdown
  const isUserSettingsOnly =
    showUserSettings &&
    !showSettings &&
    !showFillWithBots &&
    !showMarkAllBotsViewed &&
    !showClearAllSeats;

  if (isUserSettingsOnly) {
    return (
      <View style={styles.headerRightContainer}>
        <TouchableOpacity
          style={styles.triggerButton}
          onPress={onUserSettings}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="person-circle-outline"
            size={componentSizes.icon.lg}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.headerRightContainer}>
      {/* Dropdown menu trigger - only show if there are dropdown items */}
      {hasDropdownItems && (
        <>
          <TouchableOpacity
            style={styles.triggerButton}
            onPress={handleOpenMenu}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
          </TouchableOpacity>

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
              <View style={styles.menuContainer}>
                {/* Game Settings — only before game starts */}
                {showSettings && (
                  <TouchableOpacity style={styles.menuItem} onPress={handleSettings}>
                    <Text style={styles.menuItemText}>⚙️ 游戏设置</Text>
                  </TouchableOpacity>
                )}

                {/* User Settings — navigate to Settings screen */}
                {showUserSettings && (
                  <>
                    {showSettings && <View style={styles.separator} />}
                    <TouchableOpacity style={styles.menuItem} onPress={handleUserSettings}>
                      <Text style={styles.menuItemText}>👤 用户设置</Text>
                    </TouchableOpacity>
                  </>
                )}

                {showClearAllSeats && (
                  <>
                    <View style={styles.separator} />
                    <TouchableOpacity style={styles.menuItem} onPress={handleClearAllSeats}>
                      <Text style={styles.menuItemText}>🪑 全员起立</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Bot actions — at bottom */}
                {showFillWithBots && (
                  <>
                    <View style={styles.separator} />
                    <TouchableOpacity style={styles.menuItem} onPress={handleFillWithBots}>
                      <Text style={styles.menuItemText}>🤖 填充机器人</Text>
                    </TouchableOpacity>
                  </>
                )}

                {showMarkAllBotsViewed && (
                  <>
                    <View style={styles.separator} />
                    <TouchableOpacity style={styles.menuItem} onPress={handleMarkAllBotsViewed}>
                      <Text style={styles.menuItemText}>👁️ 标记机器人已查看</Text>
                    </TouchableOpacity>
                  </>
                )}
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
