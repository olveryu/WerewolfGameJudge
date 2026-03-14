/**
 * SeatTile - 单个座位瓦片（Memoized）
 *
 * 由 PlayerGrid 创建 styles 并传入，自定义 areEqual 防止不必要重渲染。
 * 入场/离场动画（slide up + bounce / fade out + shrink）。
 * 渲染 UI 并通过回调上报 onPress，不 import service / showAlert，不包含业务逻辑判断。
 */
import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { getRoleDisplayName } from '@werewolf/game-engine/models/roles';

import { Avatar } from '@/components/Avatar';
import { STATUS_ICONS, UI_ICONS } from '@/config/iconTokens';
import { TESTIDS } from '@/testids';
import {
  borderRadius,
  componentSizes,
  fixed,
  spacing,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

const GRID_COLUMNS = 4;

/** Adaptive column count based on screen width (tablet-friendly). */
export function getGridColumns(screenWidth: number): number {
  if (screenWidth >= 768) return 6;
  if (screenWidth >= 600) return 5;
  return GRID_COLUMNS;
}

/**
 * Pre-computed styles for SeatTile.
 * Created once in PlayerGrid and passed to all SeatTile instances.
 */
export interface SeatTileStyles {
  tileWrapper: ViewStyle;
  playerTile: ViewStyle;
  mySpotTile: ViewStyle;
  wolfTile: ViewStyle;
  selectedTile: ViewStyle;
  controlledTile: ViewStyle;
  seatNumberBadge: ViewStyle;
  seatNumberText: TextStyle;
  avatarContainer: ViewStyle;
  avatarOverlay: ViewStyle;
  wolfOverlay: ViewStyle;
  selectedOverlay: ViewStyle;
  mySeatNumberBadge: ViewStyle;
  readyBadge: TextStyle;
  wolfVoteBadge: TextStyle;
  emptyIndicator: TextStyle;
  playerName: TextStyle;
  playerNameHighlight: TextStyle;
  playerNamePlaceholder: ViewStyle;
  botRoleName: TextStyle;
}

export interface SeatTileProps {
  // Primitive props for stable comparison
  seat: number;
  roomNumber: string;
  tileSize: number;
  disabled: boolean;
  disabledReason?: string;
  isMySpot: boolean;
  isWolf: boolean;
  isSelected: boolean;
  isBot: boolean;
  isControlled: boolean; // Host is controlling this bot seat
  // Player info (null if empty seat)
  playerUid: string | null;
  playerAvatarUrl?: string;
  /** Pre-computed unique avatar seat (from room-level dedup). Undefined = use hash fallback. */
  playerAvatarIndex?: number;
  playerDisplayName: string | null;
  /** Whether the player is anonymous (no custom avatar set). Dims the nickname. */
  isPlayerAnonymous: boolean;
  // Role info for bot display (debug mode only)
  roleId: RoleId | null;
  showBotRole: boolean; // isHost && debugMode?.botsEnabled && isBot
  /** Show ✅ ready badge (e.g. player has viewed role during assigned phase). */
  showReadyBadge: boolean;
  /** Pre-formatted wolf vote badge text. Visible to wolf-faction only. */
  wolfVoteBadge?: string;
  // Styles (created once in PlayerGrid)
  styles: SeatTileStyles;
  onPress: (seat: number, disabledReason?: string) => void;
  /** Long press callback for takeover bot seat (debug mode) */
  onLongPress?: (seat: number) => void;
}

const SeatTileComponent: React.FC<SeatTileProps> = ({
  seat,
  roomNumber,
  tileSize,
  disabled,
  disabledReason,
  isMySpot,
  isWolf,
  isSelected,
  isBot,
  isControlled,
  playerUid,
  playerAvatarUrl,
  playerAvatarIndex,
  playerDisplayName,
  isPlayerAnonymous,
  roleId,
  showBotRole,
  showReadyBadge,
  wolfVoteBadge,
  styles,
  onPress,
  onLongPress,
}) => {
  // Note: onPress callback stability is handled by PlayerGrid using ref pattern.
  // SeatTile receives a stable callback that always calls the latest parent callback.
  const handlePress = useCallback(() => {
    onPress(seat, disabledReason);
  }, [onPress, seat, disabledReason]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(seat);
  }, [onLongPress, seat]);

  const hasPlayer = playerUid !== null;

  // Track previous hasPlayer state for enter/leave animations
  const prevHasPlayerRef = useRef<boolean | null>(null);
  // Track if we're in the middle of a leave animation
  const isLeavingRef = useRef(false);

  // Animation values - use useMemo to avoid lint errors with useRef().current
  // We intentionally only use hasPlayer for initial value, not as dependency.
  // Subsequent changes are handled by the useEffect animation logic below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const slideAnim = useMemo(() => new Animated.Value(hasPlayer ? 0 : 30), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scaleAnim = useMemo(() => new Animated.Value(hasPlayer ? 1 : 0.5), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const opacityAnim = useMemo(() => new Animated.Value(hasPlayer ? 1 : 0), []);

  // Player join/leave animation
  useEffect(() => {
    if (prevHasPlayerRef.current === false && hasPlayer) {
      // Player just joined - slide up + bounce
      isLeavingRef.current = false;
      slideAnim.setValue(30);
      scaleAnim.setValue(0.5);
      opacityAnim.setValue(0);

      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 6,
          tension: 100,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 120,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    } else if (prevHasPlayerRef.current === true && !hasPlayer) {
      // Player just left - mark as leaving (animation handled by keeping avatar visible briefly)
      isLeavingRef.current = true;
      // Note: We don't animate here because the avatar will be unmounted immediately
      // The animation would cause issues with unmounted components
      // For a smoother experience, we could use a delayed unmount, but that's more complex
    }
    prevHasPlayerRef.current = hasPlayer;
  }, [hasPlayer, slideAnim, scaleAnim, opacityAnim]);

  const avatarAnimatedStyle = {
    transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
    opacity: opacityAnim,
  };

  // Get role display name for bot (debug mode only)
  const botRoleDisplayName = showBotRole && roleId ? getRoleDisplayName(roleId) : null;

  return (
    <View style={styles.tileWrapper} testID={TESTIDS.seatTile(seat)}>
      <TouchableOpacity
        testID={TESTIDS.seatTilePressable(seat)}
        accessibilityLabel={
          playerDisplayName ? `座位${seat + 1} ${playerDisplayName}` : `座位${seat + 1}`
        }
        style={[
          styles.playerTile,
          isMySpot && styles.mySpotTile,
          isWolf && styles.wolfTile,
          isSelected && styles.selectedTile,
          isControlled && styles.controlledTile,
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={500}
        activeOpacity={disabled || disabledReason ? 1 : fixed.activeOpacity}
      >
        {hasPlayer && (
          <Animated.View style={[styles.avatarContainer, avatarAnimatedStyle]}>
            <Avatar
              value={playerUid}
              size={tileSize - 16}
              avatarUrl={playerAvatarUrl}
              avatarIndex={playerAvatarIndex}
              roomId={roomNumber}
              borderRadius={borderRadius.medium}
            />
            {(isWolf || isSelected) && (
              <View
                style={[
                  styles.avatarOverlay,
                  isWolf && styles.wolfOverlay,
                  isSelected && styles.selectedOverlay,
                ]}
              />
            )}
          </Animated.View>
        )}

        {!hasPlayer && <Text style={styles.emptyIndicator}>空</Text>}

        {showReadyBadge && hasPlayer && (
          <Ionicons
            name={STATUS_ICONS.READY}
            size={componentSizes.icon.sm}
            style={styles.readyBadge}
          />
        )}

        {wolfVoteBadge != null && hasPlayer && (
          <Text style={styles.wolfVoteBadge}>{wolfVoteBadge}</Text>
        )}
      </TouchableOpacity>

      {/* Floating seat number badge - overlaps top-left corner of tile */}
      <View
        style={[styles.seatNumberBadge, isMySpot && hasPlayer && styles.mySeatNumberBadge]}
        testID={isMySpot && hasPlayer ? 'my-seat-badge' : undefined}
      >
        <Text style={styles.seatNumberText}>{seat + 1}</Text>
      </View>
      {hasPlayer ? (
        <>
          <Text
            style={isPlayerAnonymous ? styles.playerName : styles.playerNameHighlight}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {isBot && <Ionicons name={UI_ICONS.BOT} size={typography.caption} />}
            {isBot && ' '}
            {playerDisplayName}
          </Text>
          {botRoleDisplayName && (
            <Text style={styles.botRoleName} numberOfLines={1}>
              {botRoleDisplayName}
            </Text>
          )}
        </>
      ) : (
        <View style={styles.playerNamePlaceholder} />
      )}
    </View>
  );
};

// Memoize with custom comparison
export const SeatTile = memo(SeatTileComponent);

/**
 * Create SeatTile styles. Called once in PlayerGrid and passed to all tiles.
 * Exported for use by PlayerGrid.
 */
export function createSeatTileStyles(colors: ThemeColors, tileSize: number): SeatTileStyles {
  return StyleSheet.create({
    tileWrapper: {
      width: tileSize,
      alignItems: 'center',
      marginBottom: spacing.small,
    },
    playerTile: {
      width: tileSize - spacing.small,
      height: tileSize - spacing.small,
      margin: spacing.tight,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.border,
    },
    mySpotTile: {
      borderColor: colors.success,
      borderWidth: fixed.borderWidthHighlight,
    },
    wolfTile: {
      backgroundColor: colors.error,
      borderColor: colors.error,
    },
    selectedTile: {
      backgroundColor: colors.primaryDark,
      borderColor: colors.primaryDark,
    },
    controlledTile: {
      borderColor: colors.warning,
      borderWidth: fixed.borderWidthHighlight,
    },
    seatNumberBadge: {
      position: 'absolute',
      top: spacing.tight,
      left: spacing.tight,
      width: componentSizes.badge.md,
      height: componentSizes.badge.md,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    seatNumberText: {
      fontSize: typography.caption,
      fontWeight: typography.weights.bold,
      color: colors.textInverse,
    },
    avatarContainer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: withAlpha(colors.primary, 0.302),
      borderRadius: borderRadius.large,
    },
    wolfOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: withAlpha(colors.wolf, 0.4),
      borderRadius: borderRadius.large,
    },
    selectedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: withAlpha(colors.primaryDark, 0.4),
      borderRadius: borderRadius.large,
    },
    mySeatNumberBadge: {
      backgroundColor: colors.success,
    },
    readyBadge: {
      position: 'absolute',
      bottom: spacing.tight + spacing.micro,
      left: spacing.tight + spacing.micro,
      color: colors.success,
    },
    wolfVoteBadge: {
      position: 'absolute',
      bottom: spacing.tight + spacing.micro,
      left: spacing.tight + spacing.micro,
      backgroundColor: colors.error,
      color: colors.textInverse,
      fontSize: typography.caption,
      fontWeight: typography.weights.bold,
      paddingHorizontal: spacing.tight + spacing.micro,
      paddingVertical: spacing.micro,
      borderRadius: borderRadius.small,
      overflow: 'hidden',
    },
    emptyIndicator: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textMuted,
    },
    playerName: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.text,
      textAlign: 'center',
      marginTop: spacing.tight,
      width: tileSize - spacing.small,
      height: typography.subtitle,
    },
    playerNameHighlight: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.primary,
      textAlign: 'center',
      marginTop: spacing.tight,
      width: tileSize - spacing.small,
      height: typography.subtitle,
    },
    playerNamePlaceholder: {
      marginTop: spacing.tight,
      height: typography.subtitle,
    },
    botRoleName: {
      fontSize: typography.captionSmall,
      lineHeight: typography.lineHeights.captionSmall,
      color: colors.textMuted,
      textAlign: 'center',
      width: tileSize - spacing.small,
    },
  });
}
