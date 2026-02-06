/**
 * HostMenuDropdown.tsx - Dropdown menu for Host actions
 *
 * Shows a "..." button in the header that opens a dropdown menu with:
 * - Restart (重新开始)
 * - Fill with Bots (填充机器人) - only in unseated phase
 * - Mark All Bots Viewed (标记机器人已查看) - only in assigned phase with debug mode
 *
 * ❌ Do NOT import: any Service singletons, showAlert
 * ✅ Allowed: types, styles, UI components
 */
import React, { memo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useColors, type ThemeColors, spacing, borderRadius, typography, shadows } from '../../../theme';
import { componentSizes, fixed } from '../../../theme/tokens';

export interface HostMenuDropdownStyles {
  triggerButton: ViewStyle;
  triggerText: TextStyle;
  modalOverlay: ViewStyle;
  menuContainer: ViewStyle;
  menuItem: ViewStyle;
  menuItemText: TextStyle;
  menuItemDanger: ViewStyle;
  menuItemTextDanger: TextStyle;
  separator: ViewStyle;
  // New styles for restart button
  restartButton: ViewStyle;
  restartButtonText: TextStyle;
  headerRightContainer: ViewStyle;
}

export interface HostMenuDropdownProps {
  /** Whether to show the menu (Host only) */
  visible: boolean;
  /** Show restart option (displayed as separate button) */
  showRestart: boolean;
  /** Show fill with bots option (in dropdown) */
  showFillWithBots: boolean;
  /** Show mark all bots viewed option (in dropdown) */
  showMarkAllBotsViewed: boolean;
  /** Callbacks */
  onRestart: () => void;
  onFillWithBots: () => void;
  onMarkAllBotsViewed: () => void;
}

const HostMenuDropdownComponent: React.FC<HostMenuDropdownProps> = ({
  visible,
  showRestart,
  showFillWithBots,
  showMarkAllBotsViewed,
  onRestart,
  onFillWithBots,
  onMarkAllBotsViewed,
}) => {
  const colors = useColors();
  const styles = createStyles(colors);
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<View>(null);

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
      {/* Restart button - shown separately, always visible when applicable */}
      {showRestart && (
        <TouchableOpacity style={styles.restartButton} onPress={onRestart}>
          <Text style={styles.restartButtonText}>重开</Text>
        </TouchableOpacity>
      )}

      {/* Dropdown menu trigger - only show if there are dropdown items */}
      {hasDropdownItems && (
        <>
          <TouchableOpacity
            ref={triggerRef}
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

function createStyles(colors: ThemeColors): HostMenuDropdownStyles {
  return StyleSheet.create({
    headerRightContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      minWidth: 60,
    },
    restartButton: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
    },
    restartButtonText: {
      color: colors.primary,
      fontSize: typography.body,
      fontWeight: typography.weights.semibold,
    },
    triggerButton: {
      width: componentSizes.avatar.sm,
      height: componentSizes.avatar.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    triggerText: {
      fontSize: typography.heading,
      color: colors.text,
      fontWeight: typography.weights.bold,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlayLight,
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
      paddingTop: componentSizes.header + spacing.small,
      paddingRight: spacing.medium,
    },
    menuContainer: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.medium,
      minWidth: 180,
      ...shadows.md,
      overflow: 'hidden',
    },
    menuItem: {
      paddingVertical: spacing.medium,
      paddingHorizontal: spacing.large,
    },
    menuItemText: {
      fontSize: typography.body,
      color: colors.text,
    },
    menuItemDanger: {
      // No additional style, just for semantic grouping
    },
    menuItemTextDanger: {
      color: colors.error,
    },
    separator: {
      height: fixed.divider,
      backgroundColor: colors.border,
      marginHorizontal: spacing.medium,
    },
  });
}

export const HostMenuDropdown = memo(HostMenuDropdownComponent);
