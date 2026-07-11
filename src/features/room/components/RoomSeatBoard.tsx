/** Windowed, lazy seat board used by every game room. */

import { useIsFocused } from '@react-navigation/native';
import type React from 'react';
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type ListRenderItemInfo,
  PixelRatio,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
  VirtualizedList,
} from 'react-native';

import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import { useAppVisibility } from '@/hooks/useAppVisibility';
import { colors, spacing } from '@/theme';

import { createRoomSeatTileStyles, getGridColumns, RoomSeatTile } from './RoomSeatTile';

interface RoomSeatBoardProps {
  readonly model: RoomSeatBoardModel;
  readonly header: React.ReactElement | null;
  readonly footer: React.ReactElement | null;
  readonly contentContainerStyle: StyleProp<ViewStyle>;
}

const RoomSeatBoardComponent: React.FC<RoomSeatBoardProps> = ({
  model,
  header,
  footer,
  contentContainerStyle,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const columns = getGridColumns(screenWidth);
  const pixelRatio = PixelRatio.get();
  const isAppVisible = useAppVisibility();
  const isFocused = useIsFocused();
  const [containerWidth, setContainerWidth] = useState(0);
  const effectiveWidth = containerWidth || screenWidth - spacing.medium * 2;
  const gap = spacing.small + spacing.tight;
  const tileSize =
    Math.floor(((effectiveWidth - gap * (columns - 1)) / columns) * pixelRatio) / pixelRatio;
  const tileStyles = useMemo(() => createRoomSeatTileStyles(colors, tileSize), [tileSize]);

  const onSeatPressRef = useRef(model.onSeatPress);
  const onSeatLongPressRef = useRef(model.onSeatLongPress);
  useLayoutEffect(() => {
    onSeatPressRef.current = model.onSeatPress;
    onSeatLongPressRef.current = model.onSeatLongPress;
  });

  const onSeatPress = useCallback((seat: number, disabledReason?: string) => {
    onSeatPressRef.current(seat, disabledReason);
  }, []);
  const onSeatLongPress = useCallback((seat: number) => {
    onSeatLongPressRef.current?.(seat);
  }, []);
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  }, []);

  const renderRow = useCallback(
    ({ item: rowIndex }: ListRenderItemInfo<number>) => {
      const firstSeat = rowIndex * columns;
      const seatsInRow = Math.min(columns, model.source.count - firstSeat);

      return (
        <View style={[styles.row, { gap, marginBottom: gap }]}>
          {Array.from({ length: seatsInRow }, (_, offset) => {
            const seatModel = model.source.getSeat(firstSeat + offset);
            return (
              <RoomSeatTile
                key={`seat-${seatModel.seat}`}
                seat={seatModel.seat}
                tileSize={tileSize}
                disabled={model.visuallyDisabled}
                disabledReason={seatModel.disabledReason}
                isMySpot={seatModel.isSelf}
                highlight={seatModel.highlight}
                isBot={seatModel.player?.kind === 'bot'}
                playerUserId={seatModel.player?.userId ?? null}
                playerAvatarUrl={seatModel.player?.avatarUrl}
                playerAvatarFrame={seatModel.player?.avatarFrame}
                playerSeatFlair={seatModel.player?.seatFlair}
                playerSeatAnimation={seatModel.player?.seatAnimation}
                playerRoleRevealEffect={seatModel.player?.roleRevealEffect}
                playerNameStyle={seatModel.player?.nameStyle}
                playerDisplayName={seatModel.player?.displayName ?? null}
                isPlayerAnonymous={seatModel.player?.isAnonymous ?? false}
                secondaryLabel={seatModel.secondaryLabel}
                showReadyBadge={seatModel.showReadyBadge}
                wolfVoteBadge={seatModel.badgeText ?? undefined}
                playerLevel={seatModel.player?.level}
                showLevel={seatModel.showLevel}
                seatDecorationsEnabled={seatModel.decorationsEnabled}
                isAppVisible={isAppVisible && isFocused}
                styles={tileStyles}
                onPress={onSeatPress}
                onLongPress={model.onSeatLongPress ? onSeatLongPress : null}
              />
            );
          })}
        </View>
      );
    },
    [
      columns,
      gap,
      isAppVisible,
      isFocused,
      model.onSeatLongPress,
      model.source,
      model.visuallyDisabled,
      onSeatLongPress,
      onSeatPress,
      tileSize,
      tileStyles,
    ],
  );

  return (
    <VirtualizedList
      data={model.source}
      extraData={model.source.revision}
      getItem={getRowIndex}
      getItemCount={() => Math.ceil(model.source.count / columns)}
      keyExtractor={getRowKey}
      renderItem={renderRow}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      contentContainerStyle={contentContainerStyle}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      onLayout={handleLayout}
    />
  );
};

function getRowIndex(_source: RoomSeatDataSource, index: number): number {
  return index;
}

function getRowKey(rowIndex: number): string {
  return `seat-row-${rowIndex}`;
}

export const RoomSeatBoard = memo(RoomSeatBoardComponent);
RoomSeatBoard.displayName = 'RoomSeatBoard';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
});
