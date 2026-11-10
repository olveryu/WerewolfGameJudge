import { expect, test } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { readAlertText } from '../helpers/alerts';
import {
  clickNightButton,
  dismissAlert,
  driveGroupConfirmAck,
  driveWolfVote,
  findAllRolePageIndices,
  findRolePageIndex,
  viewLastNightInfo,
  waitForGroupConfirmStep,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { withSetup } from '../helpers/night-setup';

/**
 * Night Roles E2E — Seed Wolf infection.
 *
 * Night order: wolfKill -> seedWolfInfect -> seerCheck -> seedWolfInfectReveal.
 * Verifies successful conversion, personal final results, all-player acknowledgement,
 * and cancellation of the converted target's wolf-kill death.
 */

test.setTimeout(180_000);

test.describe('Werewolf Night — Seed Wolf (种狼)', () => {
  test('successful infection reveals to all players and cancels wolf-kill death', async ({
    browser,
  }) => {
    await withSetup(
      browser,
      {
        playerCount: 5,
        configure: async (config) =>
          config.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            goodRoles: ['seer'],
            wolfRoles: ['seedWolf'],
          }),
      },
      async ({ pages, roleMap }) => {
        const seedWolfPageIndex = findRolePageIndex(roleMap, '种狼');
        const seerPageIndex = findRolePageIndex(roleMap, '预言家');
        const villagerPageIndices = findAllRolePageIndices(roleMap, '平民');
        const ordinaryWolfPageIndices = findAllRolePageIndices(roleMap, '狼人');

        expect(seedWolfPageIndex).not.toBe(-1);
        expect(seerPageIndex).not.toBe(-1);
        expect(villagerPageIndices).toHaveLength(2);
        expect(ordinaryWolfPageIndices).toHaveLength(1);

        const infectionTargetPageIndex = villagerPageIndices[0]!;
        const infectionTargetSeat = roleMap.get(infectionTargetPageIndex)!.seat;
        const wolfPageIndices = [...ordinaryWolfPageIndices, seedWolfPageIndex];

        await test.step('wolves select the infection target', async () => {
          const wolfTurn = await waitForRoleTurn(pages[seedWolfPageIndex]!, 'wolfKill', pages);
          expect(wolfTurn, 'Wolf vote should become active').toBe(true);
          await driveWolfVote(pages, wolfPageIndices, infectionTargetSeat);
        });

        await test.step('seed wolf confirms infection', async () => {
          const infectionTurn = await waitForRoleTurn(
            pages[seedWolfPageIndex]!,
            'seedWolfInfect',
            pages,
          );
          expect(infectionTurn, 'Seed Wolf infection turn should become active').toBe(true);

          await dismissAlert(pages[seedWolfPageIndex]!);
          await clickNightButton(pages[seedWolfPageIndex]!, 'confirm', '感染');

          const confirmation = await readAlertText(pages[seedWolfPageIndex]!);
          expect(confirmation).toContain(`${infectionTargetSeat + 1}号`);
          const infectButton = pages[seedWolfPageIndex]!.getByTestId(TESTIDS.alertButton(1));
          await expect(infectButton).toHaveText('感染');
          await infectButton.click();
        });

        await test.step('seer finishes the last ordinary role action', async () => {
          const seerTurn = await waitForRoleTurn(pages[seerPageIndex]!, 'seerCheck', pages);
          expect(seerTurn, 'Seer turn should become active').toBe(true);
          await dismissAlert(pages[seerPageIndex]!);
          await clickNightButton(pages[seerPageIndex]!, 'skip', '不用技能');
          await expect(pages[seerPageIndex]!.getByTestId(TESTIDS.alertModal)).toBeVisible({
            timeout: 5000,
          });
          await dismissAlert(pages[seerPageIndex]!);
        });

        await test.step('every player acknowledges the final infection result', async () => {
          const revealReady = await waitForGroupConfirmStep(pages, '感染状态');
          expect(revealReady, 'Final infection reveal should become active').toBe(true);

          let convertedMessageCount = 0;
          for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            const player = roleMap.get(pageIndex);
            if (!player) throw new Error(`Missing captured role for page ${pageIndex}`);

            const message = await driveGroupConfirmAck(pages[pageIndex]!, '感染状态', '知道了');
            if (player.seat === infectionTargetSeat) {
              expect(message).toContain('你已被种狼感染并转化为普通狼人');
              convertedMessageCount++;
            } else {
              expect(message).toContain('你未被感染');
            }
          }
          expect(convertedMessageCount).toBe(1);
        });

        await test.step('night ends peacefully after all acknowledgements', async () => {
          const ended = await waitForNightEnd(pages);
          expect(ended, 'Night should end only after the final acknowledgements').toBe(true);

          expect(await viewLastNightInfo(pages[0]!)).toContain('平安夜');
        });
      },
    );
  });
});
