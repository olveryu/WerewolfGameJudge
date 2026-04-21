/**
 * PlayerGrid - 座位网格组件
 *
 * 纯 UI，接收 SeatViewModel[] + 单个回调。
 * Styles 创建一次后传入所有 SeatTile。
 * 渲染 UI 并通过回调上报 onSeatPress，不 import service / showAlert，不包含业务逻辑判断。
 */
import React, { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  PixelRatio,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import type { SeatViewModel } from '@/screens/RoomScreen/RoomScreen.helpers';
import { colors, spacing, type ThemeColors } from '@/theme';
import { getUniqueAvatarMap } from '@/utils/avatar';

import { createSeatTileStyles, getGridColumns, SeatTile } from './SeatTile';

interface PlayerGridProps {
  /** Array of seat view models (pre-computed from game state) */
  seats: SeatViewModel[];
  /** Room number for Avatar */
  roomNumber: string;
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
  showLevels?: boolean;
}

const PlayerGridComponent: React.FC<PlayerGridProps> = ({
  seats,
  roomNumber,
  onSeatPress,
  onSeatLongPress,
  disabled = false,
  controlledSeat = null,
  showBotRoles = false,
  showLevels = false,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const gridColumns = getGridColumns(screenWidth);
  const pixelRatio = PixelRatio.get();

  // Use onLayout to measure real container width (immune to scrollbar width on Web).
  // Fall back to screenWidth minus parent padding so the first render isn't empty.
  const [containerWidth, setContainerWidth] = useState(0);
  const effectiveWidth = containerWidth || screenWidth - spacing.medium * 2;

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  // Floor to nearest device pixel to prevent sub-pixel rounding overflow
  // (roundToNearestPixel can round UP, causing the last column to wrap)
  const gridGap = spacing.small + spacing.tight;
  const tileSize =
    Math.floor(((effectiveWidth - gridGap * (gridColumns - 1)) / gridColumns) * pixelRatio) /
    pixelRatio;
  const styles = useMemo(() => createStyles(colors), []);

  // Create SeatTile styles once and pass to all tiles (performance optimization)
  // This avoids each SeatTile calling StyleSheet.create independently
  const seatTileStyles = useMemo(() => createSeatTileStyles(colors, tileSize), [tileSize]);

  // Compute room-level unique avatar indices so no two players share an avatar.
  // Only includes players without a custom avatarUrl.
  const avatarMap = useMemo(() => {
    const uids = seats
      .filter((s) => s.player?.userId && !s.player.avatarUrl)
      .map((s) => s.player!.userId);
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
    (seat: number, disabledReason?: string) => {
      onSeatPressRef.current(seat, disabledReason);
    },
    [], // No dependencies - callback is stable, always uses ref
  );

  // Use ref for long press callback as well
  const onSeatLongPressRef = useRef(onSeatLongPress);
  useLayoutEffect(() => {
    onSeatLongPressRef.current = onSeatLongPress;
  });

  const handleSeatLongPress = useCallback(
    (seat: number) => {
      onSeatLongPressRef.current?.(seat);
    },
    [], // No dependencies - callback is stable, always uses ref
  );

  return (
    <View style={styles.gridContainer} onLayout={handleLayout}>
      {seats.map((seat) => (
        <SeatTile
          key={`seat-${seat.seat}`}
          seat={seat.seat}
          roomNumber={roomNumber}
          tileSize={tileSize}
          disabled={disabled}
          disabledReason={seat.disabledReason}
          isMySpot={seat.isMySpot}
          isWolf={seat.isWolf}
          isSelected={seat.isSelected}
          isBot={seat.player?.isBot === true}
          isControlled={controlledSeat === seat.seat}
          playerUserId={seat.player?.userId ?? null}
          playerAvatarUrl={seat.player?.avatarUrl}
          playerAvatarIndex={seat.player?.userId ? avatarMap.get(seat.player.userId) : undefined}
          playerAvatarFrame={seat.player?.avatarFrame}
          playerSeatFlair={seat.player?.seatFlair}
          playerNameStyle={seat.player?.nameStyle}
          playerDisplayName={seat.player?.displayName ?? null}
          isPlayerAnonymous={!!seat.player && !seat.player.avatarUrl}
          roleId={seat.player?.role ?? null}
          showBotRole={showBotRoles && seat.player?.isBot === true}
          showReadyBadge={seat.showReadyBadge === true}
          wolfVoteBadge={seat.wolfVoteBadge}
          playerLevel={seat.player?.level}
          showLevel={showLevels}
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
      gap: spacing.small + spacing.tight,
    },
  });
}
