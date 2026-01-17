/**
 * PlayerGrid.tsx - Seat grid display component
 *
 * This is a pure UI component that displays player seats.
 * It receives a SeatViewModel[] and a single callback.
 *
 * ❌ Do NOT import: any Service singletons
 * ✅ Allowed: types, styles, UI components (Avatar, etc.)
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { styles, TILE_SIZE } from '../RoomScreen.styles';
import { TESTIDS } from '../../../testids';
import type { SeatViewModel } from '../RoomScreen.helpers';
import { showAlert } from '../../../utils/alert';

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
              <Text style={styles.playerName} numberOfLines={1}>
                {seat.player.displayName}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
};

export default PlayerGrid;
