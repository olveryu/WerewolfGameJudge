/**
 * The Secret Hitler first night as every actor sees it, at every player count, written out
 * as a text file a person can read and confirm. A changed sentence is a diff of that file.
 */

import path from 'node:path';

import { describe, expect, it } from 'vitest';

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
import {
  presentSecrethitlerNightStep,
  SECRETHITLER_NIGHT_VIEW_ACTION_KEY,
} from '../domain/nightSteps';
import { getSecrethitlerNightParticipants } from '../domain/rules';
import { secrethitlerEngine } from '../engine';
import { parseSecrethitlerState } from '../state/parseState';
import {
  DEFAULT_SECRETHITLER_CONFIG,
  SECRETHITLER_MAX_PLAYERS,
  SECRETHITLER_MIN_PLAYERS,
  SECRETHITLER_NIGHT_STEP_IDS,
} from '../state/types';

const NIGHT_COPY_SOURCE = path.resolve(__dirname, '../domain/nightSteps.ts');

function userOf(seat: number): string {
  return seat === 0 ? 'host' : `u${seat}`;
}

/** Seat everyone, deal, and play the night; record what each actor is shown before viewing. */
function playNight(numberOfPlayers: number): PlayedNight {
  const session = createEngineSession(secrethitlerEngine, {
    config: { ...DEFAULT_SECRETHITLER_CONFIG, numberOfPlayers },
    parse: parseSecrethitlerState,
    randomSeed: 'secrethitler-night-list',
  });
  for (let seat = 0; seat < numberOfPlayers; seat += 1) {
    session.send(
      { type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } },
      userOf(seat),
    );
  }
  session.send({ type: 'secrethitler.roles.assign' });
  for (let seat = 0; seat < numberOfPlayers; seat += 1) {
    session.send({ type: 'secrethitler.role.viewed' }, userOf(seat));
  }
  session.send({ type: 'secrethitler.game.begin' });

  const sightings: PlayedStepSighting[] = [];
  for (const seat of getSecrethitlerNightParticipants(session.state)) {
    const { phase } = session.state;
    if (phase.kind !== 'night' || phase.steps.current === null) {
      throw new Error(`[TEST] The night ended before ${formatSeat(seat)} viewed`);
    }
    const view = presentSecrethitlerNightStep(session.state, seat);
    if (view === null) throw new Error(`[TEST] ${formatSeat(seat)} has no night step to view`);
    const identity = session.state.identities[seat];
    sightings.push({ stepId: view.stepId, who: `${formatSeat(seat)}（${identity}）`, view });
    session.send(
      {
        type: 'secrethitler.step.submit',
        gameSequence: session.state.gameSequence,
        submission: {
          stepId: phase.steps.current.stepId,
          serial: phase.steps.current.serial,
          actionKey: SECRETHITLER_NIGHT_VIEW_ACTION_KEY,
        },
      },
      userOf(seat),
    );
  }
  return { name: `${numberOfPlayers} 人局`, sightings };
}

/**
 * Seat numbers and player names do not make a new situation, and neither does the order or
 * the number of teammates listed; which identities are listed does.
 */
function normalize(text: string): string {
  const lines = text.replace(/\d+/g, 'N').split('\n');
  const isTeammate = (line: string): boolean => line.trimStart().startsWith('N号 · PN · ');
  const teammates = [...new Set(lines.filter(isTeammate))].sort();
  return [...lines.filter((line) => !isTeammate(line)), ...teammates].join('\n');
}

const NIGHTS = Array.from(
  { length: SECRETHITLER_MAX_PLAYERS - SECRETHITLER_MIN_PLAYERS + 1 },
  (_, index) => playNight(SECRETHITLER_MIN_PLAYERS + index),
);

describe('Secret Hitler night step-by-step list', () => {
  it('matches the generated list of what the night shows at every player count', async () => {
    await expect(
      renderViewNightCatalogue({
        heading: '秘密希特勒首夜逐步骤清单',
        generatedBy: 'secrethitler/__tests__/nightCatalogue.integration.test.ts',
        unit: '个人数',
        stepOrder: SECRETHITLER_NIGHT_STEP_IDS,
        nights: NIGHTS,
        normalize,
      }),
    ).toMatchFileSnapshot('./__snapshots__/night-steps.catalogue.txt');
  });

  it('shows every sentence written for the night at some player count', () => {
    expect(findUnshownCopy(collectCopy(NIGHT_COPY_SOURCE), collectPlayedText(NIGHTS))).toEqual([]);
  });
});
