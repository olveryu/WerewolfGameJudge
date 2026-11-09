/** Screen-level coverage for the adaptive first-day sheriff-election composition. */

import type { SheriffElectionState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { waitFor } from '@testing-library/react';

import {
  click,
  createWerewolfRoomMock,
  mountWerewolfRoom,
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

  it('restores Ended controls while retaining the completed election Inspector', async () => {
    const screen = await mountWerewolfRoom(
      createWerewolfRoomMock({
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
      }),
      { viewportWidth: WIDE_VIEWPORT_WIDTH },
    );

    expect(screen.getByTestId(TESTIDS.sheriffElectionInspector)).toBeInTheDocument();
    await click(screen.getByTestId(TESTIDS.roomHostManagementButton));
    expect(await screen.findByTestId(TESTIDS.roomHostManagementPanel)).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.roomReviewHostAction)).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.lastNightInfoButton)).toBeInTheDocument();
    expect(screen.queryByTestId(TESTIDS.sheriffAdvanceButton)).not.toBeInTheDocument();
  });
});
