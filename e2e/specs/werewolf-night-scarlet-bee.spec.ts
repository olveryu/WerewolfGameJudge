import { TemplateCategory } from '@game-judge/game-engine/games/werewolf/public';
import { expect, test } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import {
  clickNightButton,
  clickSeatAndConfirm,
  dismissAlert,
  driveWolfVote,
  findAllRolePageIndices,
  findRolePageIndex,
  viewLastNightInfo,
  waitForHostAudioAck,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { withSetup } from '../helpers/night-setup';
import { SheriffElectionPage } from '../pages/SheriffElectionPage';

test.setTimeout(300_000);

test.describe('Werewolf Night — Scarlet Bee', () => {
  test('publishes the scarlet child to every player through sheriff registration', async ({
    browser,
  }) => {
    await withSetup(
      browser,
      {
        playerCount: 12,
        isSheriffElectionEnabled: true,
        configure: async (config) => config.selectTemplate('猩红蜂舞', TemplateCategory.Advanced),
      },
      async ({ setup, pages, roleMap }) => {
        const scarletWolfKingPage = findRolePageIndex(roleMap, '猩红狼王');
        const guardPage = findRolePageIndex(roleMap, '守卫');
        const witchPage = findRolePageIndex(roleMap, '女巫');
        const seerPage = findRolePageIndex(roleMap, '预言家');
        const regularWolfPages = findAllRolePageIndices(roleMap, '狼人');
        const villagerPages = findAllRolePageIndices(roleMap, '平民').filter(
          (pageIndex) => roleMap.get(pageIndex)?.seat !== 0,
        );

        expect(scarletWolfKingPage).not.toBe(-1);
        expect(guardPage).not.toBe(-1);
        expect(witchPage).not.toBe(-1);
        expect(seerPage).not.toBe(-1);
        expect(regularWolfPages).toHaveLength(3);
        expect(findRolePageIndex(roleMap, '蜂之狂猎')).not.toBe(-1);
        expect(villagerPages.length).toBeGreaterThanOrEqual(3);

        const markedSeat = roleMap.get(villagerPages[0]!)!.seat;
        const attackedSeat = roleMap.get(villagerPages[1]!)!.seat;
        const publicMark = `猩红之子：${markedSeat + 1}号`;

        await test.step('Guard completes the first action', async () => {
          await waitForRoleTurn(pages[guardPage]!, 'guardProtect', pages);
          await clickSeatAndConfirm(pages[guardPage]!, attackedSeat);
        });

        await test.step('The ordinary wolf team attacks without the king', async () => {
          expect(regularWolfPages).not.toContain(scarletWolfKingPage);
          await driveWolfVote(pages, regularWolfPages, attackedSeat);
        });

        await test.step('Scarlet Wolf King marks a player', async () => {
          await waitForRoleTurn(pages[scarletWolfKingPage]!, 'scarletWolfKingMark', pages);
          await clickSeatAndConfirm(pages[scarletWolfKingPage]!, markedSeat);
        });

        await test.step('Witch acts before the seer and the mark remains private at night', async () => {
          await waitForRoleTurn(pages[witchPage]!, 'witchAction', pages);
          await expect(
            pages[villagerPages[2]!]!.getByTestId(TESTIDS.roomScreenRoot),
          ).not.toContainText('猩红之子：');
          await clickNightButton(pages[witchPage]!, 'skip', '不用技能');
          await waitForRoleTurn(pages[seerPage]!, 'seerCheck', pages);
          await clickNightButton(pages[seerPage]!, 'skip', '不用技能');
        });

        await test.step('Every player sees the actual marked seat at dawn', async () => {
          await waitForNightEnd(pages);
          await waitForHostAudioAck(setup.hostCommands);
          await Promise.all(
            pages.map((page) =>
              expect(page.getByTestId(TESTIDS.roomBoardStatus)).toContainText(publicMark),
            ),
          );
          expect(await viewLastNightInfo(setup.hostPage)).toContain(publicMark);
          await dismissAlert(setup.hostPage);
        });

        await test.step('The public mark stays visible when sheriff registration begins', async () => {
          const elections = pages.map((page) => new SheriffElectionPage(page));
          await Promise.all(elections.map((election) => election.waitForPhase('报名上警')));
          await elections[0]!.register();
          await elections[villagerPages[2]!]!.register();
          await Promise.all(
            pages.map((page) =>
              expect(page.getByTestId(TESTIDS.roomBoardStatus)).toContainText(publicMark),
            ),
          );
          await elections[0]!.endRegistration();
          await Promise.all(elections.map((election) => election.waitForPhase('竞选发言')));
          await Promise.all(
            pages.map((page) =>
              expect(page.getByTestId(TESTIDS.roomBoardStatus)).toContainText(publicMark),
            ),
          );
        });
      },
    );
  });
});
