/**
 * SeatTile - 单个座位瓦片（Memoized）
 *
 * 由 PlayerGrid 创建 styles 并传入，自定义 areEqual 防止不必要重渲染。
 * 入场/离场动画（slide up + bounce / fade out + shrink）。
 * 渲染 UI 并通过回调上报 onPress，不 import service / showAlert，不包含业务逻辑判断。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
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
import { formatSeat } from '@werewolf/game-engine/utils/formatSeat';

import { AvatarWithFrame } from '@/components/AvatarWithFrame';
import { NameStyleText } from '@/components/nameStyles';
import { getFlairById } from '@/components/seatFlairs';
import { STATUS_ICONS, UI_ICONS } from '@/config/iconTokens';
import { TESTIDS } from '@/testids';
import {
  borderRadius,
  componentSizes,
  fixed,
  shadows,
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
  readyBadgeContainer: ViewStyle;
  readyBadgeIcon: TextStyle;
  wolfVoteBadge: TextStyle;
  levelBadge: ViewStyle;
  levelBadgeText: TextStyle;
  emptyIndicator: TextStyle;
  emptyTile: ViewStyle;
  rippleRing: ViewStyle;
  playerName: TextStyle;
  playerNameHighlight: TextStyle;
  playerNamePlaceholder: ViewStyle;
  botRoleName: TextStyle;
}

export interface SeatTileProps {
  // Primitive props for stable comparison
  seat: number;
  roomCode: string;
  tileSize: number;
  disabled: boolean;
  disabledReason?: string;
  isMySpot: boolean;
  isWolf: boolean;
  isSelected: boolean;
  isBot: boolean;
  isControlled: boolean; // Host is controlling this bot seat
  // Player info (null if empty seat)
  playerUserId: string | null;
  playerAvatarUrl?: string;
  /** Pre-computed unique avatar seat (from room-level dedup). Undefined = use hash fallback. */
  playerAvatarIndex?: number;
  playerAvatarFrame?: string;
  /** Seat flair ID (decoration animation around the tile). */
  playerSeatFlair?: string;
  /** Name style ID (text effect on player name). */
  playerNameStyle?: string;
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
  /** Player level (from growth system). */
  playerLevel?: number;
  /** Whether to show the level label below the player name (lobby phases only). */
  showLevel: boolean;
  // Styles (created once in PlayerGrid)
  styles: SeatTileStyles;
  onPress: (seat: number, disabledReason?: string) => void;
  /** Long press callback for takeover bot seat (debug mode) */
  onLongPress?: (seat: number) => void;
}

const SeatTileComponent: React.FC<SeatTileProps> = ({
  seat,
  roomCode,
  tileSize,
  disabled,
  disabledReason,
  isMySpot,
  isWolf,
  isSelected,
  isBot,
  isControlled,
  playerUserId,
  playerAvatarUrl,
  playerAvatarIndex,
  playerAvatarFrame,
  playerSeatFlair,
  playerNameStyle,
  playerDisplayName,
  isPlayerAnonymous,
  roleId,
  showBotRole,
  showReadyBadge,
  wolfVoteBadge,
  playerLevel,
  showLevel,
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

  const hasPlayer = playerUserId !== null;

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

  // C1: Ripple ring on join
  const rippleScale = useMemo(() => new Animated.Value(0), []);
  const rippleOpacity = useMemo(() => new Animated.Value(0), []);

  // C2: Ready badge pop-in
  // eslint-disable-next-line react-hooks/exhaustive-deps -- showReadyBadge is intentionally only used for initial value
  const readyBadgeScale = useMemo(() => new Animated.Value(showReadyBadge ? 1 : 0), []);
  const prevShowReadyBadgeRef = useRef(showReadyBadge);

  // C4/C5: Selected tile pop/shrink
  const selectedScale = useMemo(() => new Animated.Value(1), []);
  const prevIsSelectedRef = useRef(isSelected);

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

      // C1: Fire ripple ring animation
      rippleScale.setValue(0.5);
      rippleOpacity.setValue(0.6);
      Animated.parallel([
        Animated.timing(rippleScale, {
          toValue: 1.8,
          duration: 300,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(rippleOpacity, {
          toValue: 0,
          duration: 300,
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
  }, [hasPlayer, slideAnim, scaleAnim, opacityAnim, rippleScale, rippleOpacity]);

  // C2: Ready badge pop-in animation
  useEffect(() => {
    if (!prevShowReadyBadgeRef.current && showReadyBadge) {
      readyBadgeScale.setValue(0);
      Animated.spring(readyBadgeScale, {
        toValue: 1,
        friction: 5,
        tension: 200,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    } else if (prevShowReadyBadgeRef.current && !showReadyBadge) {
      readyBadgeScale.setValue(0);
    }
    prevShowReadyBadgeRef.current = showReadyBadge;
  }, [showReadyBadge, readyBadgeScale]);

  // C4/C5: Selected tile pop/shrink animation
  useEffect(() => {
    if (!prevIsSelectedRef.current && isSelected) {
      // C4: Pop on select
      selectedScale.setValue(1);
      Animated.sequence([
        Animated.spring(selectedScale, {
          toValue: 1.08,
          friction: 8,
          tension: 300,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.spring(selectedScale, {
          toValue: 1,
          friction: 8,
          tension: 200,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    } else if (prevIsSelectedRef.current && !isSelected) {
      // C5: Shrink on deselect
      Animated.sequence([
        Animated.timing(selectedScale, {
          toValue: 0.96,
          duration: 60,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.spring(selectedScale, {
          toValue: 1,
          friction: 10,
          tension: 200,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    }
    prevIsSelectedRef.current = isSelected;
  }, [isSelected, selectedScale]);

  const avatarAnimatedStyle = {
    transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
    opacity: opacityAnim,
  };

  // C4/C5: Tile scale animated style
  const tileAnimatedStyle = {
    transform: [{ scale: selectedScale }],
  };

  // C1: Ripple ring animated style
  const rippleStyle = {
    ...styles.rippleRing,
    transform: [{ scale: rippleScale }],
    opacity: rippleOpacity,
  };

  // Get role display name for bot (debug mode only)
  const botRoleDisplayName = showBotRole && roleId ? getRoleDisplayName(roleId) : null;

  // Resolve seat flair component
  const flairConfig = useMemo(() => getFlairById(playerSeatFlair), [playerSeatFlair]);
  const FlairComponent = flairConfig?.Component;
  const flairSize = tileSize - spacing.tight;

  return (
    <View style={styles.tileWrapper} testID={TESTIDS.seatTile(seat)}>
      <Animated.View style={tileAnimatedStyle}>
        <TouchableOpacity
          testID={TESTIDS.seatTilePressable(seat)}
          accessibilityLabel={
            playerDisplayName
              ? `座位${formatSeat(seat)} ${playerDisplayName}`
              : `座位${formatSeat(seat)}`
          }
          style={[
            styles.playerTile,
            !hasPlayer && styles.emptyTile,
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
              <AvatarWithFrame
                value={playerUserId}
                size={tileSize - spacing.tight - fixed.borderWidthThick * 2}
                avatarUrl={playerAvatarUrl}
                avatarIndex={playerAvatarIndex}
                roomId={roomCode}
                borderRadius={borderRadius.large - fixed.borderWidthThick}
                frameId={playerAvatarFrame}
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

          {/* Seat flair animation layer — on top of avatar */}
          {hasPlayer && FlairComponent && (
            <FlairComponent size={flairSize} borderRadius={borderRadius.large} />
          )}

          {!hasPlayer && <Text style={styles.emptyIndicator}>+</Text>}

          {showReadyBadge && hasPlayer && (
            <Animated.View
              style={[styles.readyBadgeContainer, { transform: [{ scale: readyBadgeScale }] }]}
            >
              <Ionicons
                name={STATUS_ICONS.READY}
                size={componentSizes.icon.md}
                style={styles.readyBadgeIcon}
              />
            </Animated.View>
          )}

          {wolfVoteBadge != null && hasPlayer && (
            <Text style={styles.wolfVoteBadge}>{wolfVoteBadge}</Text>
          )}

          {showLevel && playerLevel != null && hasPlayer && !botRoleDisplayName && (
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>Lv{playerLevel}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* C1: Ripple ring — expands and fades on player join */}
        <Animated.View style={rippleStyle} pointerEvents="none" />
      </Animated.View>

      {/* Floating seat number badge - overlaps top-left corner of tile */}
      <View
        style={[styles.seatNumberBadge, isMySpot && hasPlayer && styles.mySeatNumberBadge]}
        testID={isMySpot && hasPlayer ? 'my-seat-badge' : undefined}
      >
        <Text style={styles.seatNumberText}>{seat + 1}</Text>
      </View>
      {hasPlayer ? (
        <>
          <NameStyleText
            styleId={playerNameStyle}
            style={isPlayerAnonymous ? styles.playerName : styles.playerNameHighlight}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {isBot && <Ionicons name={UI_ICONS.BOT} size={typography.caption} />}
            {isBot && ' '}
            {playerDisplayName}
          </NameStyleText>
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
      overflow: 'visible' as const,
    },
    playerTile: {
      width: tileSize - spacing.tight,
      height: tileSize - spacing.tight,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.border,
      overflow: 'visible' as const,
      ...shadows.md,
    },
    mySpotTile: {},
    wolfTile: {
      backgroundColor: withAlpha(colors.wolf, 0.08),
      boxShadow: `0px 0px 8px ${withAlpha(colors.wolf, 0.4)}`,
      elevation: 6,
    },
    selectedTile: {
      backgroundColor: colors.primaryDark,
      borderColor: colors.primaryDark,
      boxShadow: `0px 0px 16px ${withAlpha(colors.primaryDark, 0.5)}`,
    },
    controlledTile: {
      borderColor: colors.warning,
      borderWidth: fixed.borderWidthHighlight,
    },
    seatNumberBadge: {
      position: 'absolute',
      top: -spacing.tight,
      left: spacing.micro,
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
      overflow: 'visible' as const,
    },
    avatarOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: withAlpha(colors.primary, 0.302),
      borderRadius: borderRadius.large,
    },
    wolfOverlay: {},
    selectedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: withAlpha(colors.primaryDark, 0.35),
      borderRadius: borderRadius.large,
    },
    mySeatNumberBadge: {
      backgroundColor: colors.success,
      boxShadow: `0px 0px 6px ${withAlpha(colors.success, 0.4)}`,
    },
    readyBadgeContainer: {
      position: 'absolute',
      bottom: -spacing.tight,
      right: -spacing.tight,
      zIndex: 10,
    },
    readyBadgeIcon: {
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
    levelBadge: {
      position: 'absolute',
      bottom: -spacing.tight,
      alignSelf: 'center',
      backgroundColor: withAlpha(colors.background, 0.85),
      paddingHorizontal: spacing.tight + spacing.micro,
      paddingVertical: spacing.micro / 2,
      borderRadius: borderRadius.full,
      zIndex: 10,
    },
    levelBadgeText: {
      fontSize: typography.captionSmall,
      fontWeight: typography.weights.bold,
      color: colors.textMuted,
    },
    emptyIndicator: {
      fontSize: typography.subtitle,
      lineHeight: typography.lineHeights.subtitle,
      color: withAlpha(colors.primary, 0.4),
    },
    emptyTile: {
      borderStyle: 'dashed' as const,
      borderColor: withAlpha(colors.primary, 0.25),
      backgroundColor: withAlpha(colors.primary, 0.03),
    },
    rippleRing: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.primary,
      borderRadius: borderRadius.large,
    },
    playerName: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.tight,
      width: tileSize - spacing.tight,
      height: typography.subtitle,
    },
    playerNameHighlight: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.primary,
      textAlign: 'center',
      marginTop: spacing.tight,
      width: tileSize - spacing.tight,
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
      width: tileSize - spacing.tight,
    },
  });
}
