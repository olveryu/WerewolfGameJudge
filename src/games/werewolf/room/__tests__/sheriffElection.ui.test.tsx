/** Screen-level coverage for the adaptive first-day sheriff-election composition. */

import type { SheriffElectionState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import {
  createWerewolfRoomMock,
  mockNavigation,
  mockRoom,
  waitForRoomScreen,
} from '@/games/werewolf/room/__tests__/harness';
import { WerewolfRoomScreen } from '@/games/werewolf/room/__tests__/harness/ReadyWerewolfRoomScreen';
import { TESTIDS } from '@/testids';

let mockViewportWidth = 390;
let mockUseWerewolfRoomReturn: ReturnType<typeof createWerewolfRoomMock>;

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1,
    height: 844,
    scale: 1,
    width: mockViewportWidth,
  }),
}));

jest.mock('@/games/werewolf/hooks/useWerewolfRoom', () => ({
  useWerewolfRoom: () => mockUseWerewolfRoomReturn,
}));

jest.mock('../useRoomHostDialogs', () => ({
  useRoomHostDialogs: () => ({
    showPrepareToFlipDialog: jest.fn(),
    showStartGameDialog: jest.fn(),
    showRestartDialog: jest.fn(),
    handleSettingsPress: jest.fn(),
  }),
}));

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

function renderRoom() {
  return render(
    <WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />,
  );
}

describe('WerewolfRoomScreen sheriff-election composition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockViewportWidth = 390;
  });

  it('opens and closes the details Sheet from the compact HUD', async () => {
    mockUseWerewolfRoomReturn = createDayRoomMock({
      phase: 'registration',
      registeredSeats: [],
      withdrawnSeats: [],
      completedRounds: [],
    });

    const screen = renderRoom();
    await waitForRoomScreen(screen.getByTestId);

    expect(screen.getByTestId(TESTIDS.sheriffElectionHud)).toBeTruthy();
    expect(screen.getByTestId(TESTIDS.sheriffRegisterButton)).toBeTruthy();
    expect(screen.queryByTestId(TESTIDS.sheriffElectionInspector)).toBeNull();
    expect(screen.queryByTestId(TESTIDS.sheriffElectionSheet)).toBeNull();

    fireEvent.press(screen.getByTestId(TESTIDS.sheriffElectionHud));

    expect(screen.getByTestId(TESTIDS.sheriffElectionSheet)).toBeTruthy();
    expect(screen.getByTestId(TESTIDS.sheriffElectionPanel)).toBeTruthy();

    fireEvent.press(screen.getByTestId(TESTIDS.sheriffDetailsCloseButton));
    await waitFor(() => {
      expect(screen.queryByTestId(TESTIDS.sheriffElectionSheet)).toBeNull();
    });
  });

  it('renders the wide Inspector and never turns seat taps into ballots', async () => {
    mockViewportWidth = 1200;
    mockUseWerewolfRoomReturn = createDayRoomMock({
      phase: 'firstVote',
      registeredSeats: [0, 1],
      withdrawnSeats: [],
      completedRounds: [],
      candidateSeats: [0, 1],
      eligibleVoterSeats: [2, 3],
      ballots: {},
    });

    const screen = renderRoom();
    await waitForRoomScreen(screen.getByTestId);

    expect(screen.getByTestId(TESTIDS.sheriffElectionInspector)).toBeTruthy();
    expect(screen.queryByTestId(TESTIDS.sheriffElectionSheet)).toBeNull();
    expect(screen.queryByTestId(TESTIDS.sheriffDetailsButton)).toBeNull();
    expect(screen.getByText('请在右侧投票')).toBeTruthy();

    fireEvent.press(screen.getByTestId(TESTIDS.seatTilePressable(0)));

    expect(mockUseWerewolfRoomReturn.castSheriffVote).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId(TESTIDS.sheriffCandidateButton(0)));
    await waitFor(() => {
      expect(mockUseWerewolfRoomReturn.castSheriffVote).toHaveBeenCalledWith(0);
    });
  });

  it('shows the shared night-review action to an authorized player during voting', async () => {
    mockUseWerewolfRoomReturn = createDayRoomMock(
      {
        phase: 'firstVote',
        registeredSeats: [0, 1],
        withdrawnSeats: [],
        completedRounds: [],
        candidateSeats: [0, 1],
        eligibleVoterSeats: [2, 3],
        ballots: {},
      },
      [3],
    );

    const screen = renderRoom();
    await waitForRoomScreen(screen.getByTestId);

    expect(screen.getByTestId(TESTIDS.sheriffOpenVoteButton)).toBeTruthy();
    expect(screen.getByTestId(TESTIDS.nightReviewButton)).toBeTruthy();
  });

  it('restores Ended controls while retaining the completed election Inspector', async () => {
    mockViewportWidth = 1200;
    mockUseWerewolfRoomReturn = createWerewolfRoomMock({
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

    const screen = renderRoom();
    await waitForRoomScreen(screen.getByTestId);

    expect(screen.getByTestId(TESTIDS.sheriffElectionInspector)).toBeTruthy();
    fireEvent.press(screen.getByTestId(TESTIDS.roomHostManagementButton));
    expect(screen.getByTestId(TESTIDS.roomHostManagementPanel)).toBeTruthy();
    expect(screen.getByTestId(TESTIDS.nightReviewButton)).toBeTruthy();
    expect(screen.getByTestId(TESTIDS.lastNightInfoButton)).toBeTruthy();
    expect(screen.queryByTestId(TESTIDS.sheriffAdvanceButton)).toBeNull();
  });
});
