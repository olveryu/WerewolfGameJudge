/**
 * PlayerGrid.tsx - Seat grid display component
 *
 * This is a pure UI component that displays player seats.
 * It receives a SeatViewModel[] and a single callback.
 *
 * ❌ Do NOT import: any Service singletons, showAlert
 * ✅ Allowed: types, styles, UI components (Avatar, etc.)
 */
import React, { useMemo, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { useColors, spacing, typography, borderRadius, type ThemeColors } from '../../../theme';
import { TESTIDS } from '../../../testids';
import type { SeatViewModel } from '../RoomScreen.helpers';

// Grid calculation - needs to be exported for Avatar sizing
const GRID_COLUMNS = 4;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const TILE_SIZE = (SCREEN_WIDTH - 48) / GRID_COLUMNS;

export interface PlayerGridProps {
  /** Array of seat view models (pre-computed from game state) */
  seats: SeatViewModel[];
  /** Room number for Avatar */
  roomNumber: string;
  /**
   * Callback when a seat is pressed.
   * Always called with seatIndex and optional disabledReason.
   * Caller (RoomScreen) is responsible for handling the logic.
   */
  onSeatPress: (seatIndex: number, disabledReason?: string) => void;
  /** Whether seat presses are disabled (e.g., during audio) */
  disabled?: boolean;
}

const PlayerGridComponent: React.FC<PlayerGridProps> = ({
  seats,
  roomNumber,
  onSeatPress,
  disabled = false,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.gridContainer}>
      {seats.map((seat) => {
        // Key should be seat index only - seats are fixed positions
        // Don't include player/role info which causes unnecessary re-mounts when players move
        const seatKey = `seat-${seat.index}`;

        return (
          <View key={seatKey} style={styles.tileWrapper} testID={TESTIDS.seatTile(seat.index)}>
            <TouchableOpacity
              testID={TESTIDS.seatTilePressable(seat.index)}
              accessibilityLabel={TESTIDS.seatTilePressable(seat.index)}
              style={[
                styles.playerTile,
                seat.isMySpot && styles.mySpotTile,
                seat.isWolf && styles.wolfTile,
                seat.isSelected && styles.selectedTile,
              ]}
              onPress={() => {
                // Always delegate to caller with disabledReason if present
                // Caller (RoomScreen) handles all logic via SeatTapPolicy
                if (disabled) return; // Grid-level disable (audio gate)
                onSeatPress(seat.index, seat.disabledReason);
              }}
              activeOpacity={disabled || seat.disabledReason ? 1 : 0.7}
              // Don't set `disabled` here. In test environments it can prevent `press` events
              // from firing at all, which would skip our UX-only hint.
            >
              {seat.player && (
                <View style={styles.avatarContainer}>
                  <Avatar
                    value={seat.player.uid}
                    size={TILE_SIZE - 16}
                    avatarUrl={seat.player.avatarUrl}
                    seatNumber={seat.index + 1}
                    roomId={roomNumber}
                  />
                  {(seat.isWolf || seat.isSelected) && (
                    <View
                      style={[
                        styles.avatarOverlay,
                        seat.isWolf && styles.wolfOverlay,
                        seat.isSelected && styles.selectedOverlay,
                      ]}
                    />
                  )}
                </View>
              )}

              <Text style={[styles.seatNumber, seat.player && styles.seatedSeatNumber]}>
                {seat.index + 1}
              </Text>

              {!seat.player && <Text style={styles.emptyIndicator}>空</Text>}

              {seat.isMySpot && seat.player && <Text style={styles.mySeatBadge}>我</Text>}
            </TouchableOpacity>

            {seat.player && (
              <Text style={styles.playerName} numberOfLines={1} ellipsizeMode="tail">
                {seat.player.displayName}
              </Text>
            )}
            {!seat.player && <View style={styles.playerNamePlaceholder} />}
          </View>
        );
      })}
    </View>
  );
};

// Memoize to prevent re-renders when parent updates but props haven't changed
export const PlayerGrid = memo(PlayerGridComponent);

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
    },
    tileWrapper: {
      width: TILE_SIZE,
      alignItems: 'center',
      marginBottom: spacing.small,
    },
    playerTile: {
      width: TILE_SIZE - spacing.small,
      height: TILE_SIZE - spacing.small,
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
      left: spacing.small + spacing.tight, // ~12
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
      bottom: spacing.tight + spacing.tight / 2, // ~6
      right: spacing.tight + spacing.tight / 2, // ~6
      backgroundColor: colors.success,
      color: colors.textInverse,
      fontSize: typography.caption,
      fontWeight: '700',
      paddingHorizontal: spacing.tight + spacing.tight / 2, // ~6
      paddingVertical: spacing.tight / 2, // ~2
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
      width: TILE_SIZE - spacing.small,
      height: typography.subtitle, // ~18, Fixed height for consistent row layout
    },
    playerNamePlaceholder: {
      marginTop: spacing.tight,
      height: typography.subtitle, // ~18, Same height as playerName
    },
  });
}

export default PlayerGrid;
