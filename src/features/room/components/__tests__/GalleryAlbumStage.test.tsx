/**
 * The shared gallery album shell renders the heading, the entries through
 * the caller's renderEntry, the controls dock, and the empty state — for
 * every follow mode.
 */

import { fireEvent, render } from '@testing-library/react-native';
import { ScrollView, Text } from 'react-native';

import { GalleryAlbumStage } from '../GalleryAlbumStage';

const entries = [
  { id: 'a', label: 'first entry' },
  { id: 'b', label: 'second entry' },
  { id: 'c', label: 'third entry' },
  { id: 'd', label: 'fourth entry' },
];

const shell = (follow: 'top' | 'bottom' | 'none', list = entries) => (
  <GalleryAlbumStage
    entries={list}
    renderEntry={(entry) => <Text>{entry.label}</Text>}
    heading={<Text>album heading</Text>}
    follow={follow}
    controls={<Text>album controls</Text>}
    testID="gallery-shell"
    listTestID="gallery-shell-list"
    listEmptyComponent={<Text>empty album</Text>}
  />
);

describe('GalleryAlbumStage', () => {
  it.each(['top', 'bottom', 'none'] as const)(
    'renders the heading, entries and controls in %s mode',
    (follow) => {
      const view = render(shell(follow));
      expect(view.getByTestId('gallery-shell')).toBeTruthy();
      expect(view.getByTestId('gallery-shell-list')).toBeTruthy();
      expect(view.getByText('album heading')).toBeTruthy();
      expect(view.getByText('first entry')).toBeTruthy();
      expect(view.getByText('second entry')).toBeTruthy();
      expect(view.getByText('album controls')).toBeTruthy();
    },
  );

  it('shows the empty component when there are no entries', () => {
    const view = render(shell('bottom', []));
    expect(view.getByText('empty album')).toBeTruthy();
    expect(view.queryByText('first entry')).toBeNull();
  });

  it('keeps rendering as entries arrive in bottom mode', () => {
    const view = render(shell('bottom', [entries[0]!]));
    expect(view.getByText('first entry')).toBeTruthy();
    view.rerender(shell('bottom', entries));
    expect(view.getByText('second entry')).toBeTruthy();
  });
});

describe('GalleryAlbumStage follow behaviour', () => {
  const layout = (height: number) => ({ nativeEvent: { layout: { height } } });
  const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});

  beforeEach(() => {
    scrollTo.mockClear();
  });

  it('top: leaves footer room for the latest entry and scrolls it to the top', () => {
    const view = render(shell('top', [entries[0]!, entries[1]!]));
    // Viewport 600, heading 80, first entry 200, latest entry 260.
    fireEvent(view.getByTestId('gallery-shell-list'), 'layout', layout(600));
    fireEvent(view.getByText('album heading').parent!, 'layout', layout(80));
    fireEvent(view.getByText('first entry').parent!, 'layout', layout(200));
    fireEvent(view.getByText('second entry').parent!, 'layout', layout(260));
    // Footer leaves room below the latest entry: 600 - 260 = 340.
    expect(view.getByTestId('gallery-album-footer').props.style).toEqual({ height: 340 });
    // Latest entry offset: padding 16 + heading 80 + gap 24 + first entry 200 + gap 24 = 344.
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ y: 344, animated: true }));
  });

  it('top: has no footer spacer in bottom or none mode', () => {
    expect(render(shell('bottom')).queryByTestId('gallery-album-footer')).toBeNull();
    expect(render(shell('none')).queryByTestId('gallery-album-footer')).toBeNull();
  });

  it('bottom: scrolls to the end for new entries, stops when the player scrolls up', () => {
    const view = render(shell('bottom', [entries[0]!]));
    const callsAfterMount = scrollTo.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0);
    view.rerender(shell('bottom', [entries[0]!, entries[1]!]));
    expect(scrollTo.mock.calls.length).toBeGreaterThan(callsAfterMount);
    // Scroll up: 1000 - (0 + 600) = 400 from the bottom, follow stops.
    fireEvent(view.getByTestId('gallery-shell-list'), 'scroll', {
      nativeEvent: {
        contentOffset: { y: 0 },
        contentSize: { height: 1000 },
        layoutMeasurement: { height: 600 },
      },
    });
    const callsAfterScrollUp = scrollTo.mock.calls.length;
    view.rerender(shell('bottom', [entries[0]!, entries[1]!, entries[2]!]));
    expect(scrollTo.mock.calls.length).toBe(callsAfterScrollUp);
    // Back at the bottom: 1000 - (400 + 600) = 0, follow resumes.
    fireEvent(view.getByTestId('gallery-shell-list'), 'scroll', {
      nativeEvent: {
        contentOffset: { y: 400 },
        contentSize: { height: 1000 },
        layoutMeasurement: { height: 600 },
      },
    });
    view.rerender(shell('bottom', entries));
    expect(scrollTo.mock.calls.length).toBeGreaterThan(callsAfterScrollUp);
  });
});
