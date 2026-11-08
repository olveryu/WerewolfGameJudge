/**
 * The shared gallery album shell renders the heading, the entries through
 * the caller's renderEntry, the controls dock, and the empty state — for
 * every follow mode.
 */

import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { GalleryAlbumStage } from '../GalleryAlbumStage';

const entries = [
  { id: 'a', label: 'first entry' },
  { id: 'b', label: 'second entry' },
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
