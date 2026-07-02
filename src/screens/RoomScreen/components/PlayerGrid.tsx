/**
 * PlayerGrid - Seat grid component
 *
 * Pure UI: accepts SeatViewModel[] + a single callback.
 * Styles are created once and passed to all SeatTile instances.
 * Renders UI and reports onSeatPress via callback; no service/showAlert imports, no business logic.
 */
import { useIsFocused } from '@react-navigation/native';
import { getRoleDisplayName } from '@werewolf/game-engine/werewolf/models/roles';
import type React from 'react';
import { memo, useMemo } from 'react';

import { RoomSeatBoard, type RoomSeatViewModel } from '@/components/room/RoomSeatBoard';
import type { SeatViewModel } from '@/screens/RoomScreen/RoomScreen.helpers';

interface PlayerGridProps {
  /** Array of seat view models (pre-computed from game state) */
  seats: SeatViewModel[];
  /**
   * Callback when a seat is pressed.
   * Always called with seat and optional disabledReason.
   * Caller (RoomScreen) is responsible for handling the logic.
   */
  onSeatPress: (seat: number, disabledReason?: string) => void;
  /** Callback when a seat is long-pressed (for bot takeover in debug mode) */
  onSeatLongPress?: (seat: number) => void;
  /** Whether seat presses are disabled (e.g., during audio) */
  disabled?: boolean;
  /** Currently controlled bot seat (debug mode) */
  controlledSeat?: number | null;
  /** Whether to show bot roles (isHost && debugMode?.botsEnabled) */
  showBotRoles?: boolean;
  /** Whether to show player levels on seat tiles (lobby phases only) */
  showLevels?: boolean; /** Whether seat decorations (entrance animation / flair / pet) render. Disabled during the Ongoing phase to cut continuous CPU/GPU heat & battery drain. */
  seatDecorationsEnabled?: boolean;
}

const PlayerGridComponent: React.FC<PlayerGridProps> = ({
  seats,
  onSeatPress,
  onSeatLongPress,
  disabled = false,
  controlledSeat = null,
  showBotRoles = false,
  showLevels = false,
  seatDecorationsEnabled = true,
}) => {
  const isFocused = useIsFocused();
  const roomSeats = useMemo<RoomSeatViewModel[]>(
    () =>
      seats.map((seat) => ({
        seat: seat.seat,
        player: seat.player
          ? {
              ...seat.player,
              botRoleLabel:
                showBotRoles && seat.player.isBot === true && seat.player.role
                  ? getRoleDisplayName(seat.player.role)
                  : undefined,
            }
          : null,
        isMySpot: seat.isMySpot,
        isWolf: seat.isWolf,
        isSelected: seat.isSelected,
        disabledReason: seat.disabledReason,
        showReadyBadge: seat.showReadyBadge,
        statusBadgeText: seat.wolfVoteBadge,
      })),
    [seats, showBotRoles],
  );

  return (
    <RoomSeatBoard
      seats={roomSeats}
      onSeatPress={onSeatPress}
      onSeatLongPress={onSeatLongPress}
      disabled={disabled}
      controlledSeat={controlledSeat}
      showBotRoles={showBotRoles}
      showLevels={showLevels}
      seatDecorationsEnabled={seatDecorationsEnabled && isFocused}
    />
  );
};

// Memoize to prevent re-renders when parent updates but props haven't changed
export const PlayerGrid = memo(PlayerGridComponent);
