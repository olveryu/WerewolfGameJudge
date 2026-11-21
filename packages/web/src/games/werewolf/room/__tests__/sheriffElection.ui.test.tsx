/** Screen-level coverage for the adaptive first-day sheriff-election composition. */

import type { SheriffElectionState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { act, fireEvent, waitFor, within } from '@testing-library/react';

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
  it('shows the timed result above an open note and preserves its draft', async () => {
    const mock = createDayRoomMock(FIRST_VOTE);
    const screen = await mountWerewolfRoom(mock);
    await click(screen.getByRole('button', { name: '手册' }));
    await click(screen.getByRole('button', { name: '笔记' }));
    const notes = within(await screen.findByRole('dialog', { name: '笔记' })).getByRole('textbox', {
      name: '投票记录',
    });
    fireEvent.change(notes, { target: { value: '测试草稿' } });
    const result: SheriffElectionState = {
      phase: 'result',
      registeredSeats: [0, 1],
      withdrawnSeats: [],
      completedRounds: [
        {
          round: 'first',
          candidateSeats: [0, 1],
          eligibleVoterSeats: [2, 3],
          ballots: { 2: 0, 3: null },
          voteCounts: { 0: 1, 1: 0 },
          abstainingSeats: [3],
        },
      ],
      deadline: Date.now() + 5000,
      next: { kind: 'final', result: { kind: 'elected', sheriffSeat: 0 } },
    };
    act(() =>
      mock.session.publishRoom(createRoomSnapshot({ ...mock.state, sheriffElection: result }, 2)),
    );
    const dialog = await screen.findByRole('dialog', { name: '警长竞选结果' });
    expect(dialog).toHaveTextContent('当选警长');
    expect(dialog).toHaveTextContent('弃票');
    expect(within(dialog).queryByRole('button', { name: '知道了' })).not.toBeInTheDocument();
    expect(notes).toHaveValue('测试草稿');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: '警长竞选结果' })).toBeInTheDocument();
    act(() =>
      mock.session.publishRoom(
        createRoomSnapshot(
          {
            ...mock.state,
            status: GameStatus.Ended,
            sheriffElection: {
              phase: 'completed',
              registeredSeats: result.registeredSeats,
              withdrawnSeats: result.withdrawnSeats,
              completedRounds: result.completedRounds,
            },
            sheriffElectionResult: { kind: 'elected', sheriffSeat: 0 },
          },
          3,
        ),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '警长竞选结果' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('textbox', { name: '投票记录' })).toBe(notes);
    expect(notes).toHaveValue('测试草稿');
  });

  it('uses the room status card even without an election', async () => {
    const mock = createWerewolfRoomMock({
      schemaId: 'seerCheck',
      currentActionRole: 'seer',
      myRole: 'villager',
      mySeat: 0,
      numberOfPlayers: 4,
      gameStateOverrides: { status: GameStatus.Day, rules: { isSheriffElectionEnabled: false } },
      hookOverrides: { roomStatus: GameStatus.Day },
    });
    const screen = await mountWerewolfRoom(mock);
    expect(screen.getByText('白天').closest('.room-board-status-card')).not.toBeNull();
    expect(screen.queryByTestId(TESTIDS.sheriffElectionHud)).not.toBeInTheDocument();
  });
  it('shows registration status once while retaining election details', async () => {
    const mock = createWerewolfRoomMock({
      schemaId: 'seerCheck',
      currentActionRole: 'seer',
      myRole: 'villager',
      mySeat: 3,
      isViewerSeated: false,
      numberOfPlayers: 4,
      gameStateOverrides: {
        status: GameStatus.Day,
        rules: { isSheriffElectionEnabled: true },
        sheriffElection: {
          phase: 'registration',
          registeredSeats: [],
          withdrawnSeats: [],
          completedRounds: [],
        },
      },
      hookOverrides: { roomStatus: GameStatus.Day },
    });
    const screen = await mountWerewolfRoom(mock);
    expect(screen.getAllByText('报名进行中')).toHaveLength(1);
    expect(screen.getByText('白天')).toBeInTheDocument();
    await click(screen.getByTestId(TESTIDS.sheriffDetailsButton));
    expect(await screen.findByTestId(TESTIDS.sheriffElectionPanel)).toBeInTheDocument();
  });

  it('retains vote progress when the waiting message is summarized', async () => {
    const mock = createWerewolfRoomMock({
      schemaId: 'seerCheck',
      currentActionRole: 'seer',
      myRole: 'villager',
      mySeat: 0,
      numberOfPlayers: 4,
      gameStateOverrides: {
        status: GameStatus.Day,
        rules: { isSheriffElectionEnabled: true },
        sheriffElection: FIRST_VOTE,
      },
      hookOverrides: { roomStatus: GameStatus.Day },
    });
    const screen = await mountWerewolfRoom(mock);
    expect(screen.queryByText('等待投票完成')).not.toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.sheriffElectionHud)).toHaveTextContent('0/2 人已投票');
    expect(screen.getByTestId(TESTIDS.sheriffDetailsButton)).toBeInTheDocument();
  });

  it('opens and closes the details dialog from the green hand card', async () => {
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
    const cards = within(screen.getByRole('group', { name: '行动手牌' })).getAllByRole('button');
    const registration = screen.getByTestId(TESTIDS.sheriffRegisterButton);
    const identity = screen.getByTestId(TESTIDS.roomViewIdentityButton);
    expect(identity).toHaveAttribute('data-card-category', 'resource');
    expect(cards.indexOf(registration)).toBeLessThan(cards.indexOf(identity));
    expect(screen.queryByTestId(TESTIDS.sheriffElectionDialog)).not.toBeInTheDocument();

    const detailsCard = screen.getByTestId(TESTIDS.sheriffDetailsButton);
    expect(detailsCard).toHaveAttribute('data-card-category', 'resource');
    expect(detailsCard).toHaveAccessibleName('警长详情');
    expect(screen.getByTestId(TESTIDS.sheriffElectionHud).tagName).not.toBe('BUTTON');
    await click(detailsCard);

    expect(await screen.findByTestId(TESTIDS.sheriffElectionDialog)).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.sheriffElectionPanel)).toBeInTheDocument();

    await click(screen.getByTestId(TESTIDS.roomDialogCloseButton));
    await waitFor(() =>
      expect(screen.queryByTestId(TESTIDS.sheriffElectionDialog)).not.toBeInTheDocument(),
    );
  });

  it('opens the ballot on wide screens without turning seat taps into ballots', async () => {
    const mock = createDayRoomMock(FIRST_VOTE);
    const screen = await mountWerewolfRoom(mock, { viewportWidth: WIDE_VIEWPORT_WIDTH });

    expect(screen.queryByTestId(TESTIDS.sheriffElectionDialog)).not.toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.sheriffDetailsButton)).toHaveAttribute(
      'data-card-category',
      'resource',
    );
    expect(screen.getByTestId(TESTIDS.sheriffElectionHud)).toHaveTextContent(
      '点击下方「选择投票」投票',
    );

    await click(screen.getByTestId(TESTIDS.seatTilePressable(0)));
    expect(mock.dispatch).not.toHaveBeenCalled();

    await click(screen.getByTestId(TESTIDS.sheriffOpenVoteButton));
    expect(screen.getByRole('dialog', { name: '警长竞选详情' })).toBeInTheDocument();
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
    'lets the host grant review access from the host hand during $phase',
    async (election) => {
      const harness = new RoomScreenTestHarness();
      const detachAlerts = recordAlerts(harness);
      try {
        const mock = createDayRoomMock(election, [], true);
        const screen = await mountWerewolfRoom(mock);
        await click(screen.getByTestId(TESTIDS.roomMoreActionsButton));
        const cards = within(screen.getByRole('group', { name: '主持管理' })).getAllByRole(
          'button',
        );
        expect(cards.indexOf(screen.getByTestId(TESTIDS.lastNightInfoButton))).toBeLessThan(
          cards.indexOf(screen.getByTestId(TESTIDS.shareReviewButton)),
        );
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
        // Every host action returns to the main hand, so the host reopens management.
        await click(screen.getByTestId(TESTIDS.roomMoreActionsButton));
        const hostHand = within(screen.getByTestId(TESTIDS.roomHostManagementPanel));
        await click(hostHand.getByTestId(TESTIDS.shareReviewButton));
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
        expect(screen.queryByTestId(TESTIDS.roomHostManagementPanel)).not.toBeInTheDocument();
        if (election.phase === 'candidateSpeech') {
          await click(screen.getByTestId(TESTIDS.roomMoreActionsButton));
          expect(
            within(screen.getByTestId(TESTIDS.roomHostManagementPanel)).getByTestId(
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
      await click(screen.getByTestId(TESTIDS.roomMoreActionsButton));
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
    const hostHand = within(screen.getByTestId(TESTIDS.roomHostManagementPanel));
    expect(hostHand.getByTestId(TESTIDS.shareReviewButton)).not.toHaveAttribute('aria-disabled');
    expect(hostHand.getByTestId(TESTIDS.shareReviewButton)).toHaveAccessibleDescription(
      '有待处理操作',
    );
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
        let hostHand = within(screen.getByTestId(TESTIDS.roomHostManagementPanel));
        expect(hostHand.queryByRole('list')).not.toBeInTheDocument();
        await click(hostHand.getByTestId(TESTIDS.lastNightInfoButton));
        await harness.pressButton('确定查看');
        await harness.pressButton('知道了');
        act(() =>
          reactive.simulateStateUpdate({
            gameStateOverrides: { status: GameStatus.Ended, lastNightInfoConfirmed: true },
          }),
        );

        expect(screen.queryByTestId(TESTIDS.roomHostManagementPanel)).not.toBeInTheDocument();
        await click(screen.getByTestId(TESTIDS.roomMoreActionsButton));
        hostHand = within(screen.getByTestId(TESTIDS.roomHostManagementPanel));
        expect(hostHand.queryByRole('list')).not.toBeInTheDocument();
        const choiceTestIds = new Set<string>([
          TESTIDS.roomReviewHostAction,
          TESTIDS.shareReviewButton,
          TESTIDS.restartButton,
        ]);
        const choices = hostHand
          .getAllByRole('button')
          .filter((button) => choiceTestIds.has(button.dataset.testid ?? ''));
        expect(choices.map((button) => button.dataset.testid)).toEqual([
          TESTIDS.roomReviewHostAction,
          TESTIDS.shareReviewButton,
          TESTIDS.restartButton,
        ]);
        expect(hostHand.getByTestId(TESTIDS.shareReviewButton)).toHaveAccessibleDescription(
          '有待处理操作',
        );
        expect(
          hostHand
            .getByTestId(TESTIDS.roomReviewHostAction)
            .querySelector('.bottom-action-pending'),
        ).toBeNull();
        expect(hostHand.getByTestId(TESTIDS.roomReviewHostAction)).toHaveAttribute(
          'aria-disabled',
          'true',
        );
        await click(hostHand.getByTestId(TESTIDS.shareReviewButton));
        const picker = await screen.findByTestId(TESTIDS.shareReviewModal);
        await click(within(picker).getByRole('button', { name: '取消' }));
        expect(screen.queryByTestId(TESTIDS.roomHostManagementPanel)).not.toBeInTheDocument();
        await click(screen.getByTestId(TESTIDS.roomMoreActionsButton));
        hostHand = within(screen.getByTestId(TESTIDS.roomHostManagementPanel));
        expect(hostHand.queryByRole('list')).not.toBeInTheDocument();

        act(() =>
          reactive.simulateStateUpdate({
            gameStateOverrides: {
              status: GameStatus.Ended,
              nightReviewAllowedSeats: [1],
              lastNightInfoConfirmed: true,
            },
          }),
        );
        expect(hostHand.getByTestId(TESTIDS.roomReviewHostAction)).not.toHaveAttribute(
          'aria-disabled',
        );
        await click(hostHand.getByTestId(TESTIDS.shareReviewButton));
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

      expect(screen.getByTestId(TESTIDS.sheriffDetailsButton)).toBeInTheDocument();
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
      await click(screen.getByTestId(TESTIDS.roomMoreActionsButton));
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
