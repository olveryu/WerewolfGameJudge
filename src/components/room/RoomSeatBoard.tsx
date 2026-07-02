/**
 * RoomSeatBoard — shared responsive seat board for room-like games.
 *
 * It keeps the established Werewolf seat tile visual system while letting each
 * game mode provide its own seat view model and press policy.
 */
import { useIsFocused } from '@react-navigation/native';
import type React from 'react';
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  PixelRatio,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
  VirtualizedList,
} from 'react-native';

import { useAppVisibility } from '@/hooks/useAppVisibility';
import { colors, spacing } from '@/theme';

import { createSeatTileStyles, getGridColumns, SeatTile } from './RoomSeatTile';

export interface RoomSeatViewModel {
  seat: number;
  player: {
    userId: string;
    displayName: string;
    avatarUrl?: string;
    avatarFrame?: string;
    seatFlair?: string;
    seatAnimation?: string;
    nameStyle?: string;
    roleRevealEffect?: string;
    level?: number;
    isBot?: boolean;
    botRoleLabel?: string;
  } | null;
  isMySpot: boolean;
  isWolf?: boolean;
  isSelected?: boolean;
  disabledReason?: string;
  showReadyBadge?: boolean;
  statusBadgeText?: string;
  statusBadgeColor?: string;
}

interface RoomSeatBoardProps {
  seats: readonly RoomSeatViewModel[];
  onSeatPress: (seat: number, disabledReason?: string) => void;
  onSeatLongPress?: (seat: number) => void;
  disabled?: boolean;
  controlledSeat?: number | null;
  showBotRoles?: boolean;
  showLevels?: boolean;
  seatDecorationsEnabled?: boolean;
  virtualized?: boolean;
  listHeaderComponent?: React.ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
  seatTestIDPrefix?: string;
}

const RoomSeatBoardComponent: React.FC<RoomSeatBoardProps> = ({
  seats,
  onSeatPress,
  onSeatLongPress,
  disabled = false,
  controlledSeat = null,
  showBotRoles = false,
  showLevels = false,
  seatDecorationsEnabled = true,
  virtualized = false,
  listHeaderComponent = null,
  contentContainerStyle,
  seatTestIDPrefix,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const gridColumns = getGridColumns(screenWidth);
  const pixelRatio = PixelRatio.get();
  const isAppVisible = useAppVisibility();
  const isFocused = useIsFocused();
  const [containerWidth, setContainerWidth] = useState(0);
  const effectiveWidth = containerWidth || screenWidth - spacing.medium * 2;

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  const gridGap = spacing.small + spacing.tight;
  const tileSize =
    Math.floor(((effectiveWidth - gridGap * (gridColumns - 1)) / gridColumns) * pixelRatio) /
    pixelRatio;

  const seatTileStyles = useMemo(() => createSeatTileStyles(colors, tileSize), [tileSize]);

  const onSeatPressRef = useRef(onSeatPress);
  useLayoutEffect(() => {
    onSeatPressRef.current = onSeatPress;
  });

  const handleSeatPress = useCallback((seat: number, disabledReason?: string) => {
    onSeatPressRef.current(seat, disabledReason);
  }, []);

  const onSeatLongPressRef = useRef(onSeatLongPress);
  useLayoutEffect(() => {
    onSeatLongPressRef.current = onSeatLongPress;
  });

  const handleSeatLongPress = useCallback((seat: number) => {
    onSeatLongPressRef.current?.(seat);
  }, []);

  const renderSeat = useCallback(
    (seatVm: RoomSeatViewModel) => (
      <View
        key={`seat-${seatVm.seat}`}
        testID={seatTestIDPrefix?.replace('{seat}', String(seatVm.seat))}
      >
        <SeatTile
          seat={seatVm.seat}
          tileSize={tileSize}
          disabled={disabled}
          disabledReason={seatVm.disabledReason}
          isMySpot={seatVm.isMySpot}
          isWolf={seatVm.isWolf === true}
          isSelected={seatVm.isSelected === true}
          isBot={seatVm.player?.isBot === true}
          isControlled={controlledSeat === seatVm.seat}
          playerUserId={seatVm.player?.userId ?? null}
          playerAvatarUrl={seatVm.player?.avatarUrl}
          playerAvatarFrame={seatVm.player?.avatarFrame}
          playerSeatFlair={seatVm.player?.seatFlair}
          playerSeatAnimation={seatVm.player?.seatAnimation}
          playerRoleRevealEffect={seatVm.player?.roleRevealEffect}
          playerNameStyle={seatVm.player?.nameStyle}
          playerDisplayName={seatVm.player?.displayName ?? null}
          isPlayerAnonymous={!!seatVm.player && !seatVm.player.avatarUrl}
          botRoleLabel={seatVm.player?.botRoleLabel}
          showBotRole={showBotRoles && seatVm.player?.isBot === true}
          showReadyBadge={seatVm.showReadyBadge === true}
          statusBadgeText={seatVm.statusBadgeText}
          statusBadgeColor={seatVm.statusBadgeColor}
          playerLevel={seatVm.player?.level}
          showLevel={showLevels}
          seatDecorationsEnabled={seatDecorationsEnabled}
          isAppVisible={isAppVisible && isFocused}
          styles={seatTileStyles}
          onPress={handleSeatPress}
          onLongPress={handleSeatLongPress}
        />
      </View>
    ),
    [
      controlledSeat,
      disabled,
      handleSeatLongPress,
      handleSeatPress,
      isAppVisible,
      isFocused,
      seatDecorationsEnabled,
      seatTestIDPrefix,
      seatTileStyles,
      showBotRoles,
      showLevels,
      tileSize,
    ],
  );

  if (!virtualized) {
    return (
      <View style={styles.gridContainer} onLayout={handleLayout}>
        {seats.map(renderSeat)}
      </View>
    );
  }

  return (
    <VirtualizedList
      data={seats}
      getItem={(_, rowIndex) => rowIndex}
      getItemCount={() => Math.ceil(seats.length / gridColumns)}
      keyExtractor={(rowIndex) => `row-${rowIndex}`}
      contentContainerStyle={contentContainerStyle}
      ListHeaderComponent={listHeaderComponent}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      extraData={seats}
      renderItem={({ item: rowIndex }) => {
        const firstSeat = rowIndex * gridColumns;
        return (
          <View style={styles.row} onLayout={rowIndex === 0 ? handleLayout : undefined}>
            {Array.from({ length: gridColumns }, (_, column) => {
              const seat = seats[firstSeat + column];
              if (!seat)
                return <View key={`empty-${firstSeat + column}`} style={{ width: tileSize }} />;
              return renderSeat(seat);
            })}
          </View>
        );
      }}
    />
  );
};

export const RoomSeatBoard = memo(RoomSeatBoardComponent);

RoomSeatBoard.displayName = 'RoomSeatBoard';

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: spacing.small + spacing.tight,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: spacing.small + spacing.tight,
    paddingBottom: spacing.medium,
  },
});
