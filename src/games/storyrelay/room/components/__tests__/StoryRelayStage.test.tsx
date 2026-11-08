/**
 * The Story Relay stage shows the shared answering top bar in the
 * answering phase — and no longer shows the old "剩余 X 秒" line or the
 * per-seat progress name list.
 */

import {
  DEFAULT_STORY_RELAY_CONFIG,
  type StoryRelayCommand,
  storyRelayEngine,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { render } from '@testing-library/react-native';

import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import { createFakeRoomLink, readyLinkSnapshot, testIdentity } from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';

import { StoryRelayStage } from '../StoryRelayStage';

/** 4 seats, answering phase, 90-second writing duration, deadline armed at nowMs 1000. */
function answeringState(): StoryRelayState {
  let commandNumber = 0;
  let state = storyRelayEngine.createInitialState(
    {
      ...DEFAULT_STORY_RELAY_CONFIG,
      numberOfPlayers: 4,
      writingDurationSeconds: 90,
      transitionDurationSeconds: 0,
    },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const send = (command: Parameters<typeof storyRelayEngine.decide>[1]) => {
    const decision = storyRelayEngine.decide(state, command, {
      actor: { kind: 'user', userId: 'host' },
      controlledSeat: null,
      nowMs: 1000,
      commandId: `command:${commandNumber++}`,
      randomSeed: 'round',
    });
    if (decision.kind === 'reject') throw new Error(decision.reason);
    state = decision.events.reduce(storyRelayEngine.evolve, state);
  };
  send({ type: 'room.seat.fillBots' });
  send({ type: 'storyrelay.game.begin' });
  if (state.phase !== 'answering') throw new Error('Expected the answering phase');
  return state;
}

describe('StoryRelayStage answering top bar', () => {
  const nowSpy = jest.spyOn(Date, 'now');

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('shows the top bar with the 82/90 countdown and no old remaining-seconds line', () => {
    const state = answeringState();
    // deadlineAt = 1000 + 90_000; at nowMs 9000 the remaining time is 82 seconds.
    expect(state.deadlineAt).toBe(91_000);
    nowSpy.mockReturnValue(9_000);
    const session = createFakeRoomLink<StoryRelayState, StoryRelayCommand>(
      readyLinkSnapshot(testIdentity('storyrelay'), createRoomSnapshot(state, 1)),
      async () => successfulRoomCommand(state),
    );
    const seatModel = {
      source: {
        count: 4,
        revision: 0,
        getSeat: (seat: number) => ({
          seat,
          player: {
            occupant: { kind: 'bot' as const, seat },
            displayName: `机器人${seat}号`,
          },
          isSelf: false,
          highlight: 'none',
          secondaryLabel: null,
          showReadyBadge: false,
          statusBadge:
            seat === 0
              ? { label: '已准备', tone: 'success' as const }
              : { label: '写作中', tone: 'warning' as const },
          isStatusEmphasized: false,
          showLevel: false,
          decorationsEnabled: false,
        }),
      },
      visuallyDisabled: false,
      onSeatPress: () => {},
      onBotSeatLongPress: null,
    } as unknown as RoomSeatBoardModel;
    const view = render(
      <StoryRelayStage
        state={state}
        effectiveSeat={null}
        controlledSeat={null}
        releaseBot={() => {}}
        userId="host"
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
        openReview={jest.fn()}
      />,
    );
    expect(view.getByTestId('answering-top-bar')).toBeTruthy();
    expect(view.getByText('82')).toBeTruthy();
    expect(view.getByText('3人作答中')).toBeTruthy();
    expect(view.getByText(/1已提交/)).toBeTruthy();
    expect(view.queryByText(/剩余/)).toBeNull();
  });
});
