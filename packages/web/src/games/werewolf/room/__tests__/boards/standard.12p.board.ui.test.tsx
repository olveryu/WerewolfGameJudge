/**
 * Standard 12P Board UI Test
 *
 * Board: Seer-Witch-Hunter-Villager
 * Roles: 4x villager, 4x wolf, seer, witch, hunter, idiot
 *
 * Required UI coverage:
 * - actionPrompt: seer, witch, hunter actions
 * - wolfVote: draft and submit a target
 * - witchSavePrompt: witch save flow
 * - witch poison target selection
 * - confirmTrigger: hunter confirm trigger
 *
 * Server-data required (covered by integration):
 * - seerReveal
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { getSchema } from '@game-judge/game-engine/games/werewolf/public';
import { waitFor } from '@testing-library/react';

import {
  chainConfirmTrigger,
  chainWolfVote,
  coverageChainActionPrompt,
  coverageChainConfirmTrigger,
  coverageChainSeatSelection,
  coverageChainSkipConfirm,
  coverageChainWitchPoisonSelection,
  coverageChainWitchSavePrompt,
  coverageChainWolfVote,
  coverageChainWolfVoteEmpty,
  createWerewolfRoomMock,
  draftSeatSelection,
  getBoardByName,
  pressText,
  recordAlerts,
  renderWerewolfRoom,
  RoomScreenTestHarness,
  waitForRoomScreen,
} from '@/games/werewolf/room/__tests__/harness';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const BOARD_NAME = '预女猎白';
const _board = getBoardByName(BOARD_NAME)!;
const WOLVES = new Map<number, RoleId>([
  [4, 'wolf'],
  [5, 'wolf'],
  [6, 'wolf'],
  [7, 'wolf'],
]);

let harness: RoomScreenTestHarness;
let detachAlerts: () => void;

describe(`WerewolfRoomScreen UI: ${BOARD_NAME}`, () => {
  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detachAlerts = recordAlerts(harness);
  });
  afterEach(() => detachAlerts());

  describe('actionPrompt coverage', () => {
    it('seer action: shows action prompt', async () => {
      const view = renderWerewolfRoom(
        createWerewolfRoomMock({
          schemaId: 'seerCheck',
          currentActionRole: 'seer',
          myRole: 'seer',
          mySeat: 8,
        }),
      );
      await waitForRoomScreen(view);
      await waitFor(() => harness.expectInlineStatus('actionPrompt'));
    });
  });

  describe('wolf vote selection coverage', () => {
    it('wolf vote: drafting a target enables vote submission', async () => {
      const view = renderWerewolfRoom(
        createWerewolfRoomMock({
          schemaId: 'wolfKill',
          currentActionRole: 'wolf',
          myRole: 'wolf',
          mySeat: 4,
          roleAssignments: WOLVES,
        }),
      );
      await waitForRoomScreen(view);
      await draftSeatSelection(view, 1);
    });
  });

  describe('witchSavePrompt coverage', () => {
    it('witch action: shows save prompt when someone died', async () => {
      const view = renderWerewolfRoom(
        createWerewolfRoomMock({
          schemaId: 'witchAction',
          currentActionRole: 'witch',
          myRole: 'witch',
          mySeat: 9,
          witchContext: { killedSeat: 1, canSave: true, canPoison: true },
        }),
      );
      await waitForRoomScreen(view);
      await waitFor(() => harness.expectInlineStatus('witchSavePrompt'));
    });
  });

  describe('witch poison selection coverage', () => {
    it('witch action: drafting a poison target enables submission', async () => {
      const view = renderWerewolfRoom(
        createWerewolfRoomMock({
          schemaId: 'witchAction',
          currentActionRole: 'witch',
          myRole: 'witch',
          mySeat: 9,
          // No one died
          witchContext: { killedSeat: -1, canSave: false, canPoison: true },
        }),
      );
      await waitForRoomScreen(view);
      await draftSeatSelection(view, 1);
    });
  });

  describe('confirmTrigger coverage', () => {
    const bottomActionText = getSchema('hunterConfirm').ui?.bottomActionText;
    if (!bottomActionText) throw new Error('[TEST] Missing hunterConfirm.ui.bottomActionText');

    it('hunter confirm: pressing bottom button shows confirmTrigger dialog', async () => {
      const view = renderWerewolfRoom(
        createWerewolfRoomMock({
          schemaId: 'hunterConfirm',
          currentActionRole: 'hunter',
          myRole: 'hunter',
          mySeat: 10,
          gameStateOverrides: { confirmStatus: { role: 'hunter', canShoot: true } },
        }),
      );
      await waitForRoomScreen(view);

      await pressText(view, bottomActionText);
      await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
    });

    it('hunter poisoned: confirmTrigger shows cannotShoot message', async () => {
      const view = renderWerewolfRoom(
        createWerewolfRoomMock({
          schemaId: 'hunterConfirm',
          currentActionRole: 'hunter',
          myRole: 'hunter',
          mySeat: 10,
          gameStateOverrides: { confirmStatus: { role: 'hunter', canShoot: false } },
        }),
      );
      await waitForRoomScreen(view);

      await pressText(view, bottomActionText);
      await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));

      const event = harness.getLastEventOfType('confirmTrigger');
      expect(event).not.toBeNull();
      expect(event!.message).toContain('不能发动');
    });
  });

  describe('seer seat selection coverage', () => {
    it('seer: drafting a target enables submission', async () => {
      const view = renderWerewolfRoom(
        createWerewolfRoomMock({
          schemaId: 'seerCheck',
          currentActionRole: 'seer',
          myRole: 'seer',
          mySeat: 8,
        }),
      );
      await waitForRoomScreen(view);
      await draftSeatSelection(view, 1);
    });
  });

  describe('seer skipConfirm coverage', () => {
    it('seer: skip button shows skipConfirm dialog', async () => {
      const view = renderWerewolfRoom(
        createWerewolfRoomMock({
          schemaId: 'seerCheck',
          currentActionRole: 'seer',
          myRole: 'seer',
          mySeat: 8,
        }),
      );
      await waitForRoomScreen(view);
      harness.clear();

      const skipText = getSchema('seerCheck').ui?.bottomActionText;
      if (!skipText) throw new Error('[TEST] Missing seerCheck.ui.bottomActionText');
      await pressText(view, skipText);
      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
    });
  });

  describe('witchNoKill coverage', () => {
    it('witch: shows witchNoKill when killedSeat=-1', async () => {
      const view = renderWerewolfRoom(
        createWerewolfRoomMock({
          schemaId: 'witchAction',
          currentActionRole: 'witch',
          myRole: 'witch',
          mySeat: 9,
          witchContext: { killedSeat: -1, canSave: false, canPoison: true },
        }),
      );
      await waitForRoomScreen(view);
      await waitFor(() => harness.expectInlineStatus('witchNoKill'));
    });
  });

  describe('wolfVoteEmpty coverage', () => {
    it('wolf: empty knife button shows wolfVoteEmpty dialog', async () => {
      const view = renderWerewolfRoom(
        createWerewolfRoomMock({
          schemaId: 'wolfKill',
          currentActionRole: 'wolf',
          myRole: 'wolf',
          mySeat: 4,
          roleAssignments: WOLVES,
        }),
      );
      await waitForRoomScreen(view);
      harness.clear();

      const emptyText = getSchema('wolfKill').ui?.emptyVoteText;
      if (!emptyText) throw new Error('[TEST] Missing wolfKill.ui.emptyVoteText');
      await pressText(view, emptyText);
      await waitFor(() => expect(harness.hasSeen('wolfVoteEmpty')).toBe(true));
    });
  });

  // ===========================================================================
  // Chain Interaction (press button → assert callback)
  // ===========================================================================

  describe('chain interaction', () => {
    it('wolf target submission → submitAction called', async () => {
      await chainWolfVote('wolf', 4, WOLVES, 1);
    });

    it('confirmTrigger (hunter) → dialog dismissed', async () => {
      await chainConfirmTrigger(harness, 'hunterConfirm', 'hunter', 'hunter', 10);
    });
  });

  // ===========================================================================
  // Coverage Assertion (MUST PASS)
  // ===========================================================================

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI flows covered with chain interactions and effect assertions', async () => {
      // Step 1: actionPrompt (seer)
      await coverageChainActionPrompt(harness, 'seerCheck', 'seer', 'seer', 8);

      // Step 2: wolf target selection → submit → submitAction(1) called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote('wolf', 4, WOLVES, 1);
      expect(wolfVoteAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

      // Step 3: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, 9);

      // Step 4: witch poison selection
      await coverageChainWitchPoisonSelection(harness, 9);

      // Step 5: confirmTrigger (hunter) → press primary + assertNoLoop
      await coverageChainConfirmTrigger(harness, 'hunterConfirm', 'hunter', 'hunter', 10);

      // Step 6: seat selection (seer) → submit → submitAction called
      const { submitAction: seerSubmit } = await coverageChainSeatSelection(
        'seerCheck',
        'seer',
        'seer',
        8,
        1,
      );
      expect(seerSubmit).toHaveBeenCalled();

      // Step 7: skipConfirm (seer) → press primary → submitAction called
      const { submitAction: seerSkip } = await coverageChainSkipConfirm(
        harness,
        'seerCheck',
        'seer',
        'seer',
        8,
      );
      expect(seerSkip).toHaveBeenCalled();

      // Step 8: wolfVoteEmpty → press confirm → submitAction(null) called
      const { submitAction: emptyVote } = await coverageChainWolfVoteEmpty(
        harness,
        'wolf',
        4,
        WOLVES,
      );
      expect(emptyVote).toHaveBeenCalledWith({ kind: 'target', target: null });

      // Final: literal coverage requirements
      harness.assertCoverage([
        'actionPrompt',
        'wolfVoteEmpty',
        'witchSavePrompt',
        'witchNoKill',

        'skipConfirm',
        'confirmTrigger',
      ]);
    });
  });
});
