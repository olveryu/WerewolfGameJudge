import { type BrowserContext, expect, type Page, test } from '@playwright/test';

import { type GameSetupWithRolesResult, setupNPlayerGameWithRoles } from '../helpers/multi-player';
import {
  clickSeatAndConfirm,
  driveWolfVote,
  findRolePageIndex,
  isTextVisible,
  viewLastNightInfo,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { dropRoomSockets, seatOfflineDot, setOffline, setPageHidden } from '../helpers/resilience';
import { linkStatusBanner, waitForLinkLive } from '../helpers/waits';

/**
 * RoomLink resilience during the werewolf night.
 *
 * Every scenario injects one fault on one player, then proves the link returns to
 * live (the not-live banner disappears) and the night still completes: guard
 * protects, wolf votes, night ends, result is shown. The 3-player board
 * (wolf + villager + guard) keeps the night short; the guard is the first wake-up
 * role so faults land before or during its turn.
 *
 * Faults: 5s offline (joiner / host), 30s offline, 5× online/offline flapping,
 * 30s in the background then foreground, and the server dropping every socket
 * (deploy simulation). Presence is asserted through the other players' seat dots.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);

interface NightCast {
  readonly setup: GameSetupWithRolesResult;
  readonly pages: Page[];
  readonly contexts: BrowserContext[];
  readonly guardIdx: number;
  readonly wolfIdx: number;
  readonly villagerIdx: number;
  /** A non-host page to fault (prefers the villager, who has no night turn). */
  readonly joinerIdx: number;
}

async function castNight(
  browser: Parameters<typeof setupNPlayerGameWithRoles>[0],
): Promise<NightCast> {
  const setup = await setupNPlayerGameWithRoles(browser, {
    playerCount: 3,
    configureTemplate: async (config) =>
      config.configureCustomTemplate({ wolves: 1, villagers: 1, goodRoles: ['guard'] }),
  });
  const { roleMap } = setup;
  const guardIdx = findRolePageIndex(roleMap, '守卫');
  const wolfIdx = findRolePageIndex(roleMap, '狼人');
  const villagerIdx = findRolePageIndex(roleMap, '平民');
  expect(guardIdx).not.toBe(-1);
  expect(wolfIdx).not.toBe(-1);
  expect(villagerIdx).not.toBe(-1);
  const joinerIdx = villagerIdx !== 0 ? villagerIdx : guardIdx !== 0 ? guardIdx : wolfIdx;
  return {
    setup,
    pages: setup.fixture.pages,
    contexts: setup.fixture.contexts,
    guardIdx,
    wolfIdx,
    villagerIdx,
    joinerIdx,
  };
}

/** Guard protects the villager, wolf targets the villager → peaceful night. */
async function finishNight(cast: NightCast): Promise<void> {
  const { pages, guardIdx, wolfIdx, villagerIdx, setup } = cast;
  const villagerSeat = setup.roleMap.get(villagerIdx)!.seat;

  await test.step('guard protects villager', async () => {
    expect(await waitForRoleTurn(pages[guardIdx]!, 'guardProtect', pages, 180_000)).toBe(true);
    await clickSeatAndConfirm(pages[guardIdx]!, villagerSeat);
  });
  await test.step('wolf votes villager', async () => {
    expect(await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages, 180_000)).toBe(true);
    await driveWolfVote(pages, [wolfIdx], villagerSeat);
  });
  await test.step('night ends with a result', async () => {
    expect(await waitForNightEnd(pages, 180_000)).toBe(true);
    await viewLastNightInfo(pages[0]!);
    const peaceful = await isTextVisible(pages[0]!, '平安夜');
    const death = await isTextVisible(pages[0]!, '死亡');
    expect(peaceful || death).toBe(true);
  });
}

async function teardown(cast: NightCast | undefined): Promise<void> {
  if (cast === undefined) return;
  for (const context of cast.contexts) await setOffline(context, false).catch(() => {});
  for (const context of cast.contexts) await context.close().catch(() => {});
}

test.describe('RoomLink resilience during the night', () => {
  test('joiner offline 5s: banner shows, link recovers, night completes', async ({ browser }) => {
    let cast: NightCast | undefined;
    try {
      cast = await castNight(browser);
      const page = cast.pages[cast.joinerIdx]!;
      const context = cast.contexts[cast.joinerIdx]!;

      await test.step('offline 5s shows the not-live banner', async () => {
        await setOffline(context, true);
        await expect(linkStatusBanner(page)).toBeVisible({ timeout: 40_000 });
        await page.waitForTimeout(5_000);
      });
      await test.step('back online → live', async () => {
        await setOffline(context, false);
        await waitForLinkLive(page);
      });
      await finishNight(cast);
    } finally {
      await teardown(cast);
    }
  });

  test('host offline 5s: link recovers and the host completes the night', async ({ browser }) => {
    let cast: NightCast | undefined;
    try {
      cast = await castNight(browser);
      const hostPage = cast.pages[0]!;
      const hostContext = cast.contexts[0]!;

      await setOffline(hostContext, true);
      await expect(linkStatusBanner(hostPage)).toBeVisible({ timeout: 40_000 });
      await hostPage.waitForTimeout(5_000);
      await setOffline(hostContext, false);
      await waitForLinkLive(hostPage);
      await finishNight(cast);
    } finally {
      await teardown(cast);
    }
  });

  test('joiner silently offline: others see the offline dot, link recovers', async ({
    browser,
  }) => {
    let cast: NightCast | undefined;
    try {
      cast = await castNight(browser);
      const page = cast.pages[cast.joinerIdx]!;
      const context = cast.contexts[cast.joinerIdx]!;
      const joinerSeat = cast.setup.roleMap.get(cast.joinerIdx)!.seat;
      const observer = cast.pages[0]!;

      await test.step('offline until the server marks the seat offline', async () => {
        await setOffline(context, true);
        await expect(linkStatusBanner(page)).toBeVisible({ timeout: 40_000 });
        // Server side: 60s stale threshold + 30s sweep cadence before PRESENCE drops the user.
        await expect(seatOfflineDot(observer, joinerSeat)).toBeVisible({ timeout: 100_000 });
      });
      await test.step('back online → live and present', async () => {
        await setOffline(context, false);
        await waitForLinkLive(page, 45_000);
        await expect(seatOfflineDot(observer, joinerSeat)).toBeHidden({ timeout: 15_000 });
      });
      await finishNight(cast);
    } finally {
      await teardown(cast);
    }
  });

  test('joiner flaps online/offline 5×: backoff absorbs it and the link settles live', async ({
    browser,
  }) => {
    let cast: NightCast | undefined;
    try {
      cast = await castNight(browser);
      const page = cast.pages[cast.joinerIdx]!;
      const context = cast.contexts[cast.joinerIdx]!;

      for (let cycle = 0; cycle < 5; cycle += 1) {
        await setOffline(context, true);
        await page.waitForTimeout(1_000);
        await setOffline(context, false);
        await page.waitForTimeout(1_000);
      }
      await waitForLinkLive(page);
      await finishNight(cast);
    } finally {
      await teardown(cast);
    }
  });

  test('joiner backgrounded 30s then foregrounded: fresh socket, link live', async ({
    browser,
  }) => {
    let cast: NightCast | undefined;
    try {
      cast = await castNight(browser);
      const page = cast.pages[cast.joinerIdx]!;

      await test.step('hidden 30s', async () => {
        await setPageHidden(page, true);
        await page.waitForTimeout(30_000);
      });
      await test.step('foreground → reconnect past the fast-resume window → live', async () => {
        await setPageHidden(page, false);
        await waitForLinkLive(page, 20_000);
      });
      await finishNight(cast);
    } finally {
      await teardown(cast);
    }
  });

  test('server drops every socket (deploy): all players reconnect without a reload', async ({
    browser,
  }) => {
    let cast: NightCast | undefined;
    try {
      cast = await castNight(browser);
      const { pages, setup } = cast;

      await test.step('server closes all sockets with 1012 service restart', async () => {
        const closed = await dropRoomSockets(pages[0]!, setup.roomCode, {
          code: 1012,
          reason: 'service_restart',
        });
        expect(closed).toBe(pages.length);
      });
      await test.step('every page returns to live', async () => {
        await Promise.all(pages.map((page) => waitForLinkLive(page, 20_000)));
      });
      await finishNight(cast);
    } finally {
      await teardown(cast);
    }
  });
});
