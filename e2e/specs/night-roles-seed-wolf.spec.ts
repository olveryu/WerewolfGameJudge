import { expect, type Page, test } from '@playwright/test';

import {
  clickBottomButton,
  dismissAlert,
  driveWolfVote,
  findAllRolePageIndices,
  findRolePageIndex,
  readAlertText,
  tryClickAdvanceButton,
  viewLastNightInfo,
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

async function waitForInfectionRevealStep(pages: Page[], maxIterations = 120): Promise<boolean> {
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    for (const page of pages) {
      const statusButton = page
        .locator('[data-testid="bottom-action-panel"]')
        .getByText('感染状态', { exact: true })
        .first();
      if (await statusButton.isVisible().catch(() => false)) return true;
    }

    for (const page of pages) {
      await tryClickAdvanceButton(page);
    }
    await pages[0]!.waitForTimeout(300);
  }
  return false;
}

async function acknowledgeInfectionResult(page: Page): Promise<string> {
  await dismissAlert(page);

  const statusButton = page
    .locator('[data-testid="bottom-action-panel"]')
    .getByText('感染状态', { exact: true })
    .first();
  await statusButton.waitFor({ state: 'visible', timeout: 10_000 });
  await statusButton.click();

  const alertModal = page.locator('[data-testid="alert-modal"]');
  await alertModal.waitFor({ state: 'visible', timeout: 5000 });
  const message = (await alertModal.textContent()) ?? '';
  await alertModal.getByText('知道了', { exact: true }).first().click();
  return message;
}

test.describe('Night Roles — Seed Wolf (种狼)', () => {
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
          const wolfTurn = await waitForRoleTurn(
            pages[seedWolfPageIndex]!,
            ['袭击', '选择'],
            pages,
            120,
          );
          expect(wolfTurn, 'Wolf vote should become active').toBe(true);
          await driveWolfVote(pages, wolfPageIndices, infectionTargetSeat);
        });

        await test.step('seed wolf confirms infection', async () => {
          const infectionTurn = await waitForRoleTurn(
            pages[seedWolfPageIndex]!,
            ['感染', '狼人袭击目标'],
            pages,
            120,
          );
          expect(infectionTurn, 'Seed Wolf infection turn should become active').toBe(true);

          await dismissAlert(pages[seedWolfPageIndex]!);
          const opened = await clickBottomButton(pages[seedWolfPageIndex]!, '感染');
          expect(opened, 'Seed Wolf infection button should be available').toBe(true);

          const confirmation = await readAlertText(pages[seedWolfPageIndex]!);
          expect(confirmation).toContain(`${infectionTargetSeat + 1}号`);
          await pages[seedWolfPageIndex]!.locator('[data-testid="alert-modal"]')
            .getByText('感染', { exact: true })
            .first()
            .click();
        });

        await test.step('seer finishes the last ordinary role action', async () => {
          const seerTurn = await waitForRoleTurn(
            pages[seerPageIndex]!,
            ['查验', '选择'],
            pages,
            120,
          );
          expect(seerTurn, 'Seer turn should become active').toBe(true);
          await dismissAlert(pages[seerPageIndex]!);
          const skipped = await clickBottomButton(pages[seerPageIndex]!, '不用技能');
          expect(skipped).toBe(true);
          await pages[seerPageIndex]!.locator('[data-testid="alert-modal"]').waitFor({
            state: 'visible',
            timeout: 5000,
          });
          await dismissAlert(pages[seerPageIndex]!);
        });

        await test.step('every player acknowledges the final infection result', async () => {
          const revealReady = await waitForInfectionRevealStep(pages);
          expect(revealReady, 'Final infection reveal should become active').toBe(true);

          let convertedMessageCount = 0;
          for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            const player = roleMap.get(pageIndex);
            if (!player) throw new Error(`Missing captured role for page ${pageIndex}`);

            const message = await acknowledgeInfectionResult(pages[pageIndex]!);
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
          const ended = await waitForNightEnd(pages, 120);
          expect(ended, 'Night should end only after the final acknowledgements').toBe(true);

          await viewLastNightInfo(pages[0]!);
          expect(await readAlertText(pages[0]!)).toContain('平安夜');
        });
      },
    );
  });
});
