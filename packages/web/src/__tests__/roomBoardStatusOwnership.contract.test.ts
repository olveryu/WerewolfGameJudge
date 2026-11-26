/**
 * Contract test: the room shell owns the one status bar above the seat board.
 *
 * Games describe their status as `RoomBoardStatusModel` data on the seats content; only
 * `RoomActionStatus` renders it, through `RoomCompactStatus`. A game rendering its own bar (by
 * importing the component or copying its root class) would stack a second bar above the seats.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_DIR = join(import.meta.dirname, '..');
const BAR_RENDERER = 'features/room/components/RoomActionStatus.tsx';
const BAR_COMPONENT = 'features/room/components/RoomCompactStatus.tsx';

const COMPONENT_IMPORT = /from\s+['"][^'"]*\/RoomCompactStatus['"]/;
const BAR_ROOT_CLASS = /(?<![\w-])room-compact-status(?![\w-])/;

function productionSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      return entry === '__tests__' || entry === 'test-utils' ? [] : productionSourceFiles(fullPath);
    }
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [fullPath] : [];
  });
}

const SOURCES = productionSourceFiles(SRC_DIR).map((file) => ({
  path: relative(SRC_DIR, file).split('\\').join('/'),
  text: readFileSync(file, 'utf8'),
}));

describe('room board status ownership', () => {
  it('renders the compact status bar only from the shell status renderer', () => {
    expect(
      SOURCES.filter((source) => COMPONENT_IMPORT.test(source.text)).map((source) => source.path),
    ).toEqual([BAR_RENDERER]);
  });

  it('keeps the bar root class inside the bar component', () => {
    expect(
      SOURCES.filter((source) => BAR_ROOT_CLASS.test(source.text)).map((source) => source.path),
    ).toEqual([BAR_COMPONENT]);
  });
});
