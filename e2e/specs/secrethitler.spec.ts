import { SECRETHITLER_NIGHT_VIEW_ACTION_KEY } from '@game-judge/game-engine/games/secrethitler/public';
import { expect, type Page, test } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { pressAlertButton } from '../helpers/alerts';
import { anySeatTestId } from '../helpers/ui';
import { HomePage } from '../pages/HomePage';
import { RoomPage } from '../pages/RoomPage';
import { SecrethitlerRoomPage } from '../pages/SecrethitlerRoomPage';

const PLAYER_COUNT = 10;
const VIEWPORT = { width: 1280, height: 900 };

type RoleName = '自由派' | '法西斯' | '希特勒';

async function waitForPhase(page: Page, phase: string, timeout = 60_000): Promise<void> {
  await new SecrethitlerRoomPage(page).waitForPhase(phase, timeout);
}

async function viewAndCaptureRole(room: RoomPage): Promise<RoleName> {
  const displayName = await room.viewRoleAndCapture();
  if (displayName === '自由派' || displayName === '法西斯' || displayName === '希特勒') {
    return displayName;
  }
  throw new Error(`Secret Hitler role card shows an unknown role: ${displayName}`);
}

function parseSeatNumbers(message: string): number[] {
  const seats = new Set<number>();
  for (const match of message.matchAll(/(\d+)号/g)) seats.add(Number(match[1]) - 1);
  return [...seats].sort((a, b) => a - b);
}

async function confirmNightInfo(page: Page, expectedSeats: readonly number[]): Promise<void> {
  const infoButton = page.getByTestId(
    TESTIDS.stepInteractionButton(SECRETHITLER_NIGHT_VIEW_ACTION_KEY),
  );
  await expect(infoButton).toBeVisible({ timeout: 30_000 });
  await infoButton.click();
  await expect(page.getByTestId(TESTIDS.alertTitle)).toHaveText('查看夜间信息？');
  await expect(page.getByTestId(TESTIDS.alertButton(1))).toHaveText('查看');
  await page.getByTestId(TESTIDS.alertButton(1)).click();
  await expect(page.getByTestId(TESTIDS.alertTitle)).toHaveText('坏人互认');
  const message = await page.getByTestId(TESTIDS.alertMessage).innerText();
  expect(parseSeatNumbers(message)).toEqual([...expectedSeats].sort((a, b) => a - b));
  await expect(page.getByTestId(TESTIDS.alertButton(0))).toHaveText('知道了');
  await page.getByTestId(TESTIDS.alertButton(0)).click();
  await expect(page.getByTestId(TESTIDS.alertModal)).toBeHidden({ timeout: 10_000 });
}

async function findSeatWithMarker(
  pages: Page[],
  marker: 'president' | 'chancellor',
): Promise<number> {
  let markerSeat: number | null = null;
  await expect
    .poll(
      async () => {
        markerSeat = null;
        for (let seat = 0; seat < pages.length; seat += 1) {
          if ((await pages[0]!.getByTestId(TESTIDS.seatMarker(seat, marker)).count()) > 0) {
            markerSeat = seat;
            break;
          }
        }
        return markerSeat;
      },
      { timeout: 30_000, message: `Expected a Secret Hitler ${marker} seat marker` },
    )
    .not.toBeNull();
  if (markerSeat === null) throw new Error(`Missing Secret Hitler ${marker} seat marker`);
  return markerSeat;
}

async function openGameAction(page: Page, label: string): Promise<void> {
  await new SecrethitlerRoomPage(page).openGameAction(label);
}

async function voteAll(
  pages: Page[],
  eliminatedSeats: ReadonlySet<number>,
  votes: readonly ('ja' | 'nein')[],
  voteMode: 'public' | 'secret',
  changeFirstVote = false,
): Promise<void> {
  expect(votes).toHaveLength(pages.length);
  const livingVotes = votes.filter((_, seat) => !eliminatedSeats.has(seat));
  const yesCount = livingVotes.filter((vote) => vote === 'ja').length;
  const noCount = livingVotes.length - yesCount;
  if (changeFirstVote) {
    const firstPage = pages[0]!;
    const initialVote =
      votes[0] === 'ja' ? TESTIDS.secrethitlerVoteNo : TESTIDS.secrethitlerVoteYes;
    await expect(firstPage.getByTestId(TESTIDS.secrethitlerActionModal)).toBeVisible();
    await firstPage.getByTestId(initialVote).click();
    await openGameAction(firstPage, '修改选票');
  }
  await Promise.all(
    pages.map(async (page, seat) => {
      if (eliminatedSeats.has(seat)) return;
      const voteTestId =
        votes[seat] === 'ja' ? TESTIDS.secrethitlerVoteYes : TESTIDS.secrethitlerVoteNo;
      await expect(page.getByTestId(TESTIDS.secrethitlerActionModal)).toHaveAttribute(
        'role',
        'dialog',
      );
      await expect(page.getByTestId(voteTestId)).toBeVisible();
      await page.getByTestId(voteTestId).click();
    }),
  );
  await Promise.all(
    pages.map((page) =>
      expect(page.getByTestId(TESTIDS.secrethitlerSettledVoteBanner)).toBeVisible({
        timeout: 30_000,
      }),
    ),
  );
  const expectedSummary = `政府${yesCount > noCount ? '通过' : '未通过'}：赞成 ${yesCount}，反对 ${noCount}`;
  await Promise.all(
    pages.map((page) =>
      expect(page.getByTestId(TESTIDS.secrethitlerVoteResultSummary)).toHaveText(expectedSummary),
    ),
  );
  if (voteMode === 'secret') {
    const anyResultRow = anySeatTestId(TESTIDS.secrethitlerVoteResultRow);
    await Promise.all(pages.map((page) => expect(page.getByTestId(anyResultRow)).toHaveCount(0)));
  } else {
    await Promise.all(
      votes.map(async (vote, seat) => {
        const resultRow = pages[0]!.getByTestId(TESTIDS.secrethitlerVoteResultRow(seat));
        if (eliminatedSeats.has(seat)) {
          await expect(resultRow).toHaveCount(0);
        } else {
          await expect(resultRow).toContainText(vote === 'ja' ? '赞成' : '反对');
        }
      }),
    );
  }
}

async function handleInvestigation(
  pages: Page[],
  presidentSeat: number,
  liberalSeats: readonly number[],
  investigatedSeats: Set<number>,
): Promise<void> {
  const page = pages[presidentSeat]!;
  await waitForPhase(page, 'executive');
  await openGameAction(page, '调查');
  const targetSeat = liberalSeats.find(
    (seat) => seat !== presidentSeat && !investigatedSeats.has(seat),
  );
  if (targetSeat === undefined) throw new Error('No eligible Secret Hitler investigation target');
  await page.getByTestId(TESTIDS.seatTilePressable(targetSeat)).click();
  await pressAlertButton(page, {
    title: `调查${targetSeat + 1}号？`,
    buttonIndex: 1,
    buttonLabel: '确定',
  });
  const resultDialog = page.getByTestId(TESTIDS.secrethitlerInvestigationResultDialog);
  await expect(resultDialog).toBeVisible();
  await expect(page.getByTestId(TESTIDS.secrethitlerInvestigationResultTitle)).toHaveText(
    '私密调查结果',
  );
  await expect(page.getByTestId(TESTIDS.secrethitlerInvestigationResultFaction)).toContainText(
    '自由派',
  );
  const otherPage = pages.find((_, seat) => seat !== presidentSeat);
  if (otherPage === undefined) throw new Error('Missing observer for investigation privacy check');
  await waitForPhase(otherPage, 'investigationResult');
  await expect(otherPage.getByTestId(TESTIDS.secrethitlerInvestigationResultDialog)).toHaveCount(0);
  await page.getByTestId(TESTIDS.secrethitlerInvestigationAcknowledge).click();
  await expect(resultDialog).toBeHidden();
  investigatedSeats.add(targetSeat);
}

async function handleSpecialElection(
  pages: Page[],
  presidentSeat: number,
  liberalSeats: readonly number[],
): Promise<number> {
  const page = pages[presidentSeat]!;
  await waitForPhase(page, 'executive');
  await openGameAction(page, '特别选举');
  const targetSeat = liberalSeats.find((seat) => seat !== presidentSeat);
  if (targetSeat === undefined) throw new Error('No liberal seat for special election');
  await page.getByTestId(TESTIDS.seatTilePressable(targetSeat)).click();
  await pressAlertButton(page, {
    title: `指定${targetSeat + 1}号为下任总统？`,
    buttonIndex: 1,
    buttonLabel: '确定',
  });
  return targetSeat;
}

async function handleExecution(
  pages: Page[],
  presidentSeat: number,
  hitlerSeat: number,
  liberalSeats: readonly number[],
  executedSeats: Set<number>,
): Promise<void> {
  const page = pages[presidentSeat]!;
  await waitForPhase(page, 'executive');
  await openGameAction(page, '处决');
  const targetSeat = liberalSeats.find(
    (seat) => seat !== presidentSeat && !executedSeats.has(seat),
  );
  if (targetSeat === undefined || targetSeat === hitlerSeat)
    throw new Error('No eligible non-Hitler execution target');
  await page.getByTestId(TESTIDS.seatTilePressable(targetSeat)).click();
  await pressAlertButton(page, {
    title: `处决${targetSeat + 1}号？`,
    buttonIndex: 1,
    buttonLabel: '确定',
  });
  executedSeats.add(targetSeat);
}

async function handleVetoResponse(page: Page): Promise<void> {
  await waitForPhase(page, 'vetoResponse');
  await openGameAction(page, '回应否决');
  await page.getByTestId(TESTIDS.secrethitlerVetoApprove).click();
  await pressAlertButton(page, {
    title: '同意否决？',
    buttonIndex: 1,
    buttonLabel: '确定',
  });
}

async function createPlayerRoom(
  pages: Page[],
  rooms: RoomPage[],
  voteMode: 'public' | 'secret',
  playerCount: 5 | 10,
): Promise<RoleName[]> {
  const hostPage = pages[0]!;
  expect(pages).toHaveLength(playerCount);
  await test.step(`create a ${playerCount}-player ${voteMode}-vote room`, async () => {
    await new HomePage(hostPage).clickCreateRoom('secrethitler');
    await expect(hostPage.getByTestId(TESTIDS.gameConfigScreenRoot('secrethitler'))).toBeVisible({
      timeout: 15_000,
    });
    const count = hostPage.getByTestId(TESTIDS.gameConfigField('secrethitler', 'numberOfPlayers'));
    await expect(count).toHaveValue('8');
    const changeCount = hostPage.getByTestId(
      playerCount > 8
        ? TESTIDS.gameConfigFieldIncrement('secrethitler', 'numberOfPlayers')
        : TESTIDS.gameConfigFieldDecrement('secrethitler', 'numberOfPlayers'),
    );
    for (let change = 0; change < Math.abs(playerCount - 8); change += 1) await changeCount.click();
    await expect(count).toHaveValue(String(playerCount));
    await hostPage
      .getByTestId(TESTIDS.gameConfigFieldOption('secrethitler', 'voteMode', voteMode))
      .click();
    await hostPage.getByTestId(TESTIDS.gameConfigSubmit('secrethitler')).click();
    await rooms[0]!.waitForReady('host');
  });

  await test.step(`seat all ${playerCount} real players`, async () => {
    const code = await rooms[0]!.getRoomCode();
    await rooms[0]!.seatAt(0);
    for (let seat = 1; seat < playerCount; seat += 1) {
      await rooms[seat]!.joinViaCode(code);
      await rooms[seat]!.seatAt(seat);
    }
    await rooms[0]!.expectHostManagementAction(TESTIDS.assignRolesButton, '分配角色');
  });

  return test.step('assign and privately view every role', async () => {
    await rooms[0]!.prepareRoles();
    const roles: RoleName[] = [];
    for (const room of rooms) roles.push(await viewAndCaptureRole(room));
    expect(roles.filter((role) => role === '自由派')).toHaveLength(playerCount === 5 ? 3 : 6);
    expect(roles.filter((role) => role === '法西斯')).toHaveLength(playerCount === 5 ? 1 : 3);
    expect(roles.filter((role) => role === '希特勒')).toHaveLength(1);
    await rooms[0]!.expectHostManagementAction(TESTIDS.startGameButton, '开始游戏');
    return roles;
  });
}

async function startMatchAndConfirmNight(
  pages: Page[],
  rooms: RoomPage[],
  roles: readonly RoleName[],
): Promise<void> {
  const hostPage = pages[0]!;
  const hitlerSeat = roles.indexOf('希特勒');
  const fascistSeats = roles
    .map((role, seat) => (role === '法西斯' ? seat : -1))
    .filter((seat) => seat >= 0);

  await test.step('start and confirm the first-night fascist recognition', async () => {
    await rooms[0]!.startGame();
    await waitForPhase(hostPage, 'night');
    for (const fascistSeat of fascistSeats) {
      await confirmNightInfo(
        pages[fascistSeat]!,
        [...fascistSeats, hitlerSeat].filter((seat) => seat !== fascistSeat),
      );
    }
    if (pages.length <= 6) await confirmNightInfo(pages[hitlerSeat]!, fascistSeats);
    await waitForPhase(hostPage, 'election', 120_000);
  });
}

async function playFullMatch(pages: Page[], roles: readonly RoleName[]): Promise<void> {
  const hostPage = pages[0]!;
  const hitlerSeat = roles.indexOf('希特勒');
  const liberalSeats = roles
    .map((role, seat) => (role === '自由派' ? seat : -1))
    .filter((seat) => seat >= 0);
  let fascistPolicies = 0;
  let liberalPolicies = 0;
  let vetoUsed = false;
  const investigatedSeats = new Set<number>();
  const executedSeats = new Set<number>();

  for (let government = 0; government < 20; government += 1) {
    const finished = await test.step(`government ${government + 1}`, async () => {
      await waitForPhase(hostPage, 'election');
      const presidentSeat = await findSeatWithMarker(pages, 'president');
      await new SecrethitlerRoomPage(pages[presidentSeat]!).nominate(presidentSeat, liberalSeats);
      const votes = pages.map((_, seat) =>
        government === 0 && seat >= 4 ? ('nein' as const) : ('ja' as const),
      );
      await voteAll(pages, executedSeats, votes, 'public', government === 0);
      if (government === 0) {
        await waitForPhase(hostPage, 'election', 15_000);
        return false;
      }

      await waitForPhase(hostPage, 'legislativePresident', 15_000);
      const legislativePresident = await findSeatWithMarker(pages, 'president');
      await new SecrethitlerRoomPage(pages[legislativePresident]!).discardPolicy();
      await waitForPhase(hostPage, 'legislativeChancellor');
      const chancellorSeat = await findSeatWithMarker(pages, 'chancellor');
      const enacted = await new SecrethitlerRoomPage(pages[chancellorSeat]!).enactOrRequestVeto(
        fascistPolicies >= 5 && !vetoUsed,
      );
      if (enacted.kind === 'veto') {
        vetoUsed = true;
        const vetoPresident = await findSeatWithMarker(pages, 'president');
        await handleVetoResponse(pages[vetoPresident]!);
        await waitForPhase(hostPage, 'election');
        return false;
      }
      if (enacted.policy === 'fascist') {
        fascistPolicies += 1;
      } else {
        liberalPolicies += 1;
      }

      await expect(hostPage.getByTestId(TESTIDS.secrethitlerPolicyResultImage)).toBeVisible();
      if (fascistPolicies === 6 || liberalPolicies === 5) {
        await waitForPhase(hostPage, 'ended', 15_000);
        return true;
      }
      if (enacted.policy === 'liberal') {
        await waitForPhase(hostPage, 'election', 15_000);
        return false;
      }

      await waitForPhase(hostPage, 'executive', 15_000);
      const executivePresident = await findSeatWithMarker(pages, 'president');
      if (fascistPolicies <= 2) {
        await handleInvestigation(pages, executivePresident, liberalSeats, investigatedSeats);
      } else if (fascistPolicies === 3) {
        const selectedPresident = await handleSpecialElection(
          pages,
          executivePresident,
          liberalSeats,
        );
        await waitForPhase(hostPage, 'election');
        expect(await findSeatWithMarker(pages, 'president')).toBe(selectedPresident);
        return false;
      } else {
        await handleExecution(pages, executivePresident, hitlerSeat, liberalSeats, executedSeats);
      }
      await waitForPhase(hostPage, 'election');
      return false;
    });
    if (finished) return;
  }
  throw new Error(
    `Secret Hitler did not finish after 20 governments: ${liberalPolicies} liberal policies, ${fascistPolicies} fascist policies, veto used: ${vetoUsed}`,
  );
}

async function reviewAndRestart(
  pages: Page[],
  rooms: RoomPage[],
  hitlerSeat: number,
): Promise<void> {
  const hostPage = pages[0]!;
  await test.step('verify ended state, review and restart', async () => {
    await waitForPhase(hostPage, 'ended', 30_000);
    const panel = await rooms[0]!.openHostManagement();
    await expect(panel.getByTestId(TESTIDS.roomReviewHostAction)).toBeVisible();
    await panel.getByTestId(TESTIDS.roomReviewHostAction).click();
    const hostReview = hostPage.getByTestId(TESTIDS.roomReviewDialog);
    await expect(hostReview).toBeVisible();
    // Scoped to the dialog: the review's offscreen export stage renders the same pages.
    await expect(hostReview.getByTestId(TESTIDS.roomReviewRosterRow(hitlerSeat))).toBeVisible();
    await hostPage.getByTestId(TESTIDS.roomDialogCloseButton).click();

    await rooms[0]!.clickHostManagementAction(TESTIDS.restartButton);
    await pressAlertButton(hostPage, {
      title: '重新开始？',
      buttonIndex: 1,
      buttonLabel: '重新开始',
    });
    await waitForPhase(hostPage, 'lobby');
    await rooms[0]!.expectHostManagementAction(TESTIDS.assignRolesButton, '分配角色');
  });
}

test.describe.configure({ mode: 'default' });
test.setTimeout(1_200_000);

test.describe('Secret Hitler', () => {
  test('10 real players complete a full match, review and restart', async ({
    browser,
  }, testInfo) => {
    const fixture = await createPlayerContexts(browser, PLAYER_COUNT);
    const pages = fixture.pages;
    const rooms = pages.map((page) => new RoomPage(page));
    const hostPage = pages[0];

    try {
      await Promise.all(pages.map((page) => page.setViewportSize(VIEWPORT)));

      const roles = await createPlayerRoom(pages, rooms, 'public', 10);

      const hitlerSeat = roles.indexOf('希特勒');
      await startMatchAndConfirmNight(pages, rooms, roles);
      await playFullMatch(pages, roles);

      await reviewAndRestart(pages, rooms, hitlerSeat);
      await testInfo.attach('secrethitler-full-match', {
        body: await hostPage.screenshot(),
        contentType: 'image/png',
      });
    } finally {
      await closeAll(fixture);
    }
  });

  test('10 real players see aggregate secret votes and chaos after three rejections', async ({
    browser,
  }) => {
    const fixture = await createPlayerContexts(browser, PLAYER_COUNT);
    const pages = fixture.pages;
    const rooms = pages.map((page) => new RoomPage(page));

    try {
      await Promise.all(pages.map((page) => page.setViewportSize(VIEWPORT)));
      const roles = await createPlayerRoom(pages, rooms, 'secret', 10);
      await startMatchAndConfirmNight(pages, rooms, roles);

      const liberalSeats = roles
        .map((role, seat) => (role === '自由派' ? seat : -1))
        .filter((seat) => seat >= 0);
      for (let rejection = 0; rejection < 3; rejection += 1) {
        await test.step(`secret rejection ${rejection + 1}`, async () => {
          await waitForPhase(pages[0], 'election');
          const presidentSeat = await findSeatWithMarker(pages, 'president');
          await new SecrethitlerRoomPage(pages[presidentSeat]!).nominate(
            presidentSeat,
            liberalSeats,
          );
          const votes = pages.map((_, seat) => (seat < 4 ? ('ja' as const) : ('nein' as const)));
          await voteAll(pages, new Set<number>(), votes, 'secret');
          if (rejection === 2) {
            await Promise.all(
              pages.map((page) =>
                expect(page.getByTestId(TESTIDS.secrethitlerPolicyResultImage)).toBeVisible(),
              ),
            );
          }
          await waitForPhase(pages[0], 'election', 15_000);
        });
      }
    } finally {
      await closeAll(fixture);
    }
  });

  test('5 real players privately inspect policies and elect Hitler', async ({ browser }) => {
    const fixture = await createPlayerContexts(browser, 5);
    const pages = fixture.pages;
    const rooms = pages.map((page) => new RoomPage(page));

    try {
      await Promise.all(pages.map((page) => page.setViewportSize(VIEWPORT)));
      const roles = await createPlayerRoom(pages, rooms, 'public', 5);
      await startMatchAndConfirmNight(pages, rooms, roles);
      const liberalSeats = roles
        .map((role, seat) => (role === '自由派' ? seat : -1))
        .filter((seat) => seat >= 0);
      const hitlerSeat = roles.indexOf('希特勒');
      let fascistPolicies = 0;
      let policyPreviewed = false;
      for (let government = 0; government < 5; government += 1) {
        const previewed =
          await test.step(`government ${government + 1} toward policy preview`, async () => {
            await waitForPhase(pages[0], 'election');
            const presidentSeat = await findSeatWithMarker(pages, 'president');
            await new SecrethitlerRoomPage(pages[presidentSeat]!).nominate(
              presidentSeat,
              liberalSeats,
            );
            await voteAll(
              pages,
              new Set<number>(),
              pages.map(() => 'ja' as const),
              'public',
            );
            await waitForPhase(pages[0], 'legislativePresident', 15_000);
            await new SecrethitlerRoomPage(pages[presidentSeat]!).discardPolicy();
            await waitForPhase(pages[0], 'legislativeChancellor');
            const chancellorSeat = await findSeatWithMarker(pages, 'chancellor');
            const result = await new SecrethitlerRoomPage(
              pages[chancellorSeat]!,
            ).enactOrRequestVeto(false);
            if (result.kind !== 'policy')
              throw new Error('Unexpected veto in policy preview setup');
            if (result.policy === 'fascist') fascistPolicies += 1;
            await expect(pages[0].getByTestId(TESTIDS.secrethitlerPolicyResultImage)).toBeVisible();
            if (fascistPolicies < 3) {
              await waitForPhase(pages[0], 'election', 15_000);
              return false;
            }

            await waitForPhase(pages[0], 'executive', 15_000);
            const presidentPage = pages[presidentSeat]!;
            await openGameAction(presidentPage, '政策预览');
            await pressAlertButton(presidentPage, {
              title: '查看政策预览？',
              buttonIndex: 1,
              buttonLabel: '查看',
            });
            await expect(
              presidentPage.getByTestId(TESTIDS.secrethitlerPolicyPeekModal),
            ).toBeVisible();
            for (let index = 0; index < 3; index += 1) {
              await expect(
                presidentPage.getByTestId(TESTIDS.secrethitlerPolicyPeekCard(index)),
              ).toHaveAttribute('alt', /^(自由派|法西斯)$/);
            }
            const observer = pages.find((_, seat) => seat !== presidentSeat);
            if (observer === undefined) throw new Error('Missing policy preview observer');
            await waitForPhase(observer, 'executive');
            await expect(observer.getByTestId(TESTIDS.secrethitlerPolicyPeekModal)).toHaveCount(0);
            await presidentPage.getByTestId(TESTIDS.secrethitlerPolicyPeekAcknowledge).click();
            await waitForPhase(pages[0], 'election');
            return true;
          });
        if (previewed) {
          policyPreviewed = true;
          break;
        }
      }
      if (!policyPreviewed)
        throw new Error(
          `Policy preview not reached after five governments: ${fascistPolicies} fascist policies`,
        );

      await test.step('elect Hitler after three fascist policies', async () => {
        const eliminatedSeats = new Set<number>();
        let presidentSeat = await findSeatWithMarker(pages, 'president');
        if (presidentSeat === hitlerSeat) {
          await new SecrethitlerRoomPage(pages[presidentSeat]!).nominate(
            presidentSeat,
            liberalSeats,
          );
          await voteAll(
            pages,
            new Set<number>(),
            pages.map(() => 'ja' as const),
            'public',
          );
          await waitForPhase(pages[0], 'legislativePresident', 15_000);
          await new SecrethitlerRoomPage(pages[presidentSeat]!).discardPolicy();
          await waitForPhase(pages[0], 'legislativeChancellor');
          const chancellorSeat = await findSeatWithMarker(pages, 'chancellor');
          const result = await new SecrethitlerRoomPage(pages[chancellorSeat]!).enactOrRequestVeto(
            false,
          );
          if (result.kind !== 'policy') throw new Error('Unexpected veto before Hitler election');
          await expect(pages[0].getByTestId(TESTIDS.secrethitlerPolicyResultImage)).toBeVisible();
          if (result.policy === 'fascist') {
            await waitForPhase(pages[0], 'executive', 15_000);
            await handleExecution(pages, presidentSeat, hitlerSeat, liberalSeats, eliminatedSeats);
          }
          await waitForPhase(pages[0], 'election', 15_000);
          presidentSeat = await findSeatWithMarker(pages, 'president');
        }
        await new SecrethitlerRoomPage(pages[presidentSeat]!).nominate(presidentSeat, [hitlerSeat]);
        await voteAll(
          pages,
          eliminatedSeats,
          pages.map(() => 'ja' as const),
          'public',
        );
        await waitForPhase(pages[0], 'ended', 15_000);
        const panel = await rooms[0]!.openHostManagement();
        await panel.getByTestId(TESTIDS.roomReviewHostAction).click();
        await expect(pages[0].getByTestId(TESTIDS.roomReviewDialog)).toContainText(
          '法西斯政策达到三张后，希特勒当选总理',
        );
      });
    } finally {
      await closeAll(fixture);
    }
  });
});
