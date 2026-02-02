/**
 * PlayerGrid.tsx - Seat grid display component
 *
 * This is a pure UI component that displays player seats.
 * It receives a SeatViewModel[] and a single callback.
 *
 * Performance optimization:
 * - Each seat is rendered by a memoized SeatTile component
 * - SeatTile only re-renders when its specific props change
 * - This prevents full grid re-render on seat selection/swap
 * - Uses ref pattern to ensure callback always calls latest version
 *   even when SeatTile is memoized and doesn't re-render
 *
 * ❌ Do NOT import: any Service singletons, showAlert
 * ✅ Allowed: types, styles, UI components (Avatar, etc.)
 */
import React, { useMemo, memo, useCallback, useRef, useLayoutEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useColors, type ThemeColors } from '../../../theme';
import type { SeatViewModel } from '../RoomScreen.helpers';
import { SeatTile, GRID_COLUMNS } from './SeatTile';

// Grid calculation - needs to be exported for Avatar sizing
const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const TILE_SIZE = (SCREEN_WIDTH - 48) / GRID_COLUMNS;
// Re-export GRID_COLUMNS for external use
export { GRID_COLUMNS } from './SeatTile';

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

  // Use ref to always call the latest onSeatPress callback.
  // This is necessary because SeatTile is memoized and won't re-render
  // when parent re-renders with a new callback reference.
  // By keeping the latest callback in a ref and using a stable wrapper,
  // SeatTile can stay memoized but still call the latest callback.
  const onSeatPressRef = useRef(onSeatPress);
  useLayoutEffect(() => {
    onSeatPressRef.current = onSeatPress;
  });

  // Stable callback reference that uses ref internally
  const handleSeatPress = useCallback(
    (seatIndex: number, disabledReason?: string) => {
      onSeatPressRef.current(seatIndex, disabledReason);
    },
    [], // No dependencies - callback is stable, always uses ref
  );

  return (
    <View style={styles.gridContainer}>
      {seats.map((seat) => (
        <SeatTile
          key={`seat-${seat.index}`}
          index={seat.index}
          roomNumber={roomNumber}
          tileSize={TILE_SIZE}
          disabled={disabled}
          disabledReason={seat.disabledReason}
          isMySpot={seat.isMySpot}
          isWolf={seat.isWolf}
          isSelected={seat.isSelected}
          playerUid={seat.player?.uid ?? null}
          playerAvatarUrl={seat.player?.avatarUrl}
          playerDisplayName={seat.player?.displayName ?? null}
          onPress={handleSeatPress}
        />
      ))}
    </View>
  );
};

// Memoize to prevent re-renders when parent updates but props haven't changed
export const PlayerGrid = memo(PlayerGridComponent);

function createStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
    },
  });
}

export default PlayerGrid;
