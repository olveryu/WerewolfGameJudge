/**
 * Takeover hint banner gate wiring: the gate itself lives in the shared
 * factory (createControlledSeatModel); this test pins that the Avalon hook
 * passes the two gate inputs — its own canControlBots and a roster-derived
 * hasBots — and runs the outcomes through the factory on real engine
 * states. Before the gate existed, an Avalon host in an all-human room
 * saw the long-press hint permanently.
 */
import {
  type AvalonCommand,
  avalonEngine,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
  getAvalonBotSeats,
} from '@game-judge/game-engine/games/avalon/public';
import { readFileSync } from 'fs';
import { join } from 'path';

import { createControlledSeatModel } from '@/features/room/model/createControlledSeatModel';

type CommandContext = Parameters<typeof avalonEngine.decide>[2];

function roomState(humanCount: number): AvalonState {
  let commandNumber = 0;
  let state: AvalonState = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: 5 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const send = (command: AvalonCommand, userId = 'host') => {
    const context: CommandContext = {
      actor: { kind: 'user', userId },
      controlledSeat: null,
      nowMs: 1000,
      commandId: `command:${commandNumber++}`,
      randomSeed: `seed:${commandNumber}`,
    };
    const decision = avalonEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = decision.events.reduce(avalonEngine.evolve, state);
  };
  for (let seat = 0; seat < humanCount; seat += 1) {
    send(
      { type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } },
      seat === 0 ? 'host' : `u${seat}`,
    );
  }
  if (humanCount < 5) send({ type: 'room.seat.fillBots' });
  return state;
}

/** The inputs the hook passes: on main, canControlBots is exactly isHost. */
function bannerModel(
  state: AvalonState,
  input: { isHost: boolean; controlledSeat: number | null },
) {
  return createControlledSeatModel({
    canControlBots: input.isHost,
    hasBots: getAvalonBotSeats(state).length > 0,
    controlledSeat: input.controlledSeat,
    controlledBotName: input.controlledSeat !== null ? `座位 ${input.controlledSeat + 1}` : null,
    release: () => undefined,
    gameName: 'Avalon',
  });
}

describe('avalon takeover banner gate', () => {
  it('pins the gate-input wiring in the room hook', () => {
    const hook = readFileSync(join(__dirname, '../hooks/useAvalonRoomState.ts'), 'utf8');
    expect(hook).toContain('getAvalonBotSeats,');
    expect(hook).toMatch(
      /createControlledSeatModel\(\{\s*canControlBots,\s*hasBots: getAvalonBotSeats\(state\)\.length > 0,/,
    );
  });

  it('hides the hint from the host in an all-human room', () => {
    expect(bannerModel(roomState(5), { isHost: true, controlledSeat: null })).toBeNull();
  });

  it('shows the hint to the host when bot seats exist', () => {
    expect(bannerModel(roomState(3), { isHost: true, controlledSeat: null })).toEqual({
      kind: 'hint',
    });
  });

  it('keeps the controlled banner while a takeover is active', () => {
    const model = bannerModel(roomState(3), { isHost: true, controlledSeat: 3 });
    expect(model?.kind).toBe('controlled');
    // The release entry survives even on a state whose bot set changed.
    expect(bannerModel(roomState(5), { isHost: true, controlledSeat: 3 })?.kind).toBe('controlled');
  });

  it('hides the banner from non-hosts even when bots exist', () => {
    expect(bannerModel(roomState(3), { isHost: false, controlledSeat: null })).toBeNull();
  });
});
