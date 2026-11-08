/**
 * Pure layout math for the synchronized Pictionary album.
 *
 * The album FlatList lays out `[heading, entry₁ … entryₙ, footer]` inside a
 * content container with `paddingTop` and a uniform `gap`. The offset that
 * puts the latest entry's top edge at the viewport top therefore depends only
 * on what sits above it — never on the footer or the viewport height, both of
 * which change whenever the room shell shows or hides a banner.
 */

export interface LatestEntryOffsetInput {
  /** Entry ids in render order. */
  readonly entryIds: readonly string[];
  /** Measured entry heights by id; entries not yet laid out are absent. */
  readonly entryHeights: Readonly<Record<string, number>>;
  /** Measured heading height, or null before its first layout. */
  readonly headerHeight: number | null;
  readonly gap: number;
  readonly paddingTop: number;
}

/**
 * Content offset of the latest entry's top edge, or null while any height above
 * it is still unmeasured. A single entry keeps the heading visible (offset 0).
 */
export function getLatestEntryOffset({
  entryIds,
  entryHeights,
  headerHeight,
  gap,
  paddingTop,
}: LatestEntryOffsetInput): number | null {
  if (entryIds.length === 0) return null;
  if (entryIds.length === 1) return 0;
  if (headerHeight === null) return null;
  let offset = paddingTop + headerHeight;
  for (const entryId of entryIds.slice(0, -1)) {
    const height = entryHeights[entryId];
    if (height === undefined) return null;
    offset += gap + height;
  }
  return offset + gap;
}
