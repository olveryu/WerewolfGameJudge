/**
 * HeaderActions — 房间顶栏右侧操作区
 *
 * 仅一个可见项时直接渲染按钮（如用户头像）；多项时显示 "..." 打开下拉菜单。
 * 菜单项包括：分享房间、翻牌动画、音乐设置、用户设置、填充机器人、全员起立等。
 *
 * Memoized，接收 parent 预创建的 styles。不 import Service / showAlert。
 */
import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { TESTIDS } from '@/testids';
import { borderRadius, colors, componentSizes, spacing, typography, withAlpha } from '@/theme';

import { type HeaderActionsStyles } from './styles';

const MENU_ICON_SIZE = componentSizes.icon.md;
const AVATAR_SIZE = componentSizes.avatar.sm;
const AVATAR_WRAPPER_SIZE = AVATAR_SIZE + spacing.tight * 2;
const BADGE_SIZE = componentSizes.badge.sm;

interface HeaderActionsProps {
  /** Whether to show the menu (Host only) */
  visible: boolean;
  /** Current user (for avatar in menu item) */
  user: { uid: string; avatarUrl?: string | null } | null;
  /** User level for badge display */
  level?: number | null;
  /** Show user settings option */
  showUserSettings: boolean;
  /** Show share room option (only in unseated/seated phase) */
  showShareRoom: boolean;
  /** Show animation settings option (only before game starts) */
  showAnimationSettings: boolean;
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
  onAnimationSettings: () => void;
  onMusicSettings: () => void;
  onUserSettings: () => void;
  onShareRoom: () => void;
  /** Pre-created styles from parent */
  styles: HeaderActionsStyles;
}

const HeaderActionsComponent: React.FC<HeaderActionsProps> = ({
  visible,
  user,
  level,
  showUserSettings,
  showShareRoom,
  showAnimationSettings,
  showMusicSettings,
  showFillWithBots,
  showMarkAllBotsViewed,
  showMarkAllBotsGroupConfirmed,
  showClearAllSeats,
  onFillWithBots,
  onMarkAllBotsViewed,
  onMarkAllBotsGroupConfirmed,
  onClearAllSeats,
  onAnimationSettings,
  onMusicSettings,
  onUserSettings,
  onShareRoom,
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

  const handleMarkAllBotsGroupConfirmed = useCallback(() => {
    setMenuOpen(false);
    onMarkAllBotsGroupConfirmed();
  }, [onMarkAllBotsGroupConfirmed]);

  const handleClearAllSeats = useCallback(() => {
    setMenuOpen(false);
    onClearAllSeats();
  }, [onClearAllSeats]);

  const handleAnimationSettings = useCallback(() => {
    setMenuOpen(false);
    onAnimationSettings();
  }, [onAnimationSettings]);

  const handleMusicSettings = useCallback(() => {
    setMenuOpen(false);
    onMusicSettings();
  }, [onMusicSettings]);

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

  // When only "用户设置" is visible, show its icon directly instead of the "..." dropdown
  const hasOtherItems =
    showShareRoom ||
    showAnimationSettings ||
    showMusicSettings ||
    showFillWithBots ||
    showMarkAllBotsViewed ||
    showMarkAllBotsGroupConfirmed ||
    showClearAllSeats;

  const hasDropdownItems = showUserSettings || hasOtherItems;

  // Single item: render avatar/icon button directly (same size as HomeScreen UserAvatar)
  if (showUserSettings && !hasOtherItems) {
    const wrapperStyle = {
      width: AVATAR_WRAPPER_SIZE,
      height: AVATAR_WRAPPER_SIZE,
      borderRadius: borderRadius.full,
      backgroundColor: withAlpha(colors.primary, 0.08),
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    };
    const badge =
      level != null ? (
        <View style={[badgeStyles.pill, { backgroundColor: colors.primary }]}>
          <Text style={badgeStyles.text}>{level}</Text>
        </View>
      ) : null;
    return (
      <View style={styles.headerRightContainer}>
        <Button variant="icon" onPress={onUserSettings}>
          <View style={wrapperStyle}>
            {user ? (
              <Avatar
                value={user.uid}
                size={AVATAR_SIZE}
                avatarUrl={user.avatarUrl}
                borderRadius={AVATAR_SIZE / 2}
              />
            ) : (
              <Ionicons
                name="person-circle-outline"
                size={componentSizes.icon.md}
                color={colors.textSecondary}
              />
            )}
            {badge}
          </View>
        </Button>
      </View>
    );
  }

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
                  {showAnimationSettings && (
                    <TouchableOpacity style={styles.menuItem} onPress={handleAnimationSettings}>
                      <Ionicons
                        name="color-wand-outline"
                        size={MENU_ICON_SIZE}
                        color={colors.text}
                      />
                      <Text style={styles.menuItemText}>翻牌动画</Text>
                    </TouchableOpacity>
                  )}
                  {showMusicSettings && (
                    <TouchableOpacity style={styles.menuItem} onPress={handleMusicSettings}>
                      <Ionicons
                        name="musical-notes-outline"
                        size={MENU_ICON_SIZE}
                        color={colors.text}
                      />
                      <Text style={styles.menuItemText}>音乐设置</Text>
                    </TouchableOpacity>
                  )}
                  {showUserSettings && (
                    <TouchableOpacity style={styles.menuItem} onPress={handleUserSettings}>
                      {user ? (
                        <Avatar
                          value={user.uid}
                          size={MENU_ICON_SIZE}
                          avatarUrl={user.avatarUrl}
                          borderRadius={MENU_ICON_SIZE / 2}
                        />
                      ) : (
                        <Ionicons name="person-outline" size={MENU_ICON_SIZE} color={colors.text} />
                      )}
                      <Text style={styles.menuItemText}>用户设置</Text>
                    </TouchableOpacity>
                  )}

                  {/* Gap: Actions → Operations */}
                  {(showShareRoom ||
                    showAnimationSettings ||
                    showMusicSettings ||
                    showUserSettings) &&
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

export const HeaderActions = memo(HeaderActionsComponent);

HeaderActions.displayName = 'HeaderActions';

// ── Badge styles (matches HomeScreen UserAvatar badge) ──

const badgeStyles = StyleSheet.create({
  pill: {
    position: 'absolute',
    bottom: -1,
    right: -2,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    paddingHorizontal: spacing.micro,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: colors.textInverse,
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
});
