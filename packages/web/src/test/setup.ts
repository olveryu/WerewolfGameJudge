import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom does not fetch or decode images.
HTMLImageElement.prototype.decode = async () => {};

// jsdom has no media queries; tests run as a device with no motion preference.
window.matchMedia = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
});

// The room shell owns the one status bar above the seat board; any render that stacks a second one
// fails the test that produced it.
function findRoomWithStackedStatusBars(): Element | undefined {
  return Array.from(document.querySelectorAll('.room-board-column')).find(
    (room) => room.querySelectorAll('.room-compact-status').length > 1,
  );
}

afterEach(() => {
  const stackedRoom = findRoomWithStackedStatusBars();
  cleanup();
  if (stackedRoom !== undefined) {
    throw new Error('A room rendered more than one status bar above the seat board');
  }
});
