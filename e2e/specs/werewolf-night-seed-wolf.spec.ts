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
          await test.step('Wolf vote should become active', () =>
            waitForRoleTurn(pages[seedWolfPageIndex]!, 'wolfKill', pages));
          await driveWolfVote(pages, wolfPageIndices, infectionTargetSeat);
        });

        await test.step('seed wolf confirms infection', async () => {
          await test.step('Seed Wolf infection turn should become active', () =>
            waitForRoleTurn(pages[seedWolfPageIndex]!, 'seedWolfInfect', pages));

          await dismissAlert(pages[seedWolfPageIndex]!);
          await clickNightButton(pages[seedWolfPageIndex]!, 'confirm', '感染');

          const confirmation = await readAlertText(pages[seedWolfPageIndex]!);
          expect(confirmation).toContain(`${infectionTargetSeat + 1}号`);
          const infectButton = pages[seedWolfPageIndex]!.getByTestId(TESTIDS.alertButton(1));
          await expect(infectButton).toHaveText('感染');
          await infectButton.click();
        });

        await test.step('seer finishes the last ordinary role action', async () => {
          await test.step('Seer turn should become active', () =>
            waitForRoleTurn(pages[seerPageIndex]!, 'seerCheck', pages));
          await dismissAlert(pages[seerPageIndex]!);
          await clickNightButton(pages[seerPageIndex]!, 'skip', '不用技能');
          await expect(pages[seerPageIndex]!.getByTestId(TESTIDS.alertModal)).toBeVisible({
            timeout: 5000,
          });
          await dismissAlert(pages[seerPageIndex]!);
        });

        await test.step('every player acknowledges the final infection result', async () => {
          await test.step('Final infection reveal should become active', () =>
            waitForGroupConfirmStep(pages, '感染状态'));

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
          await test.step('Night should end only after the final acknowledgements', () =>
            waitForNightEnd(pages));

          expect(await viewLastNightInfo(pages[0]!)).toContain('平安夜');
        });
      },
    );
  });
});
