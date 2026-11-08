/**
 * Shared gallery album shell: heading, entry list, follow behaviour and the
 * controls dock. Both galleries are the same mechanism — only the entry
 * rendering and the follow direction differ per game.
 *
 * - `follow: 'top'` keeps the newest entry visible by measuring entry
 *   heights and scrolling to the latest entry offset (Pictionary album).
 *   A footer spacer leaves room below the latest entry so it can sit at
 *   the viewport top.
 * - `follow: 'bottom'` is chat-style tail follow: the list scrolls to the
 *   end as new segments arrive, stops when the player scrolls up, and
 *   resumes once they are back at the bottom (Story Relay).
 * - `follow: 'none'` is the ended state: free browsing, no auto-scroll.
 *
 * Extracted verbatim from PictionaryAlbumStage; Pictionary itself now uses
 * this shell, so there is exactly one implementation.
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { FlatList, StyleSheet, View } from 'react-native';

import { getLatestEntryOffset } from '@/features/room/components/galleryAlbumLayout';
import { STAGE_FRAME_MAX_WIDTH } from '@/features/room/components/StageFrame';
import { colors, fixed, spacing } from '@/theme';

export type GalleryAlbumFollowMode = 'top' | 'bottom' | 'none';

interface GalleryAlbumStageProps<TEntry extends { readonly id: string }> {
  /** Revealed entries, in display order. Entries need a stable id. */
  readonly entries: readonly TEntry[];
  /** Renders one entry; game content, supplied by the caller. */
  readonly renderEntry: (entry: TEntry, index: number) => React.ReactNode;
  /** Heading node, usually a GalleryAlbumHeading. */
  readonly heading: React.ReactNode;
  readonly follow: GalleryAlbumFollowMode;
  /** Controls dock node: playback controls, rescue, pager or share. */
  readonly controls: React.ReactNode;
  /** Root test id. */
  readonly testID: string;
  /** FlatList test id. */
  readonly listTestID: string;
  /** Shown when entries is empty. */
  readonly listEmptyComponent?: React.ComponentType | React.ReactElement | null;
}

const ALBUM_GAP = spacing.large;
const ALBUM_PADDING = spacing.medium;
const BOTTOM_FOLLOW_THRESHOLD = 40;

export function GalleryAlbumStage<TEntry extends { readonly id: string }>({
  entries,
  renderEntry,
  heading,
  follow,
  controls,
  testID,
  listTestID,
  listEmptyComponent,
}: GalleryAlbumStageProps<TEntry>) {
  const scrollRef = useRef<FlatList<TEntry> | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState<number | null>(null);
  const [entryHeights, setEntryHeights] = useState<Record<string, number>>({});
  const followBottomRef = useRef(true);

  const entryIds = entries.map((entry) => entry.id);
  const latestEntryId = entries.at(-1)?.id;
  const latestEntryHeight = latestEntryId === undefined ? undefined : entryHeights[latestEntryId];
  // Leaves room below the latest entry so it can sit at the viewport top.
  const footerHeight =
    follow === 'top' ? Math.max(0, viewportHeight - (latestEntryHeight ?? 0)) : 0;
  const latestEntryOffset = getLatestEntryOffset({
    entryIds,
    entryHeights,
    headerHeight,
    gap: ALBUM_GAP,
    paddingTop: ALBUM_PADDING,
  });

  // The target depends only on content above the latest entry, so banner-driven
  // viewport changes cannot move it. footerHeight stays a dependency because the
  // browser clamps scrollTop while the viewport grows before the footer catches
  // up; re-issuing the same offset after the footer commit restores alignment.
  useEffect(() => {
    if (follow !== 'top' || latestEntryOffset === null) return;
    scrollRef.current?.scrollToOffset({ offset: latestEntryOffset, animated: true });
  }, [follow, footerHeight, latestEntryOffset]);

  useEffect(() => {
    if (follow !== 'bottom') return;
    if (!followBottomRef.current) return;
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [follow, entries.length]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    followBottomRef.current =
      contentSize.height - (contentOffset.y + layoutMeasurement.height) < BOTTOM_FOLLOW_THRESHOLD;
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: TEntry; index: number }) => (
      <View
        onLayout={
          follow === 'top'
            ? (event) => {
                const height = event.nativeEvent.layout.height;
                setEntryHeights((prev) =>
                  prev[item.id] === height ? prev : { ...prev, [item.id]: height },
                );
              }
            : undefined
        }
      >
        {renderEntry(item, index)}
      </View>
    ),
    [follow, renderEntry],
  );

  return (
    <View style={styles.albumStage} testID={testID}>
      <FlatList
        ref={scrollRef}
        testID={listTestID}
        data={entries}
        renderItem={renderItem}
        keyExtractor={(entry) => entry.id}
        initialNumToRender={entries.length}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        ListEmptyComponent={listEmptyComponent ?? null}
        ListHeaderComponent={
          <View onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
            {heading}
          </View>
        }
        ListFooterComponent={
          follow === 'top' ? (
            <View testID="gallery-album-footer" style={{ height: footerHeight }} />
          ) : null
        }
        contentContainerStyle={styles.albumContent}
        onScroll={follow === 'bottom' ? handleScroll : undefined}
        scrollEventThrottle={follow === 'bottom' ? 16 : undefined}
      />
      <View style={styles.controlsDock}>{controls}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  albumStage: {
    width: '100%',
    maxWidth: STAGE_FRAME_MAX_WIDTH,
    minHeight: 0,
    flex: 1,
    alignSelf: 'center',
  },
  albumContent: { flexGrow: 1, gap: ALBUM_GAP, padding: ALBUM_PADDING },
  controlsDock: {
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
