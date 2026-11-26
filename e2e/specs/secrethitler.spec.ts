import { SECRETHITLER_NIGHT_VIEW_ACTION_KEY } from '@game-judge/game-engine/games/secrethitler/public';
import { expect, type Page, test } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { pressAlertButton } from '../helpers/alerts';
import { HomePage } from '../pages/HomePage';
import { RoomPage } from '../pages/RoomPage';

const PLAYER_COUNT = 10;
const VIEWPORT = { width: 1280, height: 900 };

type RoleName = '自由派' | '法西斯' | '希特勒';

async function waitForPhase(page: Page, phase: string, timeout = 60_000): Promise<void> {
  await expect(page.getByTestId(TESTIDS.roomHeader)).toHaveAttribute('data-phase', phase, {
    timeout,
  });
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
        for (let seat = 0; seat < PLAYER_COUNT; seat += 1) {
          if ((await pages[seat]!.getByTestId(TESTIDS.seatMarker(seat, marker)).count()) > 0) {
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
  const action = page.getByTestId(TESTIDS.secrethitlerGameAction);
  await expect(action).toBeVisible({ timeout: 30_000 });
  await expect(action).toHaveAttribute('aria-label', label);
  await action.click();
}

async function nominate(
  page: Page,
  presidentSeat: number,
  preferredSeats: readonly number[],
): Promise<void> {
  await openGameAction(page, '预选总理');
  const preselectModal = page.getByTestId(TESTIDS.secrethitlerNominationModal);
  await expect(preselectModal).toBeVisible();
  await expect(page.getByTestId(TESTIDS.secrethitlerNominationCount)).toHaveText('已选 0/1');
  const targetSeat = await findEnabledSeat(page, preferredSeats);
  await page.getByTestId(TESTIDS.secrethitlerNominationRow(targetSeat)).click();
  await expect(page.getByTestId(TESTIDS.secrethitlerNominationCount)).toHaveText('已选 1/1');
  await page.getByTestId(TESTIDS.secrethitlerNominationConfirm).click();
  await expect(preselectModal).toBeHidden();

  await openGameAction(page, '最终提名');
  await expect(preselectModal).toBeVisible();
  await expect(page.getByTestId(TESTIDS.secrethitlerNominationRow(targetSeat))).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByTestId(TESTIDS.secrethitlerNominationConfirm).click();
  await expect(preselectModal).toBeHidden();
  await expect(page.getByTestId(TESTIDS.roomHeader)).toHaveAttribute('data-phase', 'voting');
  expect(targetSeat).not.toBe(presidentSeat);
}

async function findEnabledSeat(page: Page, preferredSeats: readonly number[]): Promise<number> {
  for (const seat of preferredSeats) {
    if (await page.getByTestId(TESTIDS.secrethitlerNominationRow(seat)).isEnabled()) return seat;
  }
  throw new Error('Secret Hitler nomination modal has no eligible preferred candidate');
}

async function voteAll(
  pages: Page[],
  eliminatedSeats: ReadonlySet<number>,
  vote: 'ja' | 'nein',
  voteMode: 'public' | 'secret',
): Promise<void> {
  const voteTestId = vote === 'ja' ? TESTIDS.secrethitlerVoteYes : TESTIDS.secrethitlerVoteNo;
  await Promise.all(
    pages.map(async (page, seat) => {
      if (eliminatedSeats.has(seat)) return;
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
  const summary = pages[0]!.getByTestId(TESTIDS.secrethitlerVoteResultSummary);
  await expect(summary).toContainText(vote === 'ja' ? '政府通过' : '政府未通过');
  for (let seat = 0; seat < PLAYER_COUNT; seat += 1) {
    const resultRow = pages[0]!.getByTestId(TESTIDS.secrethitlerVoteResultRow(seat));
    if (eliminatedSeats.has(seat) || voteMode === 'secret') {
      await expect(resultRow).toHaveCount(0);
    } else {
      await expect(resultRow).toContainText(vote === 'ja' ? '赞成' : '反对');
    }
  }
}

async function findPolicyCard(
  page: Page,
  action: 'discard' | 'enact',
  policy: 'liberal' | 'fascist',
  maxIndex: number,
): Promise<number | null> {
  for (let index = 0; index < maxIndex; index += 1) {
    const card = page.getByTestId(TESTIDS.secrethitlerPolicyCard(action, policy, index));
    if ((await card.count()) > 0) return index;
  }
  return null;
}

async function handlePresidentLegislation(page: Page): Promise<void> {
  await waitForPhase(page, 'legislativePresident');
  await expect(page.getByTestId(TESTIDS.secrethitlerActionModal)).toHaveAttribute('role', 'dialog');
  for (const policy of ['liberal', 'fascist'] as const) {
    const index = await findPolicyCard(page, 'discard', policy, 3);
    if (index === null) continue;
    const card = page.getByTestId(TESTIDS.secrethitlerPolicyCard('discard', policy, index));
    await expect(card).toBeVisible();
    await card.click();
    await pressAlertButton(page, {
      title: `弃置${policy === 'fascist' ? '法西斯' : '自由派'}政策？`,
      buttonIndex: 1,
      buttonLabel: '确定',
    });
    return;
  }
  throw new Error('Secret Hitler president has no policy discard card');
}

async function handleChancellorLegislation(
  page: Page,
  requestVeto: boolean,
): Promise<{ kind: 'policy'; policy: 'liberal' | 'fascist' } | { kind: 'veto' }> {
  await waitForPhase(page, 'legislativeChancellor');
  await expect(page.getByTestId(TESTIDS.secrethitlerActionModal)).toHaveAttribute('role', 'dialog');
  if (requestVeto) {
    const vetoButton = page.getByTestId(TESTIDS.secrethitlerVetoRequest);
    await expect(vetoButton).toBeVisible();
    await vetoButton.click();
    await pressAlertButton(page, {
      title: '请求否决？',
      buttonIndex: 1,
      buttonLabel: '确定',
    });
    return { kind: 'veto' };
  }
  for (const policy of ['fascist', 'liberal'] as const) {
    const index = await findPolicyCard(page, 'enact', policy, 2);
    if (index === null) continue;
    const card = page.getByTestId(TESTIDS.secrethitlerPolicyCard('enact', policy, index));
    await expect(card).toBeVisible();
    await card.click();
    await pressAlertButton(page, {
      title: `施行${policy === 'fascist' ? '法西斯' : '自由派'}政策？`,
      buttonIndex: 1,
      buttonLabel: '确定',
    });
    return { kind: 'policy', policy };
  }
  throw new Error('Secret Hitler chancellor has no policy enact card');
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
  await page.getByTestId(TESTIDS.secrethitlerInvestigationAcknowledge).click();
  await expect(resultDialog).toBeHidden();
  investigatedSeats.add(targetSeat);
}

async function handleSpecialElection(
  pages: Page[],
  presidentSeat: number,
  liberalSeats: readonly number[],
): Promise<void> {
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

async function createTenPlayerRoom(
  pages: Page[],
  rooms: RoomPage[],
  voteMode: 'public' | 'secret',
): Promise<RoleName[]> {
  const hostPage = pages[0]!;
  await test.step(`create a 10-player ${voteMode}-vote room`, async () => {
    await new HomePage(hostPage).clickCreateRoom('secrethitler');
    await expect(hostPage.getByTestId(TESTIDS.gameConfigScreenRoot('secrethitler'))).toBeVisible({
      timeout: 15_000,
    });
    const count = hostPage.getByTestId(TESTIDS.gameConfigField('secrethitler', 'numberOfPlayers'));
    await expect(count).toHaveValue('8');
    const increment = hostPage.getByTestId(
      TESTIDS.gameConfigFieldIncrement('secrethitler', 'numberOfPlayers'),
    );
    await increment.click();
    await increment.click();
    await expect(count).toHaveValue('10');
    await hostPage
      .getByTestId(TESTIDS.gameConfigFieldOption('secrethitler', 'voteMode', voteMode))
      .click();
    await hostPage.getByTestId(TESTIDS.gameConfigSubmit('secrethitler')).click();
    await rooms[0]!.waitForReady('host');
  });

  await test.step('seat all 10 real players', async () => {
    const code = await rooms[0]!.getRoomCode();
    await rooms[0]!.seatAt(0);
    for (let seat = 1; seat < PLAYER_COUNT; seat += 1) {
      await rooms[seat]!.joinViaCode(code);
      await rooms[seat]!.seatAt(seat);
    }
    await rooms[0]!.expectHostManagementAction(TESTIDS.assignRolesButton, '分配角色');
  });

  return test.step('assign and privately view every role', async () => {
    await rooms[0]!.prepareRoles();
    const roles: RoleName[] = [];
    for (const room of rooms) roles.push(await viewAndCaptureRole(room));
    expect(roles.filter((role) => role === '自由派')).toHaveLength(6);
    expect(roles.filter((role) => role === '法西斯')).toHaveLength(3);
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
  let vetoUsed = false;
  let castRejectionVote = true;
  const investigatedSeats = new Set<number>();
  const executedSeats = new Set<number>();

  await test.step('elect governments, enact policies and complete the match', async () => {
    for (let government = 0; government < 20; government += 1) {
      if ((await hostPage.getByTestId(TESTIDS.roomHeader).getAttribute('data-phase')) === 'ended')
        break;

      await waitForPhase(hostPage, 'election');
      const presidentSeat = await findSeatWithMarker(pages, 'president');
      await nominate(pages[presidentSeat]!, presidentSeat, liberalSeats);
      await voteAll(pages, executedSeats, castRejectionVote ? 'nein' : 'ja', 'public');

      await expect
        .poll(async () => hostPage.getByTestId(TESTIDS.roomHeader).getAttribute('data-phase'), {
          timeout: 15_000,
        })
        .not.toBe('publicResult');
      let nextPhase = await hostPage.getByTestId(TESTIDS.roomHeader).getAttribute('data-phase');
      if (nextPhase === 'ended') break;
      if (castRejectionVote) {
        expect(nextPhase).toBe('election');
        castRejectionVote = false;
        continue;
      }
      if (nextPhase === 'election') continue;

      await waitForPhase(hostPage, 'legislativePresident');
      const legislativePresident = await findSeatWithMarker(pages, 'president');
      await handlePresidentLegislation(pages[legislativePresident]!);
      await waitForPhase(hostPage, 'legislativeChancellor');
      const chancellorSeat = await findSeatWithMarker(pages, 'chancellor');
      const enacted = await handleChancellorLegislation(
        pages[chancellorSeat]!,
        fascistPolicies >= 5 && !vetoUsed,
      );
      if (enacted.kind === 'veto') {
        vetoUsed = true;
        const vetoPresident = await findSeatWithMarker(pages, 'president');
        await handleVetoResponse(pages[vetoPresident]!);
        await waitForPhase(hostPage, 'election');
        continue;
      }
      if (enacted.policy === 'fascist') fascistPolicies += 1;

      await expect(hostPage.getByTestId(TESTIDS.secrethitlerPolicyResultImage)).toBeVisible();
      await expect
        .poll(async () => hostPage.getByTestId(TESTIDS.roomHeader).getAttribute('data-phase'), {
          timeout: 15_000,
        })
        .not.toBe('publicResult');
      nextPhase = await hostPage.getByTestId(TESTIDS.roomHeader).getAttribute('data-phase');
      if (nextPhase === 'ended') break;
      if (nextPhase !== 'executive') continue;

      const executivePresident = await findSeatWithMarker(pages, 'president');
      const executiveAction = pages[executivePresident]!.getByTestId(
        TESTIDS.secrethitlerGameAction,
      );
      const label = await executiveAction.getAttribute('aria-label');
      if (label === '调查') {
        await handleInvestigation(pages, executivePresident, liberalSeats, investigatedSeats);
      } else if (label === '特别选举') {
        await handleSpecialElection(pages, executivePresident, liberalSeats);
      } else if (label === '处决') {
        await handleExecution(pages, executivePresident, hitlerSeat, liberalSeats, executedSeats);
      } else {
        throw new Error(`Unexpected 10-player presidential power: ${label}`);
      }
      await waitForPhase(hostPage, 'election');
    }
  });
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
    await expect(hostPage.getByTestId(TESTIDS.roomReviewDialog)).toBeVisible();
    await expect(hostPage.getByTestId(TESTIDS.roomReviewRosterRow(hitlerSeat))).toBeVisible();
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

test.describe.configure({ mode: 'serial' });
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

      const roles = await createTenPlayerRoom(pages, rooms, 'public');

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

  test('10 real players see aggregate votes in secret-vote mode', async ({ browser }) => {
    const fixture = await createPlayerContexts(browser, PLAYER_COUNT);
    const pages = fixture.pages;
    const rooms = pages.map((page) => new RoomPage(page));

    try {
      await Promise.all(pages.map((page) => page.setViewportSize(VIEWPORT)));
      const roles = await createTenPlayerRoom(pages, rooms, 'secret');
      await startMatchAndConfirmNight(pages, rooms, roles);

      await test.step('show only aggregate vote counts', async () => {
        const presidentSeat = await findSeatWithMarker(pages, 'president');
        const liberalSeats = roles
          .map((role, seat) => (role === '自由派' ? seat : -1))
          .filter((seat) => seat >= 0);
        await nominate(pages[presidentSeat]!, presidentSeat, liberalSeats);
        await voteAll(pages, new Set<number>(), 'ja', 'secret');
      });
    } finally {
      await closeAll(fixture);
    }
  });
});
