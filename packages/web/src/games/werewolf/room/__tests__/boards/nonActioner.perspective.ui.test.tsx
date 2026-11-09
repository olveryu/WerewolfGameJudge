/**
 * Non-Actioner Board UI Test
 *
 * Verifies the non-actioner perspective: when the viewer is not the step's actor,
 * action dialogs (actionPrompt / witchSavePrompt / witchPoisonPrompt / confirmTrigger)
 * must NOT appear. Fills the gap that board UI tests only cover the actioner view.
 */

import {
  mountRoomFor as mount,
  recordAlerts,
  RoomScreenTestHarness,
  tapSeat,
} from '@/games/werewolf/room/__tests__/harness';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

let harness: RoomScreenTestHarness;
let detachAlerts: () => void;

describe('WerewolfRoomScreen UI: non-actioner perspective', () => {
  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detachAlerts = recordAlerts(harness);
  });
  afterEach(() => detachAlerts());

  it('seer step: non-actioner villager sees no actionPrompt', async () => {
    // Current step is seerCheck, but myRole is villager (non-actioner)
    await mount({
      schemaId: 'seerCheck',
      currentActionRole: 'seer',
      myRole: 'villager',
      mySeat: 0,
    });

    expect(harness.hasSeen('actionPrompt')).toBe(false);
  });

  it('witchAction step: non-actioner villager sees no witch dialogs', async () => {
    await mount({
      schemaId: 'witchAction',
      currentActionRole: 'witch',
      myRole: 'villager',
      mySeat: 0,
      witchContext: { killedSeat: 1, canSave: true, canPoison: true },
    });

    expect(harness.hasSeen('witchSavePrompt')).toBe(false);
    expect(harness.hasSeen('witchPoisonPrompt')).toBe(false);
  });

  it('witchAction step: non-actioner tapping seat does not trigger poison dialog', async () => {
    const view = await mount({
      schemaId: 'witchAction',
      currentActionRole: 'witch',
      myRole: 'villager',
      mySeat: 0,
      witchContext: { killedSeat: -1, canSave: false, canPoison: true },
    });
    harness.clear();
    await tapSeat(view, 1);

    expect(harness.hasSeen('witchPoisonPrompt')).toBe(false);
  });

  it('hunterConfirm step: non-actioner sees no confirmTrigger or actionPrompt', async () => {
    await mount({
      schemaId: 'hunterConfirm',
      currentActionRole: 'hunter',
      myRole: 'villager',
      mySeat: 0,
      gameStateOverrides: { confirmStatus: { role: 'hunter', canShoot: true } },
    });

    expect(harness.hasSeen('confirmTrigger')).toBe(false);
    expect(harness.hasSeen('actionPrompt')).toBe(false);
  });

  it('wolfKill step: non-actioner sees no wolfVote dialog', async () => {
    await mount({ schemaId: 'wolfKill', currentActionRole: 'wolf', myRole: 'villager', mySeat: 0 });

    expect(harness.hasSeen('wolfVote')).toBe(false);
  });
});
