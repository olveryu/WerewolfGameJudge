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
 * - Styles are created once in PlayerGrid and passed to all SeatTile instances
 *   to avoid redundant StyleSheet.create calls
 *
 * ❌ Do NOT import: any Service singletons, showAlert
 * ✅ Allowed: types, styles, UI components (Avatar, etc.)
 */
import React, { useMemo, memo, useCallback, useRef, useLayoutEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useColors, type ThemeColors } from '../../../theme';
import type { SeatViewModel } from '../RoomScreen.helpers';
import { SeatTile, GRID_COLUMNS, createSeatTileStyles } from './SeatTile';
import { getUniqueAvatarMap } from '../../../utils/avatar';

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
  /** Callback when a seat is long-pressed (for bot takeover in debug mode) */
  onSeatLongPress?: (seatIndex: number) => void;
  /** Whether seat presses are disabled (e.g., during audio) */
  disabled?: boolean;
  /** Currently controlled bot seat (debug mode) */
  controlledSeat?: number | null;
  /** Whether to show bot roles (isHost && debugMode?.botsEnabled) */
  showBotRoles?: boolean;
}

const PlayerGridComponent: React.FC<PlayerGridProps> = ({
  seats,
  roomNumber,
  onSeatPress,
  onSeatLongPress,
  disabled = false,
  controlledSeat = null,
  showBotRoles = false,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Create SeatTile styles once and pass to all tiles (performance optimization)
  // This avoids each SeatTile calling StyleSheet.create independently
  const seatTileStyles = useMemo(() => createSeatTileStyles(colors, TILE_SIZE), [colors]);

  // Compute room-level unique avatar indices so no two players share an avatar.
  // Only includes players without a custom avatarUrl.
  const avatarMap = useMemo(() => {
    const uids = seats
      .filter((s) => s.player?.uid && !s.player.avatarUrl)
      .map((s) => s.player!.uid);
    return getUniqueAvatarMap(roomNumber, uids);
  }, [seats, roomNumber]);

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

  // Use ref for long press callback as well
  const onSeatLongPressRef = useRef(onSeatLongPress);
  useLayoutEffect(() => {
    onSeatLongPressRef.current = onSeatLongPress;
  });

  const handleSeatLongPress = useCallback(
    (seatIndex: number) => {
      onSeatLongPressRef.current?.(seatIndex);
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
          isBot={seat.player?.isBot === true}
          isControlled={controlledSeat === seat.index}
          playerUid={seat.player?.uid ?? null}
          playerAvatarUrl={seat.player?.avatarUrl}
          playerAvatarIndex={
            seat.player?.uid ? avatarMap.get(seat.player.uid) : undefined
          }
          playerDisplayName={seat.player?.displayName ?? null}
          roleId={seat.player?.role ?? null}
          showBotRole={showBotRoles && seat.player?.isBot === true}
          styles={seatTileStyles}
          onPress={handleSeatPress}
          onLongPress={handleSeatLongPress}
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
