/**
 * HostMenuDropdown.tsx - Dropdown menu for Host actions
 *
 * Shows a "..." button in the header that opens a dropdown menu with:
 * - Fill with Bots (填充机器人) - only in unseated phase
 * - Mark All Bots Viewed (标记机器人已查看) - only in assigned phase with debug mode
 *
 * Performance: Memoized, receives pre-created styles from parent.
 *
 * ❌ Do NOT import: any Service singletons, showAlert
 * ✅ Allowed: types, styles, UI components
 */
import React, { memo, useCallback, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

import { type HostMenuDropdownStyles } from './styles';

interface HostMenuDropdownProps {
  /** Whether to show the menu (Host only) */
  visible: boolean;
  /** Show fill with bots option (in dropdown) */
  showFillWithBots: boolean;
  /** Show mark all bots viewed option (in dropdown) */
  showMarkAllBotsViewed: boolean;
  /** Callbacks */
  onFillWithBots: () => void;
  onMarkAllBotsViewed: () => void;
  /** Pre-created styles from parent */
  styles: HostMenuDropdownStyles;
}

const HostMenuDropdownComponent: React.FC<HostMenuDropdownProps> = ({
  visible,
  showFillWithBots,
  showMarkAllBotsViewed,
  onFillWithBots,
  onMarkAllBotsViewed,
  styles,
}) => {
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

  // Don't render if not visible
  if (!visible) {
    return <View style={styles.triggerButton} />;
  }

  // Check if we have dropdown items (excluding restart which is shown separately)
  const hasDropdownItems = showFillWithBots || showMarkAllBotsViewed;

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
            <Text style={styles.triggerText}>⋮</Text>
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
