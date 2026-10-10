/**
 * Roster unification — engine contract.
 *
 * All seven games keep seat occupancy in exactly one shape: a platform
 * `RosterMap` field named `roster` on the persisted game state (human
 * occupant {seat, userId} or bot occupant {seat, kind: 'bot'}). The legacy
 * per-game shapes (realSeats + botSeats / excludedBotSeats side tables and
 * implicit bot derivation) must not come back: seat decisions go through
 * the platform roster module, and "who is a bot" is the platform selector.
 *
 * Participant projections ({userId, seat, isBot} built for settlement and
 * identity viewing) are outputs, not state, and are out of scope here.
 * Legacy field names may still appear inside migration parsers, which by
 * definition read the old document shapes; the lock targets the current
 * state type definitions.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const ENGINE_SRC = join(__dirname, '..', '..');

const GAME_STATE_TYPES = [
  'games/werewolf/domain/protocol/types.ts',
  'games/undercover/state/types.ts',
  'games/avalon/state/types.ts',
  'games/fibking/state/types.ts',
  'games/pictionary/state/types.ts',
  'games/storyrelay/state/types.ts',
  'games/drawguess/state/types.ts',
] as const;

function readSource(relativePath: string): string {
  const fullPath = join(ENGINE_SRC, relativePath);
  if (!existsSync(fullPath)) throw new Error(`Expected source file to exist: ${relativePath}`);
  return readFileSync(fullPath, 'utf8');
}

function productionSources(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      files.push(...productionSources(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(full);
    }
  }
  return files;
}

describe('roster unification contract', () => {
  it('every game state keeps occupancy in a single platform RosterMap field', () => {
    for (const typesFile of GAME_STATE_TYPES) {
      expect(readSource(typesFile)).toMatch(/roster:\s*RosterMap</);
    }
  });

  it('no game state type revives the legacy seat side tables', () => {
    for (const typesFile of GAME_STATE_TYPES) {
      const source = readSource(typesFile);
      expect(source).not.toMatch(/\bbotSeats\s*[?:]/);
      expect(source).not.toMatch(/\bexcludedBotSeats\s*[?:]/);
      expect(source).not.toMatch(/\brealSeats\s*[?:]/);
    }
  });

  it('no production source references the retired implicit-bot derivation', () => {
    for (const file of productionSources(ENGINE_SRC)) {
      expect(readFileSync(file, 'utf8')).not.toContain('ImplicitBotSeat');
    }
  });

  it('the werewolf player record carries no identity fields', () => {
    const source = readSource('games/werewolf/domain/protocol/types.ts');
    const playerBlock = /export interface Player \{([\s\S]*?)\}/.exec(source);
    if (playerBlock === null) throw new Error('Player interface not found');
    expect(playerBlock[1]).not.toContain('userId');
    expect(playerBlock[1]).not.toContain('isBot');
    // Identity lives on the roster occupant instead.
    expect(source).toMatch(/interface WerewolfHumanSeat[\s\S]*?userId: string;/);
  });
});
