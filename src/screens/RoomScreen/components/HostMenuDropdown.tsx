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

import { type HostMenuDropdownStyles } from './styles';

interface HostMenuDropdownProps {
  /** Whether to show the menu (Host only) */
  visible: boolean;
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
  /** Pre-created styles from parent */
  styles: HostMenuDropdownStyles;
}

const HostMenuDropdownComponent: React.FC<HostMenuDropdownProps> = ({
  visible,
  showFillWithBots,
  showMarkAllBotsViewed,
  showClearAllSeats,
  onFillWithBots,
  onMarkAllBotsViewed,
  onClearAllSeats,
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

  // Don't render if not visible
  if (!visible) {
    return <View style={styles.triggerButton} />;
  }

  // Check if we have dropdown items (excluding restart which is shown separately)
  const hasDropdownItems = showFillWithBots || showMarkAllBotsViewed || showClearAllSeats;

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
                {showFillWithBots && (
                  <TouchableOpacity style={styles.menuItem} onPress={handleFillWithBots}>
                    <Text style={styles.menuItemText}>🤖 填充机器人</Text>
                  </TouchableOpacity>
                )}

                {showMarkAllBotsViewed && (
                  <>
                    {showFillWithBots && <View style={styles.separator} />}
                    <TouchableOpacity style={styles.menuItem} onPress={handleMarkAllBotsViewed}>
                      <Text style={styles.menuItemText}>👁️ 标记机器人已查看</Text>
                    </TouchableOpacity>
                  </>
                )}

                {showClearAllSeats && (
                  <>
                    {(showFillWithBots || showMarkAllBotsViewed) && (
                      <View style={styles.separator} />
                    )}
                    <TouchableOpacity style={styles.menuItem} onPress={handleClearAllSeats}>
                      <Text style={styles.menuItemText}>🪑 全员起立</Text>
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
