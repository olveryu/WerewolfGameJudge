/**
 * PlayerGrid.tsx - Seat grid display component
 *
 * This is a pure UI component that displays player seats.
 * It receives a SeatViewModel[] and a single callback.
 *
 * ❌ Do NOT import: any Service singletons
 * ✅ Allowed: types, styles, UI components (Avatar, etc.)
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { useColors, spacing, typography, borderRadius, type ThemeColors } from '../../../theme';
import { TESTIDS } from '../../../testids';
import type { SeatViewModel } from '../RoomScreen.helpers';
import { showAlert } from '../../../utils/alert';

// Grid calculation - needs to be exported for Avatar sizing
const GRID_COLUMNS = 4;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const TILE_SIZE = (SCREEN_WIDTH - 48) / GRID_COLUMNS;

export interface PlayerGridProps {
  /** Array of seat view models (pre-computed from game state) */
  seats: SeatViewModel[];
  /** Room number for Avatar */
  roomNumber: string;
  /** Callback when a seat is pressed */
  onSeatPress: (seatIndex: number) => void;
  /** Whether seat presses are disabled (e.g., during audio) */
  disabled?: boolean;
}

export const PlayerGrid: React.FC<PlayerGridProps> = ({
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
        const seatKey = `seat-${seat.index}-${seat.role}`;
        const isDisabled = disabled || !!seat.disabledReason;

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
                if (isDisabled) {
                  if (seat.disabledReason) {
                    showAlert('不可选择', seat.disabledReason, [{ text: '好' }]);
                  }
                  return;
                }
                onSeatPress(seat.index);
              }}
              activeOpacity={isDisabled ? 1 : 0.7}
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
      width: TILE_SIZE - 8,
      height: TILE_SIZE - 8,
      margin: 4,
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
      top: 8,
      left: 12,
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
      bottom: 6,
      right: 6,
      backgroundColor: colors.success,
      color: colors.textInverse,
      fontSize: 12,
      fontWeight: '700',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      overflow: 'hidden',
    },
    emptyIndicator: {
      fontSize: typography.secondary,
      color: colors.textMuted,
    },
    playerName: {
      fontSize: 13,
      color: colors.text,
      textAlign: 'center',
      marginTop: 4,
      width: TILE_SIZE - 8,
      height: 18, // Fixed height for consistent row layout
    },
    playerNamePlaceholder: {
      marginTop: 4,
      height: 18, // Same height as playerName to keep rows consistent
    },
  });
}

export default PlayerGrid;
