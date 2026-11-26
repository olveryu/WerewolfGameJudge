/**
 * Contract test: the room shell owns the one status bar above the seat board.
 *
 * Games describe their status as `RoomBoardStatusModel` data on the seats content; only
 * `RoomActionStatus` renders it, through `RoomCompactStatus`. A game rendering its own bar (by
 * importing the component or copying its classes) would stack a second bar, or bar-styled lines
 * of its own, above the seats. Public text lines go through the shell's `statusNotices`, and the
 * model itself holds no React content, so a game cannot smuggle markup into the bar.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_DIR = join(import.meta.dirname, '..');
const BAR_RENDERER = 'features/room/components/RoomActionStatus.tsx';
const BAR_COMPONENT = 'features/room/components/RoomCompactStatus.tsx';
const STATUS_MODEL = 'features/room/model/RoomBoardStatus.ts';
const TEST_ONLY_DIRECTORIES = new Set(['__tests__', 'test-utils', 'test']);

const COMPONENT_IMPORT = /from\s+['"][^'"]*\/RoomCompactStatus['"]/;
const BAR_CLASS = /(?<![\w-])room-compact-status(?:-[\w-]+)?(?![\w-])/;

function productionSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      return TEST_ONLY_DIRECTORIES.has(entry) ? [] : productionSourceFiles(fullPath);
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

  it('keeps every bar class inside the bar component', () => {
    expect(
      SOURCES.filter((source) => BAR_CLASS.test(source.text)).map((source) => source.path),
    ).toEqual([BAR_COMPONENT]);
  });

  it('keeps the status model free of React content', () => {
    const model = SOURCES.find((source) => source.path === STATUS_MODEL);
    if (model === undefined) throw new Error(`Missing ${STATUS_MODEL}`);
    expect(model.text).not.toMatch(/from\s+['"]react['"]|\bReact(?:Element|Node)\b|\bJSX\b/);
  });
});
