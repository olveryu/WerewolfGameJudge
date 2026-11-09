/**
 * Shared gallery album shell: heading, entry list, follow behaviour and the controls dock.
 *
 * - `follow: 'bottom'` is chat-style tail follow: the list scrolls to the end as new entries
 *   arrive, stops when the player scrolls up, and resumes once they are back at the bottom.
 * - `follow: 'none'` is the ended state: free browsing, no auto-scroll.
 */

import './GalleryAlbumStage.css';

import { type ReactNode, type UIEvent, useEffect, useRef } from 'react';

type GalleryAlbumFollowMode = 'bottom' | 'none';

interface GalleryAlbumStageProps<TEntry extends { readonly id: string }> {
  /** Revealed entries, in display order. Entries need a stable id. */
  readonly entries: readonly TEntry[];
  /** Renders one entry; game content, supplied by the caller. */
  readonly renderEntry: (entry: TEntry, index: number) => ReactNode;
  /** Heading node, usually a GalleryAlbumHeading. */
  readonly heading: ReactNode;
  readonly follow: GalleryAlbumFollowMode;
  /** Controls dock node: playback controls, rescue, pager or share. */
  readonly controls: ReactNode;
  readonly testId: string;
  readonly listTestId: string;
  /** Shown when entries is empty. */
  readonly emptyContent: ReactNode;
}

/** Distance from the bottom (px) within which the list keeps following new entries. */
const BOTTOM_FOLLOW_THRESHOLD = 40;

/** Renders the album list with its heading and docked controls. */
export function GalleryAlbumStage<TEntry extends { readonly id: string }>({
  entries,
  renderEntry,
  heading,
  follow,
  controls,
  testId,
  listTestId,
  emptyContent,
}: GalleryAlbumStageProps<TEntry>) {
  const listRef = useRef<HTMLDivElement>(null);
  const followBottomRef = useRef(true);

  useEffect(() => {
    if (follow !== 'bottom' || !followBottomRef.current) return;
    const list = listRef.current;
    if (list === null) throw new Error('Gallery album list missing');
    list.scrollTop = list.scrollHeight;
  }, [follow, entries.length]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
    followBottomRef.current = scrollHeight - (scrollTop + clientHeight) < BOTTOM_FOLLOW_THRESHOLD;
  };

  return (
    <div className="gallery-album-stage" data-testid={testId}>
      <div
        ref={listRef}
        className="gallery-album-list"
        data-testid={listTestId}
        onScroll={follow === 'bottom' ? handleScroll : undefined}
      >
        {heading}
        {entries.length === 0
          ? emptyContent
          : entries.map((entry, index) => <div key={entry.id}>{renderEntry(entry, index)}</div>)}
      </div>
      <div className="gallery-album-controls">{controls}</div>
    </div>
  );
}
