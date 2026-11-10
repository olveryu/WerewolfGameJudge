/**
 * The shared gallery album shell renders the heading, the entries through the caller's
 * renderEntry, the controls dock, and the empty state, and tail-follows in bottom mode.
 */

import { fireEvent, render, screen } from '@testing-library/react';

import { GalleryAlbumStage } from '../GalleryAlbumStage';

const entries = [
  { id: 'a', label: 'first entry' },
  { id: 'b', label: 'second entry' },
  { id: 'c', label: 'third entry' },
  { id: 'd', label: 'fourth entry' },
];

const shell = (follow: 'bottom' | 'none', list = entries) => (
  <GalleryAlbumStage
    entries={list}
    renderEntry={(entry) => <p>{entry.label}</p>}
    heading={<p>album heading</p>}
    follow={follow}
    controls={<p>album controls</p>}
    testId="gallery-shell"
    listTestId="gallery-shell-list"
    emptyContent={<p>empty album</p>}
  />
);

describe('GalleryAlbumStage', () => {
  it.each(['bottom', 'none'] as const)(
    'renders the heading, entries and controls in %s mode',
    (follow) => {
      render(shell(follow));
      expect(screen.getByTestId('gallery-shell')).toBeInTheDocument();
      expect(screen.getByTestId('gallery-shell-list')).toBeInTheDocument();
      expect(screen.getByText('album heading')).toBeInTheDocument();
      expect(screen.getByText('first entry')).toBeInTheDocument();
      expect(screen.getByText('second entry')).toBeInTheDocument();
      expect(screen.getByText('album controls')).toBeInTheDocument();
    },
  );

  it('shows the empty content when there are no entries', () => {
    render(shell('bottom', []));
    expect(screen.getByText('empty album')).toBeInTheDocument();
    expect(screen.queryByText('first entry')).toBeNull();
  });
});

describe('GalleryAlbumStage follow behaviour', () => {
  const setGeometry = (list: HTMLElement, scrollHeight: number, clientHeight: number) => {
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: scrollHeight });
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: clientHeight });
  };

  it('bottom: scrolls to the end for new entries, stops when the player scrolls up', () => {
    const view = render(shell('bottom', [entries[0]!]));
    const list = screen.getByTestId('gallery-shell-list');
    setGeometry(list, 1000, 600);
    view.rerender(shell('bottom', [entries[0]!, entries[1]!]));
    expect(list.scrollTop).toBe(1000);

    // Scroll up: 1000 - (0 + 600) = 400 from the bottom, follow stops.
    list.scrollTop = 0;
    fireEvent.scroll(list);
    view.rerender(shell('bottom', [entries[0]!, entries[1]!, entries[2]!]));
    expect(list.scrollTop).toBe(0);

    // Back at the bottom: 1000 - (400 + 600) = 0, follow resumes.
    list.scrollTop = 400;
    fireEvent.scroll(list);
    setGeometry(list, 1200, 600);
    view.rerender(shell('bottom', entries));
    expect(list.scrollTop).toBe(1200);
  });

  it('none: never auto-scrolls', () => {
    const view = render(shell('none', [entries[0]!]));
    const list = screen.getByTestId('gallery-shell-list');
    setGeometry(list, 1000, 600);
    view.rerender(shell('none', entries));
    expect(list.scrollTop).toBe(0);
  });
});
