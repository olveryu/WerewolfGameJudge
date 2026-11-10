/**
 * Shared gallery album shell: heading, entry list, follow behaviour and the controls dock.
 *
 * - `follow: 'top'` aligns the newest entry with the list top once a second entry arrives; a
 *   bottom spacer sized to the shortfall lets even the last entry reach the top.
 * - `follow: 'bottom'` is chat-style tail follow: the list scrolls to the end as new entries
 *   arrive, stops when the player scrolls up, and resumes once they are back at the bottom.
 * - `follow: 'none'` is the ended state: free browsing, no auto-scroll.
 */

import './GalleryAlbumStage.css';

import { type ReactNode, type UIEvent, useEffect, useLayoutEffect, useRef } from 'react';

type GalleryAlbumFollowMode = 'top' | 'bottom' | 'none';

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

/** Sizes the spacer so `latest` can reach the list top, then scrolls it there. */
function alignLatestEntryToTop(
  list: HTMLDivElement,
  latest: HTMLDivElement,
  spacer: HTMLDivElement,
): void {
  spacer.style.height = '0px';
  const latestOffset =
    latest.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
  const shortfall = latestOffset + list.clientHeight - list.scrollHeight;
  spacer.style.height = `${Math.max(0, shortfall)}px`;
  list.scrollTop = latestOffset;
}

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
  const latestEntryRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const followBottomRef = useRef(true);

  useLayoutEffect(() => {
    if (follow !== 'top' || entries.length < 2) return;
    const list = listRef.current;
    const latest = latestEntryRef.current;
    const spacer = spacerRef.current;
    if (list === null || latest === null || spacer === null) {
      throw new Error('Gallery album top-follow nodes missing');
    }
    alignLatestEntryToTop(list, latest, spacer);
    // Realign when the viewport or any content above the spacer changes size (e.g. a drawing
    // finishes rendering), since either moves the latest entry's offset or the shortfall.
    const observer = new ResizeObserver(() => alignLatestEntryToTop(list, latest, spacer));
    observer.observe(list);
    for (const child of list.children) {
      if (child !== spacer) observer.observe(child);
    }
    return () => observer.disconnect();
  }, [follow, entries.length]);

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
          : entries.map((entry, index) => (
              <div key={entry.id} ref={index === entries.length - 1 ? latestEntryRef : undefined}>
                {renderEntry(entry, index)}
              </div>
            ))}
        {follow === 'top' && <div ref={spacerRef} className="gallery-album-spacer" aria-hidden />}
      </div>
      <div className="gallery-album-controls">{controls}</div>
    </div>
  );
}
