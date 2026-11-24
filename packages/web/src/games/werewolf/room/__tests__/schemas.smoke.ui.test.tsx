import { getAllSchemaIds, type RoleId } from '@game-judge/game-engine/games/werewolf/public';

import { openNightActionGroup } from '@/games/werewolf/room/__tests__/harness';
import {
  collectBoardNightScenarios,
  mountBoardNightState,
} from '@/games/werewolf/room/__tests__/harness/boardNightScenarios';
import { TESTIDS } from '@/testids';

vi.mock('@/contexts/AuthContext', () => import('./harness/testAuthContext'));

const boards: readonly (readonly RoleId[])[] = [
  [
    'wolf',
    'seer',
    'mirrorSeer',
    'drunkSeer',
    'witch',
    'hunter',
    'guard',
    'dreamcatcher',
    'psychic',
    'pureWhite',
    'villager',
    'villager',
  ],
  [
    'nightmare',
    'wolfWitch',
    'wolfQueen',
    'darkWolfKing',
    'gargoyle',
    'awakenedGargoyle',
    'wolfRobot',
    'eclipseWolfQueen',
    'villager',
    'villager',
    'seer',
    'witch',
  ],
  [
    'wolf',
    'seedWolf',
    'wolfGirl',
    'poisoner',
    'hiddenWolf',
    'piper',
    'cupid',
    'magician',
    'silenceElder',
    'votebanElder',
    'crow',
    'villager',
  ],
  [
    'wolf',
    'wildChild',
    'slacker',
    'shadow',
    'avenger',
    'gargoyle',
    'villager',
    'villager',
    'villager',
    'witch',
    'seer',
    'hunter',
  ],
];

const scenarios = [
  ...boards.flatMap((roles) =>
    collectBoardNightScenarios(roles, new Map(roles.map((role, seat) => [seat, role]))),
  ),
  ...collectBoardNightScenarios('盗贼丘比特'),
  ...collectBoardNightScenarios('盗宝大师'),
];

describe('WerewolfRoomScreen shared-step smoke (one per night step)', () => {
  it.each(getAllSchemaIds())('renders the engine presentation for %s', async (stepId) => {
    const scenario = scenarios.find(
      (candidate) => candidate.presentation.stepId === stepId && candidate.action !== null,
    );
    if (scenario?.action == null) throw new Error(`[TEST] No real UI scenario for ${stepId}`);
    const { view } = await mountBoardNightState(scenario.state, scenario.viewerSeat);
    if (scenario.presentation.message !== null) {
      expect(view.getByTestId(TESTIDS.actionMessage)).toHaveTextContent(
        scenario.presentation.message,
      );
    }
    const actionId = TESTIDS.stepInteractionButton(scenario.action.key);
    if (view.queryByTestId(actionId) === null) await openNightActionGroup(view);
    expect(view.getByTestId(actionId)).toHaveTextContent(scenario.action.label);
    view.unmount();
  });
});
