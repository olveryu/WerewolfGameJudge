/**
 * SeatTile - 单个座位瓦片（Memoized）
 *
 * 由 PlayerGrid 创建 styles 并传入，自定义 areEqual 防止不必要重渲染。
 * 入场/离场动画（slide up + bounce / fade out + shrink）。
 *
 * ✅ 允许：渲染 UI + 上报 onPress
 * ❌ 禁止：import service / showAlert / 业务逻辑判断
 */
import React, { memo, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { spacing, typography, borderRadius, type ThemeColors } from '../../../theme';
import { fixed } from '../../../theme/tokens';
import { TESTIDS } from '../../../testids';
import type { RoleId } from '../../../models/roles';
import { getRoleDisplayName } from '../../../models/roles';

// Re-export for PlayerGrid
export const GRID_COLUMNS = 4;

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
  mySeatBadge: TextStyle;
  readyBadge: TextStyle;
  emptyIndicator: TextStyle;
  playerName: TextStyle;
  playerNamePlaceholder: ViewStyle;
  botRoleName: TextStyle;
}

export interface SeatTileProps {
  // Primitive props for stable comparison
  index: number;
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
  /** Pre-computed unique avatar index (from room-level dedup). Undefined = use hash fallback. */
  playerAvatarIndex?: number;
  playerDisplayName: string | null;
  // Role info for bot display (debug mode only)
  roleId: RoleId | null;
  showBotRole: boolean; // isHost && debugMode?.botsEnabled && isBot
  /** Show ✅ ready badge (e.g. player has viewed role during assigned phase). */
  showReadyBadge: boolean;
  // Styles (created once in PlayerGrid)
  styles: SeatTileStyles;
  // Callbacks (not compared in arePropsEqual to avoid callback identity issues)
  onPress: (seatIndex: number, disabledReason?: string) => void;
  /** Long press callback for takeover bot seat (debug mode) */
  onLongPress?: (seatIndex: number) => void;
}

/**
 * Custom comparison function for memo.
 * Only re-render if UI-relevant primitive props change.
 *
 * NOTE: We intentionally exclude onPress from comparison.
 * Callback identity can change due to parent re-renders, but as long as
 * the visual props are the same, we don't need to re-render the tile.
 * The callback will still work correctly when pressed.
 *
 * NOTE: We compare styles by reference. PlayerGrid creates styles once
 * and passes the same reference to all tiles, so this is efficient.
 */
function arePropsEqual(prev: SeatTileProps, next: SeatTileProps): boolean {
  return (
    prev.index === next.index &&
    prev.roomNumber === next.roomNumber &&
    prev.tileSize === next.tileSize &&
    prev.disabled === next.disabled &&
    prev.disabledReason === next.disabledReason &&
    prev.isMySpot === next.isMySpot &&
    prev.isWolf === next.isWolf &&
    prev.isSelected === next.isSelected &&
    prev.isBot === next.isBot &&
    prev.isControlled === next.isControlled &&
    prev.playerUid === next.playerUid &&
    prev.playerAvatarUrl === next.playerAvatarUrl &&
    prev.playerAvatarIndex === next.playerAvatarIndex &&
    prev.playerDisplayName === next.playerDisplayName &&
    prev.roleId === next.roleId &&
    prev.showBotRole === next.showBotRole &&
    prev.showReadyBadge === next.showReadyBadge &&
    prev.styles === next.styles
  );
}

const SeatTileComponent: React.FC<SeatTileProps> = ({
  index,
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
  roleId,
  showBotRole,
  showReadyBadge,
  styles,
  onPress,
  onLongPress,
}) => {
  // Note: onPress callback stability is handled by PlayerGrid using ref pattern.
  // SeatTile receives a stable callback that always calls the latest parent callback.
  const handlePress = useCallback(() => {
    onPress(index, disabledReason);
  }, [onPress, index, disabledReason]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(index);
  }, [onLongPress, index]);

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
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
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
    <View style={styles.tileWrapper} testID={TESTIDS.seatTile(index)}>
      <TouchableOpacity
        testID={TESTIDS.seatTilePressable(index)}
        accessibilityLabel={TESTIDS.seatTilePressable(index)}
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
        activeOpacity={disabled || disabledReason ? 1 : 0.7}
      >
        {hasPlayer && (
          <Animated.View style={[styles.avatarContainer, avatarAnimatedStyle]}>
            <Avatar
              value={playerUid}
              size={tileSize - 16}
              avatarUrl={playerAvatarUrl}
              avatarIndex={playerAvatarIndex}
              roomId={roomNumber}
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

        {isMySpot && hasPlayer && <Text style={styles.mySeatBadge}>我</Text>}

        {showReadyBadge && hasPlayer && <Text style={styles.readyBadge}>✅</Text>}
      </TouchableOpacity>

      {/* Floating seat number badge - overlaps top-left corner of tile */}
      <View style={styles.seatNumberBadge}>
        <Text style={styles.seatNumberText}>{index + 1}</Text>
      </View>      {hasPlayer ? (
        <>
          <Text style={styles.playerName} numberOfLines={1} ellipsizeMode="tail">
            {isBot ? '🤖 ' : ''}
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
export const SeatTile = memo(SeatTileComponent, arePropsEqual);

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
      borderWidth: 3,
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
      borderWidth: 3,
    },
    seatNumberBadge: {
      position: 'absolute',
      top: spacing.tight,
      left: spacing.tight,
      width: 22,
      height: 22,
      borderRadius: 11,
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
      backgroundColor: 'rgba(99, 102, 241, 0.3)',
      borderRadius: borderRadius.large,
    },
    wolfOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(239, 68, 68, 0.4)',
      borderRadius: borderRadius.large,
    },
    selectedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.primaryDark + '66',
      borderRadius: borderRadius.large,
    },
    mySeatBadge: {
      position: 'absolute',
      bottom: spacing.tight + spacing.tight / 2,
      right: spacing.tight + spacing.tight / 2,
      backgroundColor: colors.success,
      color: colors.textInverse,
      fontSize: typography.caption,
      fontWeight: typography.weights.bold,
      paddingHorizontal: spacing.tight + spacing.tight / 2,
      paddingVertical: spacing.tight / 2,
      borderRadius: spacing.small,
      overflow: 'hidden',
    },
    readyBadge: {
      position: 'absolute',
      bottom: spacing.tight + spacing.tight / 2,
      left: spacing.tight + spacing.tight / 2,
      // Emoji fontSize 例外：✅ 属于 Emoji 渲染尺寸，不走 typography token
      fontSize: 14,
    },
    emptyIndicator: {
      fontSize: typography.secondary,
      color: colors.textMuted,
    },
    playerName: {
      fontSize: typography.caption,
      color: colors.text,
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
      fontSize: typography.caption - 2,
      color: colors.textMuted,
      textAlign: 'center',
      width: tileSize - spacing.small,
    },
  });
}

export default SeatTile;
