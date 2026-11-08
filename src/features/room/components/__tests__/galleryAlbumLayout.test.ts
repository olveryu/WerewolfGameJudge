import { getLatestEntryOffset } from '../galleryAlbumLayout';

const GAP = 24;
const PADDING_TOP = 16;

describe('getLatestEntryOffset', () => {
  it('returns null for an empty album', () => {
    expect(
      getLatestEntryOffset({
        entryIds: [],
        entryHeights: {},
        headerHeight: 80,
        gap: GAP,
        paddingTop: PADDING_TOP,
      }),
    ).toBeNull();
  });

  it('keeps the heading visible while only the first entry is revealed', () => {
    expect(
      getLatestEntryOffset({
        entryIds: ['a'],
        entryHeights: {},
        headerHeight: null,
        gap: GAP,
        paddingTop: PADDING_TOP,
      }),
    ).toBe(0);
  });

  it('waits for the heading and every earlier entry to be measured', () => {
    expect(
      getLatestEntryOffset({
        entryIds: ['a', 'b'],
        entryHeights: { a: 300 },
        headerHeight: null,
        gap: GAP,
        paddingTop: PADDING_TOP,
      }),
    ).toBeNull();
    expect(
      getLatestEntryOffset({
        entryIds: ['a', 'b', 'c'],
        entryHeights: { a: 300, c: 120 },
        headerHeight: 80,
        gap: GAP,
        paddingTop: PADDING_TOP,
      }),
    ).toBeNull();
  });

  it('sums padding, heading, earlier entries and one gap per child above the latest entry', () => {
    // paddingTop + heading + (gap + a) + (gap + b) + gap
    expect(
      getLatestEntryOffset({
        entryIds: ['a', 'b', 'c'],
        entryHeights: { a: 300, b: 140 },
        headerHeight: 80,
        gap: GAP,
        paddingTop: PADDING_TOP,
      }),
    ).toBe(PADDING_TOP + 80 + (GAP + 300) + (GAP + 140) + GAP);
  });

  it('ignores the latest entry height, the footer and the viewport', () => {
    const base = {
      entryIds: ['a', 'b'],
      entryHeights: { a: 300, b: 140 },
      headerHeight: 80,
      gap: GAP,
      paddingTop: PADDING_TOP,
    };
    expect(getLatestEntryOffset(base)).toBe(
      getLatestEntryOffset({ ...base, entryHeights: { a: 300, b: 999 } }),
    );
  });
});
