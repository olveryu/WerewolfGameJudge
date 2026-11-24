/**
 * Shared dialog entry contract (docs/step-action-interface.md I7, §9).
 *
 * Game code asks for confirmation only through the shared entries
 * `confirmAction` / `confirmView` in `features/room/confirm.ts`, so every
 * game's dialogs follow the same title, body and button rules. Single-button
 * notices (`showErrorAlert`, `showDismissAlert`, `showPrompt`) stay allowed.
 * The allowlist names each exception with its reason and the exact count.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = join(__dirname, '..');
const GAMES_ROOT = join(SOURCE_ROOT, 'games');
const BANNED_DIALOG_CALL =
  /\b(showAlert|showAlertWithGeneration|showConfirmAlert|showDestructiveAlert)\s*\(/g;

/** Exceptions keyed by path under `src/`, with the number of allowed calls. */
const ALLOWED_DIRECT_CALLS: Readonly<Record<string, number>> = {
  // BQ5: the last-night content dialog has two buttons (查看诅咒 / 知道了),
  // which neither shared entry expresses.
  'games/werewolf/room/hooks/useRoomModals.ts': 1,
};

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return entry === '__tests__' ? [] : listSourceFiles(path);
    }
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

describe('Shared dialog entry', () => {
  it('routes game confirmations through confirmAction / confirmView', () => {
    const directCalls: Record<string, number> = {};
    for (const file of listSourceFiles(GAMES_ROOT)) {
      const count = readFileSync(file, 'utf8').match(BANNED_DIALOG_CALL)?.length ?? 0;
      if (count > 0) directCalls[relative(SOURCE_ROOT, file)] = count;
    }
    expect(directCalls).toEqual(ALLOWED_DIRECT_CALLS);
  });
});
