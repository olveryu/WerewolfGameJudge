/**
 * The Avalon night as every actor sees it, on every board, written out as a text file a
 * person can read and confirm. A changed sentence is a diff of that file.
 */

import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { verifyCatalogue } from '../../../../../../scripts/lib/catalogues/verify.mjs';
import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import { formatSeat } from '../../../platform/room/formatSeat';
import {
  collectCopy,
  collectPlayedText,
  findUnshownCopy,
  type PlayedNight,
  type PlayedStepSighting,
  renderViewNightCatalogue,
} from '../../../platform/steps/__tests__/catalogueKit';
import { getAvalonViewModel } from '../domain/visibility';
import { avalonEngine } from '../engine';
import { parseAvalonState } from '../state/parseState';
import {
  AVALON_BOARDS,
  AVALON_NIGHT_STEPS,
  type AvalonPlayerCount,
  DEFAULT_AVALON_CONFIG,
  isAvalonPlayerCount,
} from '../state/types';
import { currentNightActors, viewNight } from './avalonNightDriver';

const NIGHT_COPY_SOURCE = path.resolve(__dirname, '../domain/nightSteps.ts');

function userOf(seat: number): string {
  return seat === 0 ? 'host' : `u${seat}`;
}

/** Seat everyone, deal, and play the night; record what each actor is shown before viewing. */
function playNight(numberOfPlayers: AvalonPlayerCount): PlayedNight {
  const session = createEngineSession(avalonEngine, {
    config: { ...DEFAULT_AVALON_CONFIG, numberOfPlayers },
    parse: parseAvalonState,
  });
  const acknowledgeAudio = (): void => {
    if (!session.state.isAudioPlaying) return;
    session.send({ type: 'avalon.audio.ack', audioBatchId: session.state.audioBatchId });
  };
  for (let seat = 0; seat < numberOfPlayers; seat += 1) {
    session.send(
      { type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } },
      userOf(seat),
    );
  }
  session.send({ type: 'avalon.roles.assign' });
  for (let seat = 0; seat < numberOfPlayers; seat += 1) {
    session.send({ type: 'avalon.role.viewed' }, userOf(seat));
  }
  session.send({ type: 'avalon.game.begin' });
  acknowledgeAudio();

  const sightings: PlayedStepSighting[] = [];
  while (session.state.phase.kind === 'night') {
    for (const seat of currentNightActors(session.state)) {
      const view = getAvalonViewModel(session.state, seat).step;
      if (view === null) throw new Error(`[TEST] ${formatSeat(seat)} has no night step to view`);
      const role = session.state.roles[seat];
      sightings.push({ stepId: view.stepId, who: `${formatSeat(seat)}（${role}）`, view });
      session.send(viewNight(session.state), userOf(seat));
    }
    acknowledgeAudio();
  }
  return { name: `${numberOfPlayers} 人局`, sightings };
}

/** Seat numbers, player names, and how many seats a list names do not make a new situation. */
function normalize(text: string): string {
  return text.replace(/\d+/g, 'N').replace(/N号·PN(?:、N号·PN)*/g, '〔座位〕');
}

/**
 * Avalon deals from crypto randomness, which no command seed fixes. Pin it while the nights
 * are played, so the seats the list names as examples are the same on every run.
 */
function withFixedDeal<T>(play: () => T): T {
  let state = 0x9e3779b9;
  const spy = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
    if (array === null) return array;
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    for (let index = 0; index < bytes.length; index += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      bytes[index] = state >>> 24;
    }
    return array;
  });
  try {
    return play();
  } finally {
    spy.mockRestore();
  }
}

const NIGHTS = withFixedDeal(() =>
  Object.keys(AVALON_BOARDS)
    .map(Number)
    .filter(isAvalonPlayerCount)
    .sort((first, second) => first - second)
    .map(playNight),
);

describe('Avalon night step-by-step list', () => {
  it('matches the generated list of what every step shows on every board', () => {
    verifyCatalogue(
      'avalon-night',
      renderViewNightCatalogue({
        heading: '阿瓦隆夜晚逐步骤清单',
        generatedBy: 'avalon/__tests__/nightCatalogue.integration.test.ts',
        unit: '个板子',
        stepOrder: AVALON_NIGHT_STEPS,
        nights: NIGHTS,
        normalize,
      }),
    );
  });

  it('reaches every night step on some board', () => {
    const reached = new Set(NIGHTS.flatMap((night) => night.sightings.map((s) => s.stepId)));
    expect([...reached].sort()).toEqual([...AVALON_NIGHT_STEPS].sort());
  });

  it('shows every sentence written for the night on some board', () => {
    expect(findUnshownCopy(collectCopy(NIGHT_COPY_SOURCE), collectPlayedText(NIGHTS))).toEqual([]);
  });
});
