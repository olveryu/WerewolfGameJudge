import { expect, type Page, test } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { confirmAlert, pressAlertButton } from '../helpers/alerts';
import {
  closeReviewDialog,
  downloadReviewImage,
  REVIEW_CAPTURE_TIMEOUT_MS,
} from '../helpers/image-sharing';
import { HomePage } from '../pages/HomePage';
import { RoomPage } from '../pages/RoomPage';

test.setTimeout(300_000);

const VIEWING_PROGRESS_PATTERN = /^\d+\/6 位玩家已查看词卡，等待剩余玩家$/;

/** Dismiss the open word card through its 「隐藏词卡」 confirm button. */
async function hideWordCard(page: Page): Promise<void> {
  const hideButton = page.getByTestId(TESTIDS.roleCardConfirmButton);
  await expect(hideButton).toHaveText('隐藏词卡');
  await hideButton.click();
  await expect(page.getByTestId(TESTIDS.undercoverWord)).toHaveCount(0);
}

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
]) {
  test(`Undercover offline reveal and blank victory at ${viewport.width}px`, async ({
    browser,
  }, testInfo) => {
    const fixture = await createPlayerContexts(browser, 6);
    const [hostPage, ...joinerPages] = fixture.pages;
    for (const page of fixture.pages) await page.setViewportSize(viewport);
    const hostRoom = new RoomPage(hostPage);
    const joinerRooms = joinerPages.map((page) => new RoomPage(page));
    const allPages = [hostPage, ...joinerPages];
    try {
      await new HomePage(hostPage).clickCreateRoom('undercover');
      // 分类来自线上词库 inventory：e2e 词库只有部分分类，schema 全集里的其余分类不可选。
      const foodCategory = hostPage.getByTestId(
        TESTIDS.gameConfigFieldOption('undercover', 'category', 'food'),
      );
      await expect(foodCategory).toBeVisible();
      await expect(foodCategory).toHaveAccessibleName('吃喝美食');
      await expect(
        hostPage.getByTestId(TESTIDS.gameConfigFieldOption('undercover', 'category', 'nature')),
      ).toHaveCount(0);
      const playerCount = hostPage.getByTestId(
        TESTIDS.gameConfigField('undercover', 'numberOfPlayers'),
      );
      await playerCount.fill('6');
      await expect(playerCount).toHaveValue('6');
      const blankSwitch = hostPage.getByTestId(TESTIDS.gameConfigField('undercover', 'hasBlank'));
      await expect(blankSwitch).toHaveAccessibleName('白板');
      await blankSwitch.click();
      await expect(
        hostPage.getByTestId(TESTIDS.gameConfigScreenRoot('undercover')),
      ).not.toContainText('测试模式');
      await hostPage.getByTestId(TESTIDS.gameConfigSubmit('undercover')).click();
      await hostRoom.waitForReady('host');
      const guideButton = hostPage.getByTestId(TESTIDS.roomGuideButton('undercover'));
      await expect(guideButton).toHaveAccessibleName('查看谁是卧底玩法说明');
      await expect(guideButton).toBeInViewport();
      await hostPage.screenshot({
        path: testInfo.outputPath(`undercover-lobby-${viewport.width}.png`),
      });
      await guideButton.click();
      await expect(hostPage.getByTestId(TESTIDS.gameGuideScreenRoot('undercover'))).toContainText(
        '三个身份',
      );
      expect(
        await hostPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await hostPage.screenshot({
        path: testInfo.outputPath(`undercover-guide-${viewport.width}.png`),
      });
      const guideBack = hostPage.getByTestId(TESTIDS.gameGuideBackButton);
      await expect(guideBack).toHaveAccessibleName('返回');
      await guideBack.click();
      await hostRoom.waitForReady('host');

      // Six real players take seats; no bots involved.
      const roomCode = await hostRoom.getRoomCode();
      await hostRoom.expectNotSeated();
      await hostRoom.seatAt(0);
      for (let i = 0; i < joinerRooms.length; i += 1) {
        await joinerRooms[i]!.joinViaCode(roomCode);
        await joinerRooms[i]!.seatAt(i + 1);
      }
      await expect(hostPage.getByTestId(TESTIDS.roomNextStepButton)).toHaveAccessibleName(
        '分配角色',
        { timeout: 15_000 },
      );

      // Clearing seats unseats everyone but keeps them in the room; all six re-seat.
      await hostRoom.openHostManagement();
      await hostPage.getByTestId(TESTIDS.roomClearSeatsButton).click();
      // Destructive alert has [Cancel, 清空座位]; the confirm is alert-button-1.
      await hostPage.getByTestId(TESTIDS.alertButton(1)).click();
      await expect(hostPage.getByTestId(TESTIDS.roomNextStepBlockedReason)).toHaveText(
        '座位尚未坐满（还差 6 人）',
      );
      await hostRoom.seatAt(0);
      for (let i = 0; i < joinerRooms.length; i += 1) {
        await joinerRooms[i]!.seatAt(i + 1);
      }
      await expect(hostPage.getByTestId(TESTIDS.roomNextStepButton)).toHaveAccessibleName(
        '分配角色',
        { timeout: 15_000 },
      );
      // PR-B G-7: seated non-host players see the shared lobby wait in
      // the bottom panel while the host has not started the game.
      await expect(joinerPages[0]!.getByTestId(TESTIDS.actionMessage)).toHaveText(
        '等待房主开始游戏',
      );

      await hostRoom.openHostManagement();
      await hostPage.getByTestId(TESTIDS.assignRolesButton).click();
      await hostRoom.confirmHostActionDialog('分配角色？');
      await expect(hostPage.getByTestId(TESTIDS.roomViewIdentityButton)).toBeVisible();
      await expect(hostPage.getByTestId(TESTIDS.undercoverWord)).toHaveCount(0);
      // Every real player views their own word card on their own page.
      const cards: string[] = [];
      for (const page of allPages) {
        await page.getByTestId(TESTIDS.roomViewIdentityButton).click();
        cards.push(await page.getByTestId(TESTIDS.undercoverWord).innerText());
        await hideWordCard(page);
      }
      expect(cards.filter((word) => word === '你是白板')).toHaveLength(1);
      // Five players confirm first, then the host confirms last.
      for (const page of joinerPages) {
        await page.getByTestId(TESTIDS.roomViewIdentityButton).click();
        await page.getByTestId(TESTIDS.undercoverConfirm).click();
      }
      await expect(hostPage.getByTestId(TESTIDS.roomNextStepBlockedReason)).toHaveText(
        VIEWING_PROGRESS_PATTERN,
      );
      await hostPage.getByTestId(TESTIDS.roomViewIdentityButton).click();
      await hostPage.getByTestId(TESTIDS.undercoverConfirm).click();
      await expect(hostPage.getByTestId(TESTIDS.roomNextStepButton)).toHaveAccessibleName(
        '开始游戏',
      );
      await hostRoom.openHostManagement();
      await hostPage.getByTestId(TESTIDS.startGameButton).click();
      await hostRoom.confirmHostActionDialog('开始游戏？');
      // PR-B G-1: the speaking order is resident in the bottom panel
      // for everyone once the round is ongoing (server round state).
      const speakingOrder = hostPage.getByTestId(TESTIDS.actionMessage);
      await expect(speakingOrder).toHaveText(/^本轮从 \d+ 号起按座位顺序发言$/);
      const speakingOrderText = await speakingOrder.innerText();
      await expect(joinerPages[0]!.getByTestId(TESTIDS.actionMessage)).toHaveText(
        speakingOrderText,
      );
      await expect(
        (await hostRoom.openHostManagement()).getByTestId(TESTIDS.undercoverSelectPlayer),
      ).toBeVisible();
      await hostRoom.closeHostManagement();
      await hostPage.getByTestId(TESTIDS.roomViewIdentityButton).click();
      await expect(hostPage.getByTestId(TESTIDS.undercoverWord)).toHaveText(cards[0]!);
      await hostPage.reload();
      await hostRoom.waitForReady('host');
      // Reload consistency: the same speaking order sentence is still
      // there, derived from the same server round after a fresh load.
      await expect(hostPage.getByTestId(TESTIDS.actionMessage)).toHaveText(speakingOrderText);
      await expect(hostPage.getByTestId(TESTIDS.undercoverWord)).toHaveCount(0);
      await hostPage.screenshot({
        path: testInfo.outputPath(`undercover-speaking-${viewport.width}.png`),
      });
      const civilians = cards
        .map((word, seat) => ({ word, seat }))
        .filter(
          ({ word }) => word !== '你是白板' && cards.filter((other) => other === word).length > 1,
        );
      expect(civilians).toHaveLength(4);
      for (const [eliminatedIndex, { seat }] of civilians.entries()) {
        await hostRoom.openHostManagement();
        await hostPage.getByTestId(TESTIDS.undercoverSelectPlayer).click();
        if (seat !== civilians[0]!.seat) {
          await hostRoom.getSeatTile(civilians[0]!.seat).click();
          await expect(hostPage.getByTestId(TESTIDS.undercoverRevealModal)).toHaveCount(0);
        }
        await hostRoom.getSeatTile(seat).click();
        const modal = hostPage.getByTestId(TESTIDS.undercoverRevealModal);
        await expect(modal).toBeVisible();
        await expect(hostPage.getByTestId(TESTIDS.undercoverRevealSeat)).toHaveText(
          `${seat + 1} 号`,
        );
        await expect(hostPage.getByTestId(TESTIDS.undercoverRevealPlayer)).not.toBeEmpty();
        await expect(modal).not.toContainText(/平民|卧底|白板/);
        if (seat === civilians[0]!.seat) {
          await hostPage.getByTestId(TESTIDS.undercoverRevealCancel).click();
          await expect(modal).toHaveCount(0);
          await expect(hostPage.getByTestId(TESTIDS.roomHostTaskEscapeButton)).toHaveText(
            '取消选择',
          );
          await hostRoom.getSeatTile(seat).click();
          await expect(modal).toBeVisible();
          await expect(async () => {
            const bounds = await modal.boundingBox();
            if (bounds === null) throw new Error('Missing confirmation panel');
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
            if (viewport.width < 1100)
              expect(Math.abs(bounds.y + bounds.height - viewport.height)).toBeLessThan(2);
            else
              expect(Math.abs(bounds.y + bounds.height / 2 - viewport.height / 2)).toBeLessThan(2);
          }).toPass({ timeout: 5000 });
          await hostPage.screenshot({
            path: testInfo.outputPath(`undercover-confirm-${viewport.width}.png`),
            animations: 'disabled',
          });
          await hostPage.route(
            '**/room/command',
            async (route) => {
              await expect(hostPage.getByTestId(TESTIDS.undercoverReveal)).toBeDisabled();
              await expect(hostPage.getByTestId(TESTIDS.undercoverRevealCancel)).toBeDisabled();
              await route.continue();
            },
            { times: 1 },
          );
        }
        await hostPage.getByTestId(TESTIDS.undercoverReveal).click();
        await expect(modal).toHaveCount(0);
        // Revealed civilians read 「已出局 · 平民」; civilians still in play carry no label.
        for (const [index, civilian] of civilians.entries()) {
          const label = hostPage.getByTestId(TESTIDS.seatSecondaryLabel(civilian.seat));
          if (index <= eliminatedIndex) await expect(label).toHaveText('已出局 · 平民');
          else await expect(label).toHaveCount(0);
        }
        if (seat === 0 && civilians[civilians.length - 1]?.seat !== 0) {
          await hostPage.getByTestId(TESTIDS.roomViewIdentityButton).click();
          await expect(hostPage.getByTestId(TESTIDS.undercoverWord)).toHaveText(cards[0]!);
          await hideWordCard(hostPage);
        }
      }
      // The conclusion lives in the shared review （本局复盘）: a seated player
      // opens it from the bottom panel and exports the one-page report image.
      const reviewPage = joinerPages[0]!;
      await reviewPage.getByTestId(TESTIDS.roomReviewOpenButton).click();
      const reviewDialog = reviewPage.getByTestId(TESTIDS.roomReviewDialog);
      await expect(reviewDialog).toContainText('白板获胜');
      await expect(hostPage.getByTestId(TESTIDS.roomViewIdentityButton)).toHaveCount(0);
      const shareButton = reviewDialog.getByTestId(TESTIDS.roomReviewShareButton);
      // The control reads its share label once the background capture is ready.
      await expect(shareButton).toContainText('保存／分享图片', {
        timeout: REVIEW_CAPTURE_TIMEOUT_MS,
      });
      await downloadReviewImage(shareButton, `undercover-${roomCode}.png`);
      await closeReviewDialog(reviewPage);
      await expect(reviewDialog).toHaveCount(0);
      // Open the host panel once and reuse it: on narrow viewports the panel is a
      // modal sheet that covers the management entry button, so opening it again
      // while it is already open leaves Playwright retrying the entry click
      // until the test timeout.
      const endedManagement = await hostRoom.openHostManagement();
      await expect(endedManagement.getByTestId(TESTIDS.roomReviewHostAction)).toBeVisible();
      await expect(endedManagement.getByTestId(TESTIDS.nextRoundButton)).toBeVisible();
      await hostPage.screenshot({
        path: testInfo.outputPath(`undercover-ended-${viewport.width}.png`),
      });
      expect(
        await hostPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await endedManagement.getByTestId(TESTIDS.nextRoundButton).click();
      await hostRoom.confirmHostActionDialog('再来一局');
      await expect(hostPage.getByTestId(TESTIDS.roomNextStepBlockedReason)).toHaveText(
        VIEWING_PROGRESS_PATTERN,
      );
      // The review belongs to the concluded round: it is gone once the next one deals.
      await expect(reviewPage.getByTestId(TESTIDS.roomReviewOpenButton)).toHaveCount(0);
      for (const { seat } of civilians) {
        await expect(hostPage.getByTestId(TESTIDS.seatSecondaryLabel(seat))).toHaveCount(0);
      }
      // NB: do NOT open the host management panel here. On narrow viewports it
      // is a modal bottom sheet that covers the host's own view-word button,
      // hanging the first confirm click until the test timeout.
      for (const page of allPages) {
        await page.getByTestId(TESTIDS.roomViewIdentityButton).click();
        await page.getByTestId(TESTIDS.undercoverConfirm).click();
      }
      await hostRoom.openHostManagement();
      await hostPage.getByTestId(TESTIDS.startGameButton).click();
      await hostRoom.confirmHostActionDialog('开始游戏？');
      await expect(
        (await hostRoom.openHostManagement()).getByTestId(TESTIDS.undercoverSelectPlayer),
      ).toBeVisible();
      await hostRoom.closeHostManagement();
      await hostRoom.openHostManagement();
      await hostPage.getByTestId(TESTIDS.restartButton).click();
      await pressAlertButton(hostPage, {
        title: '重新开始？',
        buttonIndex: 0,
        buttonLabel: '取消',
      });
      await expect(
        (await hostRoom.openHostManagement()).getByTestId(TESTIDS.undercoverSelectPlayer),
      ).toBeVisible();
      await hostRoom.closeHostManagement();
      await hostRoom.openHostManagement();
      await hostPage.getByTestId(TESTIDS.restartButton).click();
      await confirmAlert(hostPage, '重新开始？');
      await expect(hostPage.getByTestId(TESTIDS.roomNextStepBlockedReason)).toHaveText(
        VIEWING_PROGRESS_PATTERN,
      );
      await hostRoom.openHostManagement();
      await hostPage.getByTestId(TESTIDS.abortGameButton).click();
      await confirmAlert(hostPage, '中止本局？');
      // PR-B G-7: the aborted conclusion lives in the bottom panel —
      // players get the conclusion plus the host wait, the host the
      // bare conclusion (their console holds the return action).
      await expect(joinerPages[0]!.getByTestId(TESTIDS.actionMessage)).toHaveText(
        '本局已中止，等待房主处理',
      );
      await expect(hostPage.getByTestId(TESTIDS.actionMessage)).toHaveText('本局已中止');
      // An abort after the deal still leaves a review of what play made public.
      await reviewPage.getByTestId(TESTIDS.roomReviewOpenButton).click();
      await expect(reviewDialog).toContainText('本局已中止');
      await expect(reviewDialog).toContainText('未完成');
      await closeReviewDialog(reviewPage);
      await expect(reviewDialog).toHaveCount(0);
      await hostRoom.openHostManagement();
      await hostPage.getByTestId(TESTIDS.returnLobbyButton).click();
      await hostRoom.confirmHostActionDialog('返回大厅');
      await expect(hostPage.getByTestId(TESTIDS.roomNextStepButton)).toHaveAccessibleName(
        '分配角色',
      );
    } finally {
      await closeAll(fixture);
    }
  });
}
