import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { act, waitFor, within } from '@testing-library/react';

import { getRequiredUiDialogTypes } from '@/games/werewolf/room/__tests__/harness/boardDialogCoverage';
import {
  assertBoardNightScenario,
  collectBoardNightScenarios,
  mountBoardNightState,
  playBoardNightGame,
  pressStepAction,
  requireBoardNightScenario,
} from '@/games/werewolf/room/__tests__/harness/boardNightScenarios';
import {
  createWerewolfRoomMock,
  mountWerewolfRoom,
  tapSeat,
} from '@/games/werewolf/room/__tests__/harness/boardTestUtils';
import {
  recordAlerts,
  RoomScreenTestHarness,
} from '@/games/werewolf/room/__tests__/harness/RoomScreenTestHarness';
import { TEST_USER_ID } from '@/games/werewolf/room/__tests__/harness/testAuthContext';
import { TESTIDS } from '@/testids';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const scenarios = collectBoardNightScenarios('猩红蜂舞');

describe('WerewolfRoomScreen UI: 猩红蜂舞', () => {
  it('covers the new role and ordinary night steps', () => {
    expect(scenarios.map((scenario) => scenario.presentation.stepId)).toEqual(
      expect.arrayContaining([
        'wolfKill',
        'scarletWolfKingMark',
        'seerCheck',
        'witchAction',
        'guardProtect',
      ]),
    );
    expect(scenarios.map((scenario) => scenario.presentation.stepId)).not.toContain('beeHunter');
  });

  it.each(scenarios)('$label submits through the real room screen', async (scenario) => {
    await assertBoardNightScenario(scenario);
  });

  it('shows the required mark interaction and commits the chosen seat', async () => {
    const scenario = requireBoardNightScenario(
      scenarios,
      'scarletWolfKingMark',
      'scarletWolfKingMark',
    );
    const harness = new RoomScreenTestHarness();
    const detach = recordAlerts(harness);
    try {
      const { mock, view } = await mountBoardNightState(scenario.state, scenario.viewerSeat);
      harness.expectInlineStatus('actionPrompt');
      await pressStepAction(view, 'scarletWolfKingMark');
      const seat = scenario.submission.seats?.[0];
      if (seat === undefined) throw new Error('[TEST] Missing mark target');
      await tapSeat(view, seat);
      await waitFor(() => expect(harness.getLastEvent()).not.toBeNull());
      expect(getRequiredUiDialogTypes(scenario.state.templateRoles)).toEqual([
        'actionPrompt',
        'actionConfirm',
      ]);
      harness.assertCoverage(['actionPrompt', 'actionConfirm']);
      await harness.pressLastPrimary();
      await waitFor(() =>
        expect(mock.dispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'werewolf.step.submit',
            submission: scenario.submission,
          }),
          expect.anything(),
        ),
      );
      view.unmount();
    } finally {
      detach();
    }
  });

  it('keeps the marked seat visible to players after dawn without exposing the king', async () => {
    const roles = [
      'wolf',
      'scarletWolfKing',
      'seer',
      'witch',
      'guard',
      'beeHunter',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
    ] as const;
    const game = playBoardNightGame(roles, {
      isQuiet: true,
      choices: { scarletWolfKingMark: { actionKey: 'scarletWolfKingMark', seats: [6] } },
      rules: { isSheriffElectionEnabled: true },
    });
    const state = game.getGameState();
    const occupant = state.roster[7];
    if (occupant == null) throw new Error('[TEST] Missing viewer');
    const mock = createWerewolfRoomMock({
      schemaId: 'seerCheck',
      currentActionRole: 'seer',
      myRole: 'villager',
      mySeat: 7,
      gameStateOverrides: {
        ...state,
        roster: { ...state.roster, 7: { ...occupant, userId: TEST_USER_ID } },
      },
    });
    const view = await mountWerewolfRoom(mock);
    const announcement = within(view.getByTestId(TESTIDS.roomBoardStatus)).getByText(
      '猩红之子：7号',
    );
    expect(announcement).toBeVisible();
    expect(announcement.closest('.room-compact-status')).not.toBeNull();
    expect(view.getAllByText('猩红之子：7号')).toHaveLength(1);
    if (game.getGameState().isAudioPlaying) {
      game.acknowledgePendingAudioOrThrow('finish dawn narration');
    }
    game.dispatchAsSeatOrThrow(
      0,
      { type: 'werewolf.sheriff.register' },
      'register first candidate',
    );
    game.dispatchAsSeatOrThrow(
      1,
      { type: 'werewolf.sheriff.register' },
      'register second candidate',
    );
    game.dispatchAsHostOrThrow({ type: 'werewolf.sheriff.advance' }, 'advance sheriff election');
    const electionState = game.getGameState();
    expect(electionState.sheriffElection?.phase).not.toBe(state.sheriffElection?.phase);
    act(() =>
      mock.session.publishRoom(
        createRoomSnapshot(
          {
            ...electionState,
            roster: { ...electionState.roster, 7: { ...occupant, userId: TEST_USER_ID } },
          },
          2,
        ),
      ),
    );
    const electionAnnouncement = within(view.getByTestId(TESTIDS.roomBoardStatus)).getByText(
      '猩红之子：7号',
    );
    expect(electionAnnouncement).toBeVisible();
    expect(electionAnnouncement.closest('.room-compact-status')).toBe(
      view.getByTestId(TESTIDS.sheriffElectionHud),
    );
    expect(view.getAllByText('猩红之子：7号')).toHaveLength(1);
    view.unmount();
  });

  it('shows the mark in the status card when sheriff election is disabled', async () => {
    const game = playBoardNightGame(['scarletWolfKing', 'villager'], {
      isQuiet: true,
      choices: { scarletWolfKingMark: { actionKey: 'scarletWolfKingMark', seats: [1] } },
      rules: { isSheriffElectionEnabled: false },
    });
    const state = game.getGameState();
    const occupant = state.roster[1];
    if (occupant == null) throw new Error('[TEST] Missing viewer');
    const mock = createWerewolfRoomMock({
      schemaId: 'scarletWolfKingMark',
      currentActionRole: 'scarletWolfKing',
      myRole: 'villager',
      mySeat: 1,
      gameStateOverrides: {
        ...state,
        roster: { ...state.roster, 1: { ...occupant, userId: TEST_USER_ID } },
      },
    });
    const view = await mountWerewolfRoom(mock);
    const announcement = within(view.getByTestId(TESTIDS.roomBoardStatus)).getByText(
      '猩红之子：2号',
    );
    expect(announcement).toBeVisible();
    expect(announcement.closest('.room-compact-status')).not.toBeNull();
    expect(view.getAllByText('猩红之子：2号')).toHaveLength(1);
    view.unmount();
  });
});
