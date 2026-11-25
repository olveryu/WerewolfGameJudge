import {
  assertBoardNightScenario,
  collectBoardNightScenarios,
} from '@/games/werewolf/room/__tests__/harness/boardNightScenarios';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const scenarios = collectBoardNightScenarios('盗贼丘比特');

describe('WerewolfRoomScreen UI: 盗贼丘比特', () => {
  it('covers the board’s night steps with engine-produced states', () => {
    expect(scenarios.map((scenario) => scenario.presentation.stepId)).toEqual(
      expect.arrayContaining(['wolfKill', 'thiefChoose']),
    );
  });

  it.each(scenarios)('$label submits through the real room screen', async (scenario) => {
    await assertBoardNightScenario(scenario);
  });
});
