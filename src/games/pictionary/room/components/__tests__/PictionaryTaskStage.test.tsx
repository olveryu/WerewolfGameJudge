/**
 * Pictionary text task: the composer lives in the pinned task-frame
 * footer (next to its submit action), never inside a scrolling
 * container, with the previous drawing alone in the body.
 */

import {
  createPictionaryCommand,
  decidePictionaryCommand,
  DEFAULT_PICTIONARY_CONFIG,
  getPictionaryUserSeat,
  type PictionaryCommandInput,
  pictionaryEngine,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { render } from '@testing-library/react-native';

import {
  assertNoScrollingAncestor,
  assertSharesPinnedFooter,
} from '@/test-utils/noScrollingAncestor';
import { TESTIDS } from '@/testids';

import { PictionaryTaskStage } from '../PictionaryTaskStage';

/** Four seated players, game begun: seat 0 holds the opening prompt (text task). */
function answeringState(): PictionaryState {
  let sequence = 0;
  let state = pictionaryEngine.createInitialState(
    { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers: 4, guessDurationSeconds: null },
    { roomCode: '2468', hostUserId: 'user-0', nowMs: 1_000, commandId: 'create' },
  );
  const dispatchEngine = (command: PictionaryCommandInput, userId = 'user-0') => {
    sequence += 1;
    const seat = getPictionaryUserSeat(state, userId) ?? 0;
    const decision = decidePictionaryCommand(state, createPictionaryCommand(state, command, seat), {
      actor: { kind: 'user', userId },
      controlledSeat: null,
      nowMs: 2_000 + sequence,
      commandId: `command-${sequence}`,
      randomSeed: 'recovery',
    });
    if (decision.kind !== 'commit') throw new Error(decision.reason);
    for (const event of decision.events) state = pictionaryEngine.evolve(state, event);
    state = pictionaryEngine.normalize(state);
  };
  for (let seat = 0; seat < 4; seat += 1) {
    dispatchEngine(
      { type: 'room.seat.take', seat, profile: { displayName: `玩家${seat}` } },
      `user-${seat}`,
    );
  }
  dispatchEngine({ type: 'pictionary.game.begin' });
  if (state.phase !== 'answering') throw new Error('Expected the answering phase');
  return state;
}

describe('PictionaryTaskStage text task', () => {
  it('pins the composer in the footer with no scrolling ancestor', () => {
    const view = render(
      <PictionaryTaskStage
        inputs={new Map()}
        state={answeringState()}
        effectiveSeat={0}
        controlledSeat={null}
        userId="user-0"
        submit={async () => true}
        isSubmitting={false}
        remainingSeconds={60}
        isExpired={false}
        autoSubmission={{ status: 'waiting', retry: () => undefined }}
      />,
    );

    const input = view.getByTestId(TESTIDS.pictionaryTextInput);
    expect(input).toBeTruthy();
    assertNoScrollingAncestor(input);
    assertSharesPinnedFooter(input, view.getByTestId(TESTIDS.pictionaryTextSubmitButton));
  });
});
