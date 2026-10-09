import { expect, test } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { enterRoomCodeViaNumPad } from '../helpers/home';
import { waitForRoomScreenReady } from '../helpers/waits';
import { HomePage } from '../pages/HomePage';
import { RoomPage } from '../pages/RoomPage';

/** The Avalon room screen sits behind the same temporary lock as the
 * config screen; every participant unlocks it once per app session. */
async function unlockAvalon(page: import('@playwright/test').Page): Promise<void> {
  await page.getByPlaceholder('密码').fill('369');
  await page.getByTestId(TESTIDS.alertButton(1)).click();
}

test.setTimeout(300_000);

/**
 * Identity Viewing Protocol (P-1 batch C): the first Avalon quest must
 * not start until every human has viewed their role card. Five real
 * players (no bots): four view their cards, the night information
 * steps complete, and the game must hold at the checkpoint — the
 * status ribbon names the missing view — until the last player views.
 */
test('Avalon first quest waits until every human viewed their role', async ({ browser }) => {
  const fixture = await createPlayerContexts(browser, 5);
  const [hostPage, ...joinerPages] = fixture.pages;
  const allPages = [hostPage, ...joinerPages];
  for (const page of allPages) await page.setViewportSize({ width: 1280, height: 900 });
  const hostRoom = new RoomPage(hostPage);
  const joinerRooms = joinerPages.map((page) => new RoomPage(page));
  const lateViewer = allPages[4]!;
  try {
    await new HomePage(hostPage).clickCreateRoom('avalon');
    // Avalon is behind its temporary access lock: enter the password.
    await unlockAvalon(hostPage);
    // Player count is a stepper (default 6); step it to 5. The veto
    // stepper below shares the button labels, so take the first one.
    const countDisplay = hostPage.getByTestId('avalon-player-count');
    for (let i = 0; i < 5 && (await countDisplay.textContent()) !== '5'; i += 1) {
      const current = Number(await countDisplay.textContent());
      await hostPage
        .getByRole('button', { name: current > 5 ? '减少人数' : '增加人数' })
        .first()
        .click();
    }
    await expect(countDisplay).toHaveText('5');
    await hostPage.getByTestId('avalon-config-submit').click();
    await hostRoom.waitForReady('host');

    // Five real players take seats; no bots involved. Joining composes
    // the generic join steps with the Avalon lock: the room screen
    // only becomes ready after this participant unlocks it.
    const roomCode = await hostRoom.getRoomCode();
    await hostRoom.seatAt(0);
    for (let i = 0; i < joinerRooms.length; i += 1) {
      const joinerPage = joinerPages[i]!;
      await joinerPage.getByTestId(TESTIDS.homeEnterRoomButton).click();
      await expect(joinerPage.getByText('加入房间', { exact: true })).toBeVisible();
      await enterRoomCodeViaNumPad(joinerPage, roomCode);
      await joinerPage.getByText('加入', { exact: true }).click();
      await unlockAvalon(joinerPage);
      await waitForRoomScreenReady(joinerPage, { role: 'joiner' });
      await joinerRooms[i]!.seatAt(i + 1);
    }
    await expect(hostPage.getByText('等待入座 · 5/5', { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await hostRoom.openHostManagement();
    await hostPage.getByTestId('avalon-start').click();

    // Everyone except the last player views their role card
    // (opening the card is what records the view server-side).
    for (const page of allPages.slice(0, 4)) {
      await page.getByTestId('avalon-view-role').click();
      await expect(page.getByRole('button', { name: '知道了', exact: true })).toBeVisible();
      await page.getByRole('button', { name: '知道了', exact: true }).click();
    }

    // Drive the night information steps: whichever participant's
    // confirm action is enabled confirms through the modal. The
    // late viewer confirms information too — confirming is not
    // viewing; only the role card records a view.
    const checkpointHint = hostPage.getByText('等待全员查看身份 · 还差 1 人', { exact: true });
    for (let round = 0; round < 60; round += 1) {
      if (await checkpointHint.isVisible().catch(() => false)) break;
      for (const page of allPages) {
        const action = page.getByTestId('avalon-night-info');
        if (
          (await action.isVisible().catch(() => false)) &&
          (await action.isEnabled().catch(() => false))
        ) {
          await action.click();
          const confirm = page.getByTestId(TESTIDS.alertButton(0));
          await expect(confirm).toBeVisible();
          await confirm.click();
        }
      }
      await hostPage.waitForTimeout(1_000);
    }
    // The night steps are done, but the checkpoint holds the game.
    await expect(checkpointHint).toBeVisible({ timeout: 15_000 });
    await expect(hostPage.getByText(/第 1 轮 · 队长组队中/)).toHaveCount(0);

    // The last view releases the checkpoint; the first quest begins.
    await lateViewer.getByTestId('avalon-view-role').click();
    await expect(lateViewer.getByRole('button', { name: '知道了', exact: true })).toBeVisible();
    await lateViewer.getByRole('button', { name: '知道了', exact: true }).click();
    await expect(hostPage.getByText(/第 1 轮 · 队长组队中/)).toBeVisible({ timeout: 30_000 });
  } finally {
    await closeAll(fixture);
  }
});
