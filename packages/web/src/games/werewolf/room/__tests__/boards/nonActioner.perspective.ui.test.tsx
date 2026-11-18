/**
 * Non-Actioner Board UI Test
 *
 * Verifies the non-actioner perspective: when the viewer is not the step's actor,
 * night dialogs and seat selection controls must not appear.
 */

import {
  expectSeatSelectionUnavailable,
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
    const view = await mount({
      schemaId: 'witchAction',
      currentActionRole: 'witch',
      myRole: 'villager',
      mySeat: 0,
      witchContext: { killedSeat: 1, canSave: true, canPoison: true },
    });

    expect(harness.hasSeen('witchSavePrompt')).toBe(false);
    expectSeatSelectionUnavailable(view);
  });

  it('witchAction step: non-actioner tapping a seat cannot draft a poison target', async () => {
    const view = await mount({
      schemaId: 'witchAction',
      currentActionRole: 'witch',
      myRole: 'villager',
      mySeat: 0,
      witchContext: { killedSeat: -1, canSave: false, canPoison: true },
    });
    harness.clear();
    await tapSeat(view, 1);

    expectSeatSelectionUnavailable(view);
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

  it('wolfKill step: non-actioner cannot select a wolf target', async () => {
    const view = await mount({
      schemaId: 'wolfKill',
      currentActionRole: 'wolf',
      myRole: 'villager',
      mySeat: 0,
    });

    expectSeatSelectionUnavailable(view);
  });
});
