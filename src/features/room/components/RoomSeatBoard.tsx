/** Windowed, lazy seat board used by every game room. */

import Ionicons from '@expo/vector-icons/Ionicons';
import { useIsFocused } from '@react-navigation/native';
import type React from 'react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type ListRenderItemInfo,
  PixelRatio,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ViewStyle,
  VirtualizedList,
} from 'react-native';

import { useAppVisibility } from '@/features/product/hooks/useAppVisibility';
import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import { TESTIDS } from '@/testids';
import { colors, componentSizes, fixed, spacing, typography } from '@/theme';

import { createRoomSeatTileStyles, getGridColumns, RoomSeatTile } from './RoomSeatTile';

interface RoomSeatBoardProps {
  readonly model: RoomSeatBoardModel;
  readonly header: React.ReactElement | null;
  readonly footer: React.ReactElement | null;
  readonly contentContainerStyle: StyleProp<ViewStyle>;
}

const ROWS_PER_PAGE = 12;

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
  const [contentWidth, setContentWidth] = useState(0);
  const effectiveWidth = contentWidth || screenWidth - spacing.medium * 2;
  const gap = spacing.small + spacing.tight;
  const seatsPerPage = columns * ROWS_PER_PAGE;
  const pageCount = Math.max(1, Math.ceil(model.source.count / seatsPerPage));
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [isPageInputInvalid, setIsPageInputInvalid] = useState(false);
  const currentPage = Math.min(page, pageCount);
  const firstSeat = (currentPage - 1) * seatsPerPage;
  const visibleSeatCount = Math.min(seatsPerPage, model.source.count - firstSeat);
  const tileSize =
    Math.floor(((effectiveWidth - gap * (columns - 1)) / columns) * pixelRatio) / pixelRatio;
  const tileStyles = useMemo(() => createRoomSeatTileStyles(colors, tileSize), [tileSize]);

  const onSeatPressRef = useRef(model.onSeatPress);
  const onBotSeatLongPressRef = useRef(model.onBotSeatLongPress);
  useLayoutEffect(() => {
    onSeatPressRef.current = model.onSeatPress;
    onBotSeatLongPressRef.current = model.onBotSeatLongPress;
  });

  const onSeatPress = useCallback((seat: number, disabledReason?: string) => {
    onSeatPressRef.current(seat, disabledReason);
  }, []);
  const onBotSeatLongPress = useCallback((seat: number) => {
    onBotSeatLongPressRef.current?.(seat);
  }, []);
  const handleContentLayout = useCallback((event: LayoutChangeEvent) => {
    setContentWidth(event.nativeEvent.layout.width);
  }, []);

  useEffect(() => {
    const nextPage = Math.min(page, pageCount);
    if (nextPage !== page) setPage(nextPage);
    setPageInput(String(nextPage));
    setIsPageInputInvalid(false);
  }, [page, pageCount]);

  const goToPage = useCallback(
    (nextPage: number) => {
      if (!Number.isSafeInteger(nextPage) || nextPage < 1 || nextPage > pageCount) {
        throw new Error(`Room seat page is out of range: ${nextPage}`);
      }
      setPage(nextPage);
      setPageInput(String(nextPage));
      setIsPageInputInvalid(false);
    },
    [pageCount],
  );

  const commitPageInput = useCallback(() => {
    if (!/^\d+$/.test(pageInput)) {
      setIsPageInputInvalid(true);
      return;
    }
    const requestedPage = Number(pageInput);
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 || requestedPage > pageCount) {
      setIsPageInputInvalid(true);
      return;
    }
    goToPage(requestedPage);
  }, [goToPage, pageCount, pageInput]);

  const renderRow = useCallback(
    ({ item: rowIndex }: ListRenderItemInfo<number>) => {
      const firstSeatInRow = firstSeat + rowIndex * columns;
      const seatsInRow = Math.min(columns, model.source.count - firstSeatInRow);

      return (
        <View style={[styles.row, { gap, marginBottom: gap }]}>
          {Array.from({ length: seatsInRow }, (_, offset) => {
            const seatModel = model.source.getSeat(firstSeatInRow + offset);
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
                playerSeatPetId={seatModel.player?.seatPetId}
                playerNameStyle={seatModel.player?.nameStyle}
                playerDisplayName={seatModel.player?.displayName ?? null}
                isPlayerAnonymous={seatModel.player?.isAnonymous ?? false}
                secondaryLabel={seatModel.secondaryLabel}
                showReadyBadge={seatModel.showReadyBadge}
                badgeText={seatModel.badgeText ?? undefined}
                playerLevel={seatModel.player?.level}
                showLevel={seatModel.showLevel}
                seatDecorationsEnabled={seatModel.decorationsEnabled}
                isAppVisible={isAppVisible && isFocused}
                styles={tileStyles}
                onPress={onSeatPress}
                onLongPress={
                  seatModel.player?.kind === 'bot' && model.onBotSeatLongPress !== null
                    ? onBotSeatLongPress
                    : null
                }
              />
            );
          })}
        </View>
      );
    },
    [
      columns,
      firstSeat,
      gap,
      isAppVisible,
      isFocused,
      model.onBotSeatLongPress,
      model.source,
      model.visuallyDisabled,
      onBotSeatLongPress,
      onSeatPress,
      tileSize,
      tileStyles,
    ],
  );

  const listHeader = (
    <>
      <View
        style={styles.contentWidthProbe}
        onLayout={handleContentLayout}
        testID={TESTIDS.roomSeatContentWidthProbe}
      />
      {header}
      {pageCount > 1 && (
        <View style={styles.pagination} testID={TESTIDS.roomSeatPagination}>
          <TouchableOpacity
            style={styles.pageButton}
            onPress={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            accessibilityLabel="上一页座位"
            testID={TESTIDS.roomSeatPreviousPage}
          >
            <Ionicons
              name="chevron-back"
              size={componentSizes.icon.sm}
              color={currentPage === 1 ? colors.textMuted : colors.text}
            />
          </TouchableOpacity>
          <Text style={styles.pageLabel}>第</Text>
          <TextInput
            value={pageInput}
            onChangeText={(value) => {
              setPageInput(value);
              setIsPageInputInvalid(false);
            }}
            onSubmitEditing={commitPageInput}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={String(pageCount).length}
            selectTextOnFocus
            style={[styles.pageInput, isPageInputInvalid && styles.pageInputInvalid]}
            accessibilityLabel="座位页码"
            testID={TESTIDS.roomSeatPageInput}
          />
          <Text style={styles.pageLabel}>/ {pageCount} 页</Text>
          <TouchableOpacity
            style={styles.pageButton}
            onPress={() => goToPage(currentPage + 1)}
            disabled={currentPage === pageCount}
            accessibilityLabel="下一页座位"
            testID={TESTIDS.roomSeatNextPage}
          >
            <Ionicons
              name="chevron-forward"
              size={componentSizes.icon.sm}
              color={currentPage === pageCount ? colors.textMuted : colors.text}
            />
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  const getRowKey = useCallback(
    (rowIndex: number): string => `seat-row-${firstSeat + rowIndex * columns}`,
    [columns, firstSeat],
  );

  return (
    <VirtualizedList
      data={model.source}
      extraData={`${model.source.revision}:${currentPage}`}
      getItem={getRowIndex}
      getItemCount={() => Math.ceil(visibleSeatCount / columns)}
      keyExtractor={getRowKey}
      renderItem={renderRow}
      ListHeaderComponent={listHeader}
      ListFooterComponent={footer}
      contentContainerStyle={contentContainerStyle}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
    />
  );
};

function getRowIndex(_source: RoomSeatDataSource, index: number): number {
  return index;
}

export const RoomSeatBoard = memo(RoomSeatBoardComponent);
RoomSeatBoard.displayName = 'RoomSeatBoard';

const styles = StyleSheet.create({
  contentWidthProbe: {
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: componentSizes.button.md,
    marginBottom: spacing.medium,
  },
  pageButton: {
    width: componentSizes.button.md,
    height: componentSizes.button.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageLabel: {
    fontSize: typography.secondary,
    lineHeight: typography.secondary * 1.4,
    color: colors.textSecondary,
  },
  pageInput: {
    minWidth: 64,
    maxWidth: 120,
    height: componentSizes.button.sm,
    marginHorizontal: spacing.tight,
    paddingHorizontal: spacing.small,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    textAlign: 'center',
    fontSize: typography.secondary,
    lineHeight: typography.secondary * 1.4,
    color: colors.text,
  },
  pageInputInvalid: {
    borderColor: colors.error,
  },
});
