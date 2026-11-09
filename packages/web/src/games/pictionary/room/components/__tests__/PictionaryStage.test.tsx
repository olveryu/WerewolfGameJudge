/**
 * The Pictionary stage shows the shared answering top bar in the
 * answering phase — and the task heading no longer carries a countdown
 * pill.
 */

import {
  DEFAULT_PICTIONARY_CONFIG,
  pictionaryEngine,
  type PictionaryPublicCommand,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { render, screen } from '@testing-library/react';

import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import { createFakeRoomLink, readyLinkSnapshot, testIdentity } from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';

import { createPictionarySeatDataSource } from '../../pictionaryRoomAdapter';
import { PictionaryStage } from '../PictionaryStage';

/**
 * 4 seats, answering phase at step 0 (a text step: 45-second guess
 * duration), deadline armed at nowMs 1000.
 */
function answeringState(): PictionaryState {
  let commandNumber = 0;
  let state = pictionaryEngine.createInitialState(
    {
      ...DEFAULT_PICTIONARY_CONFIG,
      numberOfPlayers: 4,
      guessDurationSeconds: 45,
      drawingDurationSeconds: 120,
    },
    { roomCode: 'ABCD', hostUserId: 'host-1', nowMs: 1000, commandId: 'create' },
  );
  const send = (command: Parameters<typeof pictionaryEngine.decide>[1]) => {
    const decision = pictionaryEngine.decide(state, command, {
      actor: { kind: 'user', userId: 'host-1' },
      controlledSeat: null,
      nowMs: 1000,
      commandId: `command:${commandNumber++}`,
      randomSeed: 'round',
    });
    if (decision.kind === 'reject') throw new Error(decision.reason);
    state = decision.events.reduce(pictionaryEngine.evolve, state);
  };
  send({ type: 'room.seat.fillBots' });
  send({ type: 'pictionary.game.begin' });
  if (state.phase !== 'answering') throw new Error('Expected the answering phase');
  return state;
}

describe('PictionaryStage answering top bar', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows the top bar with the 42/45 countdown and no heading countdown pill', () => {
    const state = answeringState();
    // Step 0 is a text step: deadlineAt = 1000 + 45_000; at nowMs 4000 the remaining time is 42 seconds.
    expect(state.deadlineAt).toBe(46_000);
    vi.spyOn(Date, 'now').mockReturnValue(4_000);
    const session = createFakeRoomLink<PictionaryState, PictionaryPublicCommand>(
      readyLinkSnapshot(testIdentity('pictionary'), createRoomSnapshot(state, 1)),
      async () => successfulRoomCommand(state),
    );
    const seatModel: RoomSeatBoardModel = {
      source: createPictionarySeatDataSource({
        state,
        revision: 1,
        myUserId: 'host-1',
        controlledSeat: null,
      }),
      visuallyDisabled: false,
      onSeatPress: () => {},
      onBotSeatLongPress: null,
    };
    render(
      <PictionaryStage
        state={state}
        effectiveSeat={0}
        controlledSeat={null}
        userId="host-1"
        isHost
        canControlBots
        seatModel={seatModel}
        session={session}
        submit={(label, command, options) =>
          session
            .dispatch(command, {
              controlledSeat: options?.controlledSeat ?? null,
              label,
              durable: false,
            })
            .then((outcome) => outcome.kind === 'committed')
        }
        isSubmitting={false}
        openReview={vi.fn()}
      />,
    );
    expect(screen.getByTestId('answering-top-bar')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('4人作答中')).toBeInTheDocument();
    expect(screen.getByText(/0已提交/)).toBeInTheDocument();
    expect(screen.getByText('写下一个题目')).toBeInTheDocument();
    // The old heading pill would have shown the formatted countdown "0:42".
    expect(screen.queryByText('0:42')).not.toBeInTheDocument();
  });
});
