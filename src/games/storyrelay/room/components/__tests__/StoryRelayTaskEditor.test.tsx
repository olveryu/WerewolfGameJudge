/**
 * Bot drafts stay independent per seat through the real room stage: taking
 * over another bot (FAB → takeover sheet) remounts the task editor
 * (StoryRelayStage keys it by authorSeat), and each seat reads/writes only
 * its own entry in the shared inputs map.
 */

import {
  DEFAULT_STORY_RELAY_CONFIG,
  storyRelayEngine,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { fireEvent, render } from '@testing-library/react-native';

import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import type { StoryRelayRoomSession } from '@/games/storyrelay/model/StoryRelayRoomSession';

import { StoryRelayStage } from '../StoryRelayStage';

/** Unseated host + 4 bot seats, round started, answering phase, no deadline. */
function botRoundState(): StoryRelayState {
  let commandNumber = 0;
  let state = storyRelayEngine.createInitialState(
    {
      ...DEFAULT_STORY_RELAY_CONFIG,
      numberOfPlayers: 4,
      writingDurationSeconds: null,
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
  send({ type: 'storyrelay.round.start' });
  if (state.phase !== 'answering') throw new Error('Expected the answering phase');
  return state;
}

describe('StoryRelayStage bot drafts', () => {
  it('keeps each taken-over bot seat on its own draft', () => {
    const state = botRoundState();
    const dispatch = jest.fn(async () => ({
      kind: 'decided',
      decision: { kind: 'committed', outcome: { kind: 'success' } },
    }));
    const session = {
      getSnapshot: () => ({
        phase: 'ready',
        connection: 'live',
        pendingCommandCount: 0,
        snapshot: { state },
      }),
      subscribe: () => () => {},
      dispatch,
    } as unknown as StoryRelayRoomSession;

    const takeover = { effectiveSeat: 0, controlledSeat: null as number | null };
    const seatModel = {
      source: {
        count: 4,
        revision: 0,
        getSeat: (seat: number) => ({
          seat,
          player:
            seat < 2
              ? {
                  kind: 'bot' as const,
                  displayName: `机器人${seat}号`,
                  userId: `bot-${seat}`,
                }
              : null,
          isSelf: false,
          highlight: seat === takeover.controlledSeat ? 'controlled' : 'none',
          secondaryLabel: null,
          showReadyBadge: false,
          statusBadge: null,
          isStatusEmphasized: false,
          showLevel: false,
          decorationsEnabled: false,
        }),
      },
      visuallyDisabled: false,
      onSeatPress: () => {},
      onBotSeatLongPress: (seat: number) => {
        takeover.effectiveSeat = seat;
        takeover.controlledSeat = seat;
        view.rerender(stageElement());
      },
    } as unknown as RoomSeatBoardModel;
    const stageElement = () => (
      <StoryRelayStage
        state={state}
        effectiveSeat={takeover.effectiveSeat}
        controlledSeat={takeover.controlledSeat}
        releaseBot={() => {
          takeover.controlledSeat = null;
          view.rerender(stageElement());
        }}
        userId="host"
        isHost
        canControlBots
        seatModel={seatModel}
        session={session}
      />
    );
    const view = render(stageElement());

    // Opens the shared takeover sheet via the FAB and presses the takeover
    // button in the target seat's row (rows are ordered by seat here: all
    // bots are 'waiting' and there is no active seat).
    const takeOverSeatViaSheet = (seat: number) => {
      fireEvent.press(view.getByLabelText('机器人接管，有 2 个机器人'));
      const buttons = view.getAllByText('接管');
      const button = buttons[seat];
      if (button === undefined) throw new Error(`No takeover button for seat ${seat}`);
      fireEvent.press(button);
    };

    expect(view.getByText('我的稿件')).toBeTruthy();
    fireEvent.changeText(view.getByTestId('storyrelay-editor'), '机器人0的独立稿件');

    // Take over bot seat 1 through the real takeover UI: the stage remounts
    // the editor keyed by the new authorSeat, so seat 0's manuscript must
    // not leak into seat 1's editor.
    takeOverSeatViaSheet(1);
    expect(view.getByText('机器人2号的稿件')).toBeTruthy();
    expect(view.getByTestId('storyrelay-editor').props.value).toBe('');
    fireEvent.changeText(view.getByTestId('storyrelay-editor'), '机器人1的独立稿件');

    // Release (RoomShell banner in the real app), then take over seat 0
    // again: its own draft is restored, not seat 1's.
    takeover.controlledSeat = null;
    view.rerender(stageElement());
    takeOverSeatViaSheet(0);
    expect(view.getByTestId('storyrelay-editor').props.value).toBe('机器人0的独立稿件');
  });
});
