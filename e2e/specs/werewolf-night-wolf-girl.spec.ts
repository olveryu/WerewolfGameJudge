import { TemplateCategory } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { expect, type Page, test } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { readAlertText } from '../helpers/alerts';
import {
  clickNightButton,
  clickSeatAndConfirm,
  dismissAlert,
  driveGroupConfirmAck,
  driveWolfDisabledEmptyVote,
  findAllRolePageIndices,
  findRolePageIndex,
  readRoomStep,
  viewLastNightInfo,
  waitForGroupConfirmStep,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { withSetup } from '../helpers/night-setup';

/**
 * Night Roles E2E — Wolf Girl confession (狼女孩).
 *
 * Board: 狼女孩 preset (Special, 12 players: 4 villagers, 3 wolves,
 * wolfGirl, seer, poisoner, hunter, guard).
 * Night order: guardProtect -> wolfGirlConfess -> wolfKill ->
 * poisonerPoison -> hunterConfirm -> seerCheck -> wolfGirlConfessReveal.
 *
 * Verifies: the Wolf Girl sees her wolf teammates during the confess
 * step (wolf seats are not confessable, a civilian seat is), the wolf
 * vote runs empty under the poisoner override, the seer still reads a
 * confessed civilian as good, and the last-step reveal tells each
 * player only what their role entitles them to know — the confessed
 * civilian learns the Wolf Girl's seat, a confessed god learns only
 * that they were confessed, everyone else learns nothing.
 */

// Full 12-player night: setup alone (12 contexts, room creation,
// seat assignment, role viewing) takes ~2 minutes in CI, and the
// night itself runs seven steps with per-step audio plus a 12-page
// reveal. The 300s budget follows werewolf-night-flow, the other
// full-night spec; 180s is exhausted before the night can finish
// (run 41577067173: both tests killed at exactly 3.0m while still
// mid-night, step 4/7 in the failure snapshots).
test.setTimeout(300_000);

/**
 * A wolf seat must not be confessable: tapping it during the Wolf
 * Girl's confess step opens no "确认表白" dialog and does not move
 * the night step. The tap may surface a disabled-reason notice or
 * nothing at all; either way the step must stay put. The open step
 * prompt is dismissed first so the tap reaches the seat.
 */
async function expectWolfSeatNotConfessable(page: Page, seat: number): Promise<void> {
  const stepBefore = await readRoomStep(page);
  await dismissAlert(page);
  await page.getByTestId(TESTIDS.seatTilePressable(seat)).click({ timeout: 10_000 });
  await page.waitForTimeout(300);

  const alertTitle = page.getByTestId(TESTIDS.alertTitle);
  const alertTitleText = (await alertTitle.count()) > 0 ? await alertTitle.textContent() : '';
  expect(alertTitleText, 'No confess confirm dialog for a wolf seat').not.toContain('确认表白');
  expect(await readRoomStep(page), 'Night step must not move after tapping a wolf seat').toBe(
    stepBefore,
  );
  await dismissAlert(page);
}

async function driveGuardProtect(
  pages: Page[],
  guardPageIndex: number,
  protectSeat: number,
): Promise<void> {
  const guardTurn = await waitForRoleTurn(pages[guardPageIndex]!, 'guardProtect', pages);
  expect(guardTurn, 'Guard turn should become active').toBe(true);
  const confirmed = await clickSeatAndConfirm(pages[guardPageIndex]!, protectSeat);
  expect(confirmed, 'Guard should confirm protection').toBe(true);
}

async function drivePostConfessNight(
  pages: Page[],
  wolfPageIndices: number[],
  poisonerPageIndex: number,
  hunterPageIndex: number,
  seerPageIndex: number,
  seerCheckSeat: number,
): Promise<void> {
  await test.step('wolves confirm they cannot kill (poisoner override)', async () => {
    // waitForRoleTurn first: it advances the other pages past their
    // pending prompts and waits out the step's audio/prompt cycle, so
    // the confirm button is actually rendered when the driver looks
    // for it. The override renders "确认放弃袭击", not the plain
    // "放弃袭击" button driveWolfEmptyVote clicks.
    const wolfTurn = await waitForRoleTurn(pages[wolfPageIndices[0]!]!, 'wolfKill', pages);
    expect(wolfTurn, 'Wolf turn should become active').toBe(true);
    await driveWolfDisabledEmptyVote(pages, wolfPageIndices);
  });

  await test.step('poisoner skips the poison', async () => {
    const poisonerTurn = await waitForRoleTurn(pages[poisonerPageIndex]!, 'poisonerPoison', pages);
    expect(poisonerTurn, 'Poisoner turn should become active').toBe(true);
    await dismissAlert(pages[poisonerPageIndex]!);
    await clickNightButton(pages[poisonerPageIndex]!, 'skip', '不用技能');
    await dismissAlert(pages[poisonerPageIndex]!);
  });

  await test.step('hunter confirms shoot status', async () => {
    const hunterTurn = await waitForRoleTurn(pages[hunterPageIndex]!, 'hunterConfirm', pages);
    expect(hunterTurn, 'Hunter turn should become active').toBe(true);
    await dismissAlert(pages[hunterPageIndex]!);
    await clickNightButton(pages[hunterPageIndex]!, 'confirm', '发动状态');
    const alertText = await readAlertText(pages[hunterPageIndex]!);
    expect(alertText).toContain('猎人');
    expect(alertText).toMatch(/可以发动技能|不能发动技能/);
    await dismissAlert(pages[hunterPageIndex]!);
  });

  await test.step('seer checks the target and reads good', async () => {
    const seerTurn = await waitForRoleTurn(pages[seerPageIndex]!, 'seerCheck', pages);
    expect(seerTurn, 'Seer turn should become active').toBe(true);
    const checked = await clickSeatAndConfirm(pages[seerPageIndex]!, seerCheckSeat);
    expect(checked, 'Seer should confirm the check').toBe(true);
    const revealText = await readAlertText(pages[seerPageIndex]!);
    expect(revealText).toContain(formatSeat(seerCheckSeat));
    expect(revealText).toContain('好人');
    await dismissAlert(pages[seerPageIndex]!);
  });
}

test.describe('Werewolf Night — Wolf Girl (狼女孩)', () => {
  test('confess civilian: pack visible in confess step, reveal discloses Wolf Girl seat only to the confessed civilian', async ({
    browser,
  }) => {
    await withSetup(
      browser,
      {
        playerCount: 12,
        configure: async (config) => config.selectTemplate('狼女孩', TemplateCategory.Special),
      },
      async ({ pages, roleMap }) => {
        const wolfGirlPageIndex = findRolePageIndex(roleMap, '狼女孩');
        const seerPageIndex = findRolePageIndex(roleMap, '预言家');
        const poisonerPageIndex = findRolePageIndex(roleMap, '毒师');
        const hunterPageIndex = findRolePageIndex(roleMap, '猎人');
        const guardPageIndex = findRolePageIndex(roleMap, '守卫');
        const wolfPageIndices = findAllRolePageIndices(roleMap, '狼人');
        const villagerPageIndices = findAllRolePageIndices(roleMap, '平民');

        expect(wolfGirlPageIndex).not.toBe(-1);
        expect(seerPageIndex).not.toBe(-1);
        expect(poisonerPageIndex).not.toBe(-1);
        expect(hunterPageIndex).not.toBe(-1);
        expect(guardPageIndex).not.toBe(-1);
        expect(wolfPageIndices).toHaveLength(3);
        expect(villagerPageIndices).toHaveLength(4);

        const wolfGirlSeat = roleMap.get(wolfGirlPageIndex)!.seat;
        const seerSeat = roleMap.get(seerPageIndex)!.seat;
        const confessTargetPageIndex = villagerPageIndices[0]!;
        const confessTargetSeat = roleMap.get(confessTargetPageIndex)!.seat;
        const wolfSeats = wolfPageIndices.map((index) => roleMap.get(index)!.seat);
        const votePageIndices = [...wolfPageIndices, wolfGirlPageIndex];

        await test.step('guard protects the seer', async () => {
          await driveGuardProtect(pages, guardPageIndex, seerSeat);
        });

        await test.step('wolf girl sees the pack and confesses a civilian', async () => {
          const confessTurn = await waitForRoleTurn(
            pages[wolfGirlPageIndex]!,
            'wolfGirlConfess',
            pages,
          );
          expect(confessTurn, 'Wolf Girl confess turn should become active').toBe(true);

          await expect(
            pages[wolfGirlPageIndex]!.getByTestId(TESTIDS.alertMessage),
            'Confess step prompt should show the 表白 verb',
          ).toContainText('请选择要表白的玩家');

          await expectWolfSeatNotConfessable(pages[wolfGirlPageIndex]!, wolfSeats[0]!);

          const confirmed = await clickSeatAndConfirm(pages[wolfGirlPageIndex]!, confessTargetSeat);
          expect(confirmed, 'Wolf Girl should confirm the confession').toBe(true);
        });

        await drivePostConfessNight(
          pages,
          votePageIndices,
          poisonerPageIndex,
          hunterPageIndex,
          seerPageIndex,
          confessTargetSeat,
        );

        await test.step('every player acknowledges the confession reveal', async () => {
          const revealReady = await waitForGroupConfirmStep(pages, '表白状态', 120);
          expect(revealReady, 'Confession reveal should become active last').toBe(true);

          let disclosedSeatCount = 0;
          for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            const player = roleMap.get(pageIndex);
            if (!player) throw new Error(`Missing captured role for page ${pageIndex}`);

            const message = await driveGroupConfirmAck(pages[pageIndex]!, '表白状态', '知道了');
            if (player.seat === confessTargetSeat) {
              expect(message).toContain(`狼女孩是：${formatSeat(wolfGirlSeat)}`);
              disclosedSeatCount++;
            } else {
              expect(message).not.toContain('狼女孩是：');
              expect(message).toContain('你未被表白');
            }
          }
          expect(disclosedSeatCount).toBe(1);
        });

        await test.step('night ends peacefully after all acknowledgements', async () => {
          const ended = await waitForNightEnd(pages);
          expect(ended, 'Night should end only after the final acknowledgements').toBe(true);

          await viewLastNightInfo(pages[0]!);
          expect(await readAlertText(pages[0]!)).toContain('平安夜');
        });
      },
    );
  });

  test('confess god: reveal tells the god only that they were confessed, never the Wolf Girl seat', async ({
    browser,
  }) => {
    await withSetup(
      browser,
      {
        playerCount: 12,
        configure: async (config) => config.selectTemplate('狼女孩', TemplateCategory.Special),
      },
      async ({ pages, roleMap }) => {
        const wolfGirlPageIndex = findRolePageIndex(roleMap, '狼女孩');
        const seerPageIndex = findRolePageIndex(roleMap, '预言家');
        const poisonerPageIndex = findRolePageIndex(roleMap, '毒师');
        const hunterPageIndex = findRolePageIndex(roleMap, '猎人');
        const guardPageIndex = findRolePageIndex(roleMap, '守卫');
        const wolfPageIndices = findAllRolePageIndices(roleMap, '狼人');
        const villagerPageIndices = findAllRolePageIndices(roleMap, '平民');

        expect(wolfGirlPageIndex).not.toBe(-1);
        expect(seerPageIndex).not.toBe(-1);
        expect(poisonerPageIndex).not.toBe(-1);
        expect(hunterPageIndex).not.toBe(-1);
        expect(guardPageIndex).not.toBe(-1);
        expect(wolfPageIndices).toHaveLength(3);
        expect(villagerPageIndices).toHaveLength(4);

        const seerSeat = roleMap.get(seerPageIndex)!.seat;
        const villagerSeat = roleMap.get(villagerPageIndices[0]!)!.seat;
        const wolfSeats = wolfPageIndices.map((index) => roleMap.get(index)!.seat);
        const votePageIndices = [...wolfPageIndices, wolfGirlPageIndex];

        await test.step('guard protects a villager', async () => {
          await driveGuardProtect(pages, guardPageIndex, villagerSeat);
        });

        await test.step('wolf girl confesses the seer', async () => {
          const confessTurn = await waitForRoleTurn(
            pages[wolfGirlPageIndex]!,
            'wolfGirlConfess',
            pages,
          );
          expect(confessTurn, 'Wolf Girl confess turn should become active').toBe(true);

          await expectWolfSeatNotConfessable(pages[wolfGirlPageIndex]!, wolfSeats[0]!);

          const confirmed = await clickSeatAndConfirm(pages[wolfGirlPageIndex]!, seerSeat);
          expect(confirmed, 'Wolf Girl should confirm the confession').toBe(true);
        });

        await drivePostConfessNight(
          pages,
          votePageIndices,
          poisonerPageIndex,
          hunterPageIndex,
          seerPageIndex,
          villagerSeat,
        );

        await test.step('every player acknowledges the confession reveal', async () => {
          const revealReady = await waitForGroupConfirmStep(pages, '表白状态', 120);
          expect(revealReady, 'Confession reveal should become active last').toBe(true);

          for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            const player = roleMap.get(pageIndex);
            if (!player) throw new Error(`Missing captured role for page ${pageIndex}`);

            const message = await driveGroupConfirmAck(pages[pageIndex]!, '表白状态', '知道了');
            expect(message).not.toContain('狼女孩是：');
            if (player.seat === seerSeat) {
              expect(message).toContain('你被表白了');
            } else {
              expect(message).toContain('你未被表白');
            }
          }
        });

        await test.step('night ends peacefully after all acknowledgements', async () => {
          const ended = await waitForNightEnd(pages);
          expect(ended, 'Night should end only after the final acknowledgements').toBe(true);

          await viewLastNightInfo(pages[0]!);
          expect(await readAlertText(pages[0]!)).toContain('平安夜');
        });
      },
    );
  });
});
