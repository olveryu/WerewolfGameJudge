/** Screen-level coverage for the adaptive first-day sheriff-election composition. */

import type { SheriffElectionState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { act, waitFor, within } from '@testing-library/react';

import {
  click,
  createReactiveWerewolfRoomMock,
  createWerewolfRoomMock,
  mountWerewolfRoom,
  recordAlerts,
  RoomScreenTestHarness,
} from '@/games/werewolf/room/__tests__/harness';
import { TESTIDS } from '@/testids';

vi.mock('@/contexts/AuthContext', () => import('./harness/testAuthContext'));

const WIDE_VIEWPORT_WIDTH = 1200;

function createDayRoomMock(
  sheriffElection: SheriffElectionState,
  nightReviewAllowedSeats: readonly number[] = [],
  isHost = false,
) {
  return createWerewolfRoomMock({
    schemaId: 'seerCheck',
    currentActionRole: 'seer',
    myRole: 'villager',
    mySeat: 3,
    numberOfPlayers: 4,
    isHost,
    gameStateOverrides: {
      status: GameStatus.Day,
      rules: { isSheriffElectionEnabled: true },
      sheriffElection,
      nightReviewAllowedSeats,
    },
    hookOverrides: { roomStatus: GameStatus.Day },
  });
}

const FIRST_VOTE: SheriffElectionState = {
  phase: 'firstVote',
  registeredSeats: [0, 1],
  withdrawnSeats: [],
  completedRounds: [],
  candidateSeats: [0, 1],
  eligibleVoterSeats: [2, 3],
  ballots: {},
};

describe('WerewolfRoomScreen sheriff-election composition', () => {
  it('opens and closes the details Sheet from the compact HUD', async () => {
    const screen = await mountWerewolfRoom(
      createDayRoomMock({
        phase: 'registration',
        registeredSeats: [],
        withdrawnSeats: [],
        completedRounds: [],
      }),
    );

    expect(screen.getByTestId(TESTIDS.sheriffElectionHud)).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.sheriffRegisterButton)).toBeInTheDocument();
    expect(screen.queryByTestId(TESTIDS.sheriffElectionInspector)).not.toBeInTheDocument();
    expect(screen.queryByTestId(TESTIDS.sheriffElectionSheet)).not.toBeInTheDocument();

    await click(screen.getByTestId(TESTIDS.sheriffElectionHud));

    expect(await screen.findByTestId(TESTIDS.sheriffElectionSheet)).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.sheriffElectionPanel)).toBeInTheDocument();

    await click(screen.getByTestId(TESTIDS.sheriffDetailsCloseButton));
    await waitFor(() =>
      expect(screen.queryByTestId(TESTIDS.sheriffElectionSheet)).not.toBeInTheDocument(),
    );
  });

  it('renders the wide Inspector and never turns seat taps into ballots', async () => {
    const mock = createDayRoomMock(FIRST_VOTE);
    const screen = await mountWerewolfRoom(mock, { viewportWidth: WIDE_VIEWPORT_WIDTH });

    expect(screen.getByTestId(TESTIDS.sheriffElectionInspector)).toBeInTheDocument();
    expect(screen.queryByTestId(TESTIDS.sheriffElectionSheet)).not.toBeInTheDocument();
    expect(screen.queryByTestId(TESTIDS.sheriffDetailsButton)).not.toBeInTheDocument();
    expect(screen.getByText('请在「警长竞选」中投票')).toBeInTheDocument();

    await click(screen.getByTestId(TESTIDS.seatTilePressable(0)));

    expect(mock.dispatch).not.toHaveBeenCalled();

    await click(screen.getByTestId(TESTIDS.sheriffCandidateButton(0)));
    await waitFor(() =>
      expect(mock.dispatch).toHaveBeenCalledWith(
        { type: 'werewolf.sheriff.vote', targetSeat: 0 },
        expect.anything(),
      ),
    );
  });

  it('shows the shared review action to an authorized player during voting', async () => {
    const screen = await mountWerewolfRoom(createDayRoomMock(FIRST_VOTE, [3]));

    expect(screen.getByTestId(TESTIDS.sheriffOpenVoteButton)).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.roomReviewOpenButton)).toBeInTheDocument();
  });

  it.each([
    {
      phase: 'registration',
      registeredSeats: [],
      withdrawnSeats: [],
      completedRounds: [],
    },
    {
      phase: 'candidateSpeech',
      registeredSeats: [0, 1],
      withdrawnSeats: [],
      completedRounds: [],
      speakingStartSeat: 0,
      speakingDirection: 'clockwise',
    },
    FIRST_VOTE,
  ] satisfies readonly SheriffElectionState[])(
    'lets the host grant review access from the task during $phase',
    async (election) => {
      const harness = new RoomScreenTestHarness();
      const detachAlerts = recordAlerts(harness);
      try {
        const mock = createDayRoomMock(election, [], true);
        const screen = await mountWerewolfRoom(mock);
        await click(screen.getByTestId(TESTIDS.roomMoreActionsButton));
        await click(screen.getByTestId(TESTIDS.lastNightInfoButton));
        await harness.pressButton('确定查看');
        await harness.pressButton('知道了');
        expect(mock.dispatch).toHaveBeenCalledWith(
          { type: 'werewolf.lastNightInfo.confirm', gameSequence: mock.state.gameSequence },
          expect.anything(),
        );
        act(() =>
          mock.session.publishRoom(
            createRoomSnapshot({ ...mock.state, lastNightInfoConfirmed: true }, 2),
          ),
        );
        const task = within(screen.getByTestId(TESTIDS.roomHostTaskCard));
        await click(task.getByTestId(TESTIDS.shareReviewButton));
        const picker = await screen.findByTestId(TESTIDS.shareReviewModal);
        const [firstSeat] = within(picker).getAllByRole('checkbox');
        if (firstSeat === undefined) throw new Error('Expected a player to authorize');
        await click(firstSeat);
        await click(within(picker).getByRole('button', { name: '确认（1人）' }));
        await waitFor(() =>
          expect(mock.dispatch).toHaveBeenCalledWith(
            { type: 'werewolf.review.share', allowedSeats: [0] },
            expect.anything(),
          ),
        );
        await waitFor(() =>
          expect(screen.queryByTestId(TESTIDS.shareReviewModal)).not.toBeInTheDocument(),
        );
        if (election.phase === 'candidateSpeech') {
          expect(screen.getByTestId(TESTIDS.roomHostManagementPanel)).toBeInTheDocument();
          expect(
            within(screen.getByTestId(TESTIDS.roomHostTaskCard)).getByTestId(
              TESTIDS.sheriffSelfDestructButton,
            ),
          ).toBeInTheDocument();
        }
      } finally {
        detachAlerts();
      }
    },
  );

  it('keeps authorization locked after a failed acknowledgement', async () => {
    const harness = new RoomScreenTestHarness();
    const detachAlerts = recordAlerts(harness);
    try {
      const mock = createDayRoomMock(FIRST_VOTE, [], true);
      mock.dispatch.mockResolvedValueOnce({
        kind: 'undelivered',
        commandId: 'confirmation',
        cause: 'network',
      });
      const screen = await mountWerewolfRoom(mock);
      await click(screen.getByTestId(TESTIDS.roomMoreActionsButton));
      await click(screen.getByTestId(TESTIDS.lastNightInfoButton));
      await harness.pressButton('确定查看');
      await harness.pressButton('知道了');
      expect(screen.getByTestId(TESTIDS.shareReviewButton)).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    } finally {
      detachAlerts();
    }
  });

  it('restores the host authorization step from an acknowledged room snapshot', async () => {
    const mock = createWerewolfRoomMock({
      schemaId: 'seerCheck',
      currentActionRole: 'seer',
      myRole: 'villager',
      mySeat: 0,
      numberOfPlayers: 4,
      isHost: true,
      gameStateOverrides: { status: GameStatus.Ended, lastNightInfoConfirmed: true },
    });
    const screen = await mountWerewolfRoom(mock);
    await click(screen.getByTestId(TESTIDS.roomMoreActionsButton));
    const task = within(screen.getByTestId(TESTIDS.roomHostTaskCard));
    expect(task.getByTestId(TESTIDS.shareReviewButton)).not.toHaveAttribute('aria-disabled');
    expect(task.getByTestId(TESTIDS.shareReviewButton)).toHaveTextContent('待办');
  });

  it.each([390, WIDE_VIEWPORT_WIDTH])(
    'keeps the Ended grant/review tools before restart at viewport width %s',
    async (viewportWidth) => {
      const harness = new RoomScreenTestHarness();
      const detachAlerts = recordAlerts(harness);
      try {
        const reactive = createReactiveWerewolfRoomMock({
          schemaId: 'seerCheck',
          currentActionRole: 'seer',
          myRole: 'villager',
          mySeat: 0,
          numberOfPlayers: 4,
          isHost: true,
          gameStateOverrides: { status: GameStatus.Ended },
        });
        const screen = await mountWerewolfRoom(reactive.mock, { viewportWidth });
        await click(screen.getByTestId(TESTIDS.roomMoreActionsButton));
        let task = within(screen.getByTestId(TESTIDS.roomHostTaskCard));
        let steps = within(task.getByRole('list'));
        expect(steps.getAllByRole('button').map((button) => button.textContent)).toEqual([
          '昨夜信息',
          '授权',
          '本局复盘',
        ]);
        await click(task.getByTestId(TESTIDS.lastNightInfoButton));
        await harness.pressButton('确定查看');
        await harness.pressButton('知道了');
        act(() =>
          reactive.simulateStateUpdate({
            gameStateOverrides: { status: GameStatus.Ended, lastNightInfoConfirmed: true },
          }),
        );

        expect(screen.getByTestId(TESTIDS.roomHostManagementPanel)).toBeInTheDocument();
        task = within(screen.getByTestId(TESTIDS.roomHostTaskCard));
        steps = within(task.getByRole('list'));
        const choiceTestIds = new Set<string>([
          TESTIDS.shareReviewButton,
          TESTIDS.roomReviewHostAction,
          TESTIDS.restartButton,
        ]);
        const choices = task
          .getAllByRole('button')
          .filter((button) => choiceTestIds.has(button.dataset.testid ?? ''));
        expect(choices.map((button) => button.dataset.testid)).toEqual([
          TESTIDS.shareReviewButton,
          TESTIDS.roomReviewHostAction,
          TESTIDS.restartButton,
        ]);
        expect(task.getByTestId(TESTIDS.shareReviewButton)).toHaveTextContent('待办');
        expect(task.getByTestId(TESTIDS.roomReviewHostAction)).not.toHaveTextContent('待办');
        expect(task.getByTestId(TESTIDS.roomReviewHostAction)).toHaveAttribute(
          'aria-disabled',
          'true',
        );
        expect(steps.getByRole('button', { name: '授权' })).toHaveAttribute(
          'data-state',
          'current',
        );
        await click(task.getByTestId(TESTIDS.shareReviewButton));
        const picker = await screen.findByTestId(TESTIDS.shareReviewModal);
        await click(within(picker).getByRole('button', { name: '取消' }));
        expect(screen.getByTestId(TESTIDS.roomHostManagementPanel)).toBeInTheDocument();
        task = within(screen.getByTestId(TESTIDS.roomHostTaskCard));
        steps = within(task.getByRole('list'));
        expect(steps.getByRole('button', { name: '授权' })).toHaveAttribute(
          'data-state',
          'current',
        );

        act(() =>
          reactive.simulateStateUpdate({
            gameStateOverrides: {
              status: GameStatus.Ended,
              nightReviewAllowedSeats: [1],
              lastNightInfoConfirmed: true,
            },
          }),
        );
        expect(steps.getByRole('button', { name: '授权' })).toHaveAttribute(
          'data-state',
          'complete',
        );
        expect(steps.getByRole('button', { name: '本局复盘' })).toHaveAttribute(
          'data-state',
          'current',
        );
        expect(task.getByTestId(TESTIDS.roomReviewHostAction)).not.toHaveAttribute('aria-disabled');
        await click(task.getByTestId(TESTIDS.shareReviewButton));
        expect(await screen.findByTestId(TESTIDS.shareReviewModal)).toBeInTheDocument();
      } finally {
        detachAlerts();
      }
    },
  );

  it('restores Ended controls while retaining the completed election Inspector', async () => {
    const harness = new RoomScreenTestHarness();
    const detachAlerts = recordAlerts(harness);
    try {
      const mock = createWerewolfRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'villager',
        mySeat: 0,
        numberOfPlayers: 4,
        isHost: true,
        gameStateOverrides: {
          status: GameStatus.Ended,
          sheriffElection: {
            phase: 'completed',
            registeredSeats: [0, 1],
            withdrawnSeats: [],
            completedRounds: [],
          },
          sheriffElectionResult: { kind: 'elected', sheriffSeat: 0 },
        },
        hookOverrides: { roomStatus: GameStatus.Ended },
      });
      const screen = await mountWerewolfRoom(mock, { viewportWidth: WIDE_VIEWPORT_WIDTH });

      expect(screen.getByTestId(TESTIDS.sheriffElectionInspector)).toBeInTheDocument();
      await click(screen.getByTestId(TESTIDS.roomMoreActionsButton));
      expect(await screen.findByTestId(TESTIDS.roomHostManagementPanel)).toBeInTheDocument();
      expect(screen.getByTestId(TESTIDS.roomReviewHostAction)).toBeInTheDocument();
      expect(screen.getByTestId(TESTIDS.lastNightInfoButton)).toBeInTheDocument();
      expect(screen.queryByTestId(TESTIDS.sheriffAdvanceButton)).not.toBeInTheDocument();

      await click(screen.getByTestId(TESTIDS.lastNightInfoButton));
      await harness.pressButton('确定查看');
      await harness.pressButton('知道了');
      act(() =>
        mock.session.publishRoom(
          createRoomSnapshot({ ...mock.state, lastNightInfoConfirmed: true }, 2),
        ),
      );
      await click(screen.getByTestId(TESTIDS.shareReviewButton));
      const picker = await screen.findByTestId(TESTIDS.shareReviewModal);
      const playerSeats = within(picker).getAllByRole('checkbox');
      expect(playerSeats).toHaveLength(3);
      const [firstPlayerSeat] = playerSeats;
      if (firstPlayerSeat === undefined) throw new Error('Expected a player seat to authorize');
      await click(firstPlayerSeat);
      await click(within(picker).getByRole('button', { name: '确认（1人）' }));
      await waitFor(() =>
        expect(mock.dispatch).toHaveBeenCalledWith(
          { type: 'werewolf.review.share', allowedSeats: [1] },
          expect.anything(),
        ),
      );
      await waitFor(() =>
        expect(screen.queryByTestId(TESTIDS.shareReviewModal)).not.toBeInTheDocument(),
      );
    } finally {
      detachAlerts();
    }
  });
});
