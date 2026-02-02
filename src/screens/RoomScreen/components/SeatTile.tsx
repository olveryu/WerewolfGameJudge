/**
 * SeatTile.tsx - Individual seat tile component (memoized)
 *
 * This component renders a single seat in the PlayerGrid.
 * It is memoized with a custom areEqual function to prevent
 * unnecessary re-renders when seat data hasn't changed.
 *
 * Performance notes:
 * - Styles are created once in PlayerGrid and passed as prop (not created per-tile)
 * - arePropsEqual compares styles reference to ensure memo works correctly
 * - PlayerGrid provides a stable callback using ref pattern, so SeatTile can stay memoized
 * - This prevents full grid re-render when callback references change
 *
 * ❌ Do NOT import: any Service singletons, showAlert
 * ✅ Allowed: types, styles, UI components (Avatar, etc.)
 */
import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { spacing, typography, borderRadius, type ThemeColors } from '../../../theme';
import { TESTIDS } from '../../../testids';

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
  seatNumber: TextStyle;
  seatedSeatNumber: TextStyle;
  avatarContainer: ViewStyle;
  avatarOverlay: ViewStyle;
  wolfOverlay: ViewStyle;
  selectedOverlay: ViewStyle;
  mySeatBadge: TextStyle;
  emptyIndicator: TextStyle;
  playerName: TextStyle;
  playerNamePlaceholder: ViewStyle;
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
  // Player info (null if empty seat)
  playerUid: string | null;
  playerAvatarUrl?: string;
  playerDisplayName: string | null;
  // Styles (created once in PlayerGrid)
  styles: SeatTileStyles;
  // Callback (not compared in arePropsEqual to avoid callback identity issues)
  onPress: (seatIndex: number, disabledReason?: string) => void;
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
    prev.playerUid === next.playerUid &&
    prev.playerAvatarUrl === next.playerAvatarUrl &&
    prev.playerDisplayName === next.playerDisplayName &&
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
  playerUid,
  playerAvatarUrl,
  playerDisplayName,
  styles,
  onPress,
}) => {
  // Note: onPress callback stability is handled by PlayerGrid using ref pattern.
  // SeatTile receives a stable callback that always calls the latest parent callback.
  const handlePress = useCallback(() => {
    onPress(index, disabledReason);
  }, [onPress, index, disabledReason]);

  const hasPlayer = playerUid !== null;

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
        ]}
        onPress={handlePress}
        activeOpacity={disabled || disabledReason ? 1 : 0.7}
      >
        {hasPlayer && (
          <View style={styles.avatarContainer}>
            <Avatar
              value={playerUid}
              size={tileSize - 16}
              avatarUrl={playerAvatarUrl}
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
          </View>
        )}

        <Text style={[styles.seatNumber, hasPlayer && styles.seatedSeatNumber]}>{index + 1}</Text>

        {!hasPlayer && <Text style={styles.emptyIndicator}>空</Text>}

        {isMySpot && hasPlayer && <Text style={styles.mySeatBadge}>我</Text>}
      </TouchableOpacity>

      {hasPlayer ? (
        <Text style={styles.playerName} numberOfLines={1} ellipsizeMode="tail">
          {playerDisplayName}
        </Text>
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
      borderWidth: 2,
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
    seatNumber: {
      fontSize: typography.subtitle,
      fontWeight: '700',
      color: colors.textMuted,
      position: 'absolute',
      top: spacing.small,
      left: spacing.small + spacing.tight,
    },
    seatedSeatNumber: {
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
      fontWeight: '700',
      paddingHorizontal: spacing.tight + spacing.tight / 2,
      paddingVertical: spacing.tight / 2,
      borderRadius: spacing.small,
      overflow: 'hidden',
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
  });
}

export default SeatTile;
