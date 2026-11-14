/** Screen-level coverage for the adaptive first-day sheriff-election composition. */

import type { SheriffElectionState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
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
) {
  return createWerewolfRoomMock({
    schemaId: 'seerCheck',
    currentActionRole: 'seer',
    myRole: 'villager',
    mySeat: 3,
    numberOfPlayers: 4,
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

  it.each([390, WIDE_VIEWPORT_WIDTH])(
    'keeps the Ended grant/review tools before both exits at viewport width %s',
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
        const task = within(screen.getByTestId(TESTIDS.roomHostTaskCard));
        const steps = within(task.getByRole('list'));
        expect(steps.getAllByRole('button').map((button) => button.textContent)).toEqual([
          '昨夜信息',
          '授权',
          '收尾',
        ]);
        await click(task.getByTestId(TESTIDS.roomNextStepButton));
        await harness.pressButton('确定查看');
        await harness.pressButton('知道了');

        const choices = task
          .getAllByRole('button')
          .filter((button) => button.dataset.testid?.startsWith(`${TESTIDS.roomHostTaskCard}-`));
        expect(choices.map((button) => button.textContent)).toEqual([
          '授权玩家查看',
          '本局复盘',
          '再来一局',
          '返回大厅',
        ]);
        expect(steps.getByRole('button', { name: '授权' })).toHaveAttribute(
          'data-state',
          'current',
        );
        await click(task.getByTestId(`${TESTIDS.roomHostTaskCard}-grant-review`));
        const picker = await screen.findByTestId(TESTIDS.shareReviewModal);
        await click(within(picker).getByRole('button', { name: '取消' }));
        expect(steps.getByRole('button', { name: '授权' })).toHaveAttribute(
          'data-state',
          'current',
        );

        act(() =>
          reactive.simulateStateUpdate({
            gameStateOverrides: {
              status: GameStatus.Ended,
              nightReviewAllowedSeats: [1],
            },
          }),
        );
        expect(steps.getByRole('button', { name: '授权' })).toHaveAttribute(
          'data-state',
          'complete',
        );
        expect(steps.getByRole('button', { name: '收尾' })).toHaveAttribute(
          'data-state',
          'current',
        );
        await click(steps.getByRole('button', { name: '授权' }));
        expect(await screen.findByTestId(TESTIDS.shareReviewModal)).toBeInTheDocument();
      } finally {
        detachAlerts();
      }
    },
  );

  it('restores Ended controls while retaining the completed election Inspector', async () => {
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
    await click(screen.getByTestId(TESTIDS.roomHostManagementButton));
    expect(await screen.findByTestId(TESTIDS.roomHostManagementPanel)).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.roomReviewHostAction)).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.lastNightInfoButton)).toBeInTheDocument();
    expect(screen.queryByTestId(TESTIDS.sheriffAdvanceButton)).not.toBeInTheDocument();

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
  });
});
