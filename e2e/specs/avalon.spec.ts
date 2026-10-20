import { expect, type Page, test } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { HomePage } from '../pages/HomePage';
import { RoomPage } from '../pages/RoomPage';

/**
 * Avalon 首个 e2e spec：10 人真人局一局全覆盖（用户 2026-10-15 定版脚本）。
 *
 * - 10 个独立 browser context、零 bot：不填充、不接管，角色随机发放，
 *   驱动侧一律从每个 context 自己的角色卡读本人角色后按角色行动。
 * - 投票模式用公投（public）：结算面板逐人亮票，可逐座断言票型。
 * - 脚本：夜晚三步 → 任务一（首提案否决验轮转、次提案通过）→ 任务二失败
 *   → 湖仙查验一（验令牌转移）→ 任务三成功 → 湖仙查验二 → 任务四保护轮
 *   （一票失败仍成功、第三胜）→ 刺客指认梅林、坏人翻盘终局。
 */

test.setTimeout(1_200_000);

const PLAYER_COUNT = 10;
const VIEWPORT = { width: 1280, height: 900 };

const ROLE_NAMES = [
  '派西维尔',
  '莫德雷德',
  '梅林',
  '忠臣',
  '莫甘娜',
  '刺客',
  '奥伯伦',
  '爪牙',
] as const;
type RoleName = (typeof ROLE_NAMES)[number];

const EVIL_ROLES: ReadonlySet<RoleName> = new Set(['莫甘娜', '刺客', '莫德雷德', '奥伯伦', '爪牙']);
const GOOD_ROLES: ReadonlySet<RoleName> = new Set(['梅林', '派西维尔', '忠臣']);

type Ballot = 'approve' | 'reject';
type Play = 'success' | 'fail';

// ---------------------------------------------------------------------------
// Small probes (conditional probing only; assertions stay strict elsewhere)
// ---------------------------------------------------------------------------

async function isTextVisible(page: Page, pattern: RegExp): Promise<boolean> {
  return page
    .getByText(pattern)
    .first()
    .isVisible()
    .catch(() => false);
}

/** Poll every page until one shows the probe text; returns its seat index. */
async function findSeatByProbe(pages: Page[], pattern: RegExp, label: string): Promise<number> {
  for (let sweep = 0; sweep < 60; sweep += 1) {
    for (let seat = 0; seat < pages.length; seat += 1) {
      if (await isTextVisible(pages[seat]!, pattern)) return seat;
    }
    await pages[0]!.waitForTimeout(300);
  }
  throw new Error(`findSeatByProbe: no page showed ${label} after polling`);
}

/** Dismiss a result panel when it is up; absence is not a failure here. */
async function dismissPanelIfVisible(
  page: Page,
  panelTestId: string,
  closeTestId: string,
): Promise<void> {
  const panel = page.getByTestId(panelTestId);
  const visible = await panel
    .waitFor({ state: 'visible', timeout: 2500 })
    .then(() => true)
    .catch(() => false);
  if (!visible) return;
  await page.getByTestId(closeTestId).click();
  await expect(panel).toBeHidden({ timeout: 10_000 });
}

async function dismissVoteResultPanels(pages: Page[]): Promise<void> {
  for (const page of pages)
    await dismissPanelIfVisible(page, 'avalon-vote-result-panel', 'avalon-vote-result-close');
}

async function dismissQuestResultPanels(pages: Page[]): Promise<void> {
  for (const page of pages)
    await dismissPanelIfVisible(page, 'avalon-quest-result-panel', 'avalon-quest-result-close');
}

// ---------------------------------------------------------------------------
// Role capture (viewing stage)
// ---------------------------------------------------------------------------

/** Open the own role card, read the role name from inside the card, dismiss. */
async function viewAndCaptureRole(page: Page): Promise<RoleName> {
  await page.getByTestId('avalon-view-role').click();
  const modal = page.getByTestId('role-card-modal');
  await expect(modal).toBeVisible({ timeout: 15_000 });
  let captured: RoleName | null = null;
  for (const name of ROLE_NAMES) {
    const visible = await modal
      .getByText(name, { exact: true })
      .first()
      .isVisible()
      .catch(() => false);
    if (visible) {
      captured = name;
      break;
    }
  }
  if (captured === null) throw new Error('Role card did not show any known Avalon role name');
  await modal.getByText('知道了', { exact: true }).click();
  await expect(modal).toBeHidden({ timeout: 10_000 });
  return captured;
}

// ---------------------------------------------------------------------------
// Night
// ---------------------------------------------------------------------------

function parseSeatNumbers(message: string): number[] {
  const seats = new Set<number>();
  for (const match of message.matchAll(/(\d+)号/g)) seats.add(Number(match[1]) - 1);
  return [...seats].sort((a, b) => a - b);
}

/**
 * Drive one night participant: bottom 确认信息 → modal → assert what they
 * see → confirm. The button is available while the host narration plays
 * (confirmation and narration run in parallel; the step settles once
 * every participant has confirmed and the host ack has landed, in
 * either order), so no waiting out an audio gate here.
 */
async function confirmNightInfo(
  page: Page,
  expectedTitle: string,
  expectedSeats: readonly number[],
): Promise<void> {
  const infoButton = page.getByTestId('avalon-night-info');
  await expect(infoButton).toBeVisible({ timeout: 30_000 });
  await infoButton.click();
  const modal = page.getByTestId(TESTIDS.alertModal);
  await expect(modal).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId(TESTIDS.alertTitle)).toHaveText(expectedTitle);
  const message = await page.getByTestId(TESTIDS.alertMessage).innerText();
  expect(parseSeatNumbers(message)).toEqual([...expectedSeats].sort((a, b) => a - b));
  await page.getByTestId(TESTIDS.alertButton(0)).click();
  await expect(modal).toBeHidden({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Nomination / vote / quest
// ---------------------------------------------------------------------------

async function pickTeam(pages: Page[], leaderSeat: number, team: readonly number[]) {
  const leaderPage = pages[leaderSeat]!;
  const leaderRoom = new RoomPage(leaderPage);
  // 提名草稿是服务端状态、全房可见：第二名玩家（非队长）页面必须实时
  // 看到同一份草稿徽标，队长改选后同步变化。
  const observerSeat = (leaderSeat + 1) % PLAYER_COUNT;
  const observerRoom = new RoomPage(pages[observerSeat]!);
  // 改选探针：先选一个不在最终队伍里的座位，再撤销，验证徽标的新增与
  // 消失都同步到第二名玩家；最终队伍不变，下游步骤不受影响。
  const probeSeat = Array.from({ length: PLAYER_COUNT }, (_, seat) => seat).find(
    (seat) => seat !== leaderSeat && !team.includes(seat),
  );
  if (probeSeat === undefined) throw new Error('pickTeam: no probe seat outside the team');
  const leaderProbeTile = leaderRoom.getSeatTile(probeSeat);
  const observerProbeTile = observerRoom.getSeatTile(probeSeat);
  await leaderProbeTile.click();
  await expect(leaderProbeTile).toContainText('队员', { timeout: 10_000 });
  await expect(observerProbeTile).toContainText('队员', { timeout: 10_000 });
  await leaderProbeTile.click();
  await expect(leaderProbeTile).not.toContainText('队员', { timeout: 10_000 });
  await expect(observerProbeTile).not.toContainText('队员', { timeout: 10_000 });
  for (const seat of team) {
    const tile = leaderRoom.getSeatTile(seat);
    await tile.click();
    // 座位状态标签是单槽：队长本人座位恒显示「队长」，选中也不变「队员」；
    // 其点选是否生效由最后提交按钮「恰选满才 enabled」兜底验证。
    if (seat !== leaderSeat) {
      await expect(tile).toContainText('队员', { timeout: 10_000 });
      // 同一座位的「队员」徽标同步出现在第二名玩家页面（草稿回声）。
      await expect(observerRoom.getSeatTile(seat)).toContainText('队员', { timeout: 10_000 });
    }
  }
  const submit = leaderPage.getByTestId('avalon-nominate-submit');
  await expect(submit).toBeEnabled({ timeout: 10_000 });
  await submit.click();
}

async function castVote(page: Page, ballot: Ballot): Promise<void> {
  const modal = page.getByTestId('avalon-vote-modal');
  await expect(modal).toBeVisible({ timeout: 20_000 });
  await page
    .getByTestId(ballot === 'approve' ? 'avalon-vote-approve' : 'avalon-vote-reject')
    .click();
  await expect(modal.getByText(/已投票/)).toBeVisible({ timeout: 10_000 });
}

interface VoteResultExpectation {
  readonly approved: boolean;
  readonly rejectStreak?: number;
  readonly approveCount: number;
  readonly rejectCount: number;
  /** seat → ballot label for per-seat public-mode row assertions. */
  readonly rows?: ReadonlyMap<number, '赞成' | '反对'>;
}

async function expectAndDismissVoteResult(
  page: Page,
  expectation: VoteResultExpectation,
): Promise<void> {
  const panel = page.getByTestId('avalon-vote-result-panel');
  await expect(panel).toBeVisible({ timeout: 30_000 });
  const banner = expectation.approved
    ? '组队通过'
    : `组队被否决·第 ${expectation.rejectStreak ?? 1} 次`;
  await expect(page.getByTestId('avalon-vote-result-banner')).toHaveText(banner);
  await expect(
    panel.getByText(
      `汇总：赞成 ${expectation.approveCount} · 反对 ${expectation.rejectCount} · 弃权 0`,
      { exact: true },
    ),
  ).toBeVisible();
  if (expectation.rows !== undefined) {
    for (const [seat, label] of expectation.rows) {
      await expect(page.getByTestId(`avalon-vote-result-row-${seat}`)).toContainText(`· ${label}`);
    }
  }
  await page.getByTestId('avalon-vote-result-close').click();
  await expect(panel).toBeHidden({ timeout: 10_000 });
}

async function playQuestCard(page: Page, play: Play, role: RoleName): Promise<void> {
  const modal = page.getByTestId('avalon-quest-modal');
  await expect(modal).toBeVisible({ timeout: 20_000 });
  if (GOOD_ROLES.has(role)) {
    // 好人只有成功牌（D17）：失败牌根本不渲染。
    await expect(page.getByTestId('avalon-quest-fail')).toHaveCount(0);
  }
  await page.getByTestId(play === 'success' ? 'avalon-quest-success' : 'avalon-quest-fail').click();
  await expect(modal.getByText(/已出牌/)).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('avalon-quest-close').click();
  await expect(modal).toBeHidden({ timeout: 10_000 });
}

interface QuestResultExpectation {
  readonly round: number;
  readonly success: boolean;
  readonly successCount: number;
  readonly failCount: number;
}

async function expectAndDismissQuestResult(
  page: Page,
  expectation: QuestResultExpectation,
): Promise<void> {
  const panel = page.getByTestId('avalon-quest-result-panel');
  await expect(panel).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('avalon-quest-result-banner')).toHaveText(
    `第 ${expectation.round} 轮 · ${expectation.success ? '任务成功' : '任务失败'}`,
  );
  await expect(page.getByTestId('avalon-quest-result-counts')).toHaveText(
    `成功牌 ${expectation.successCount} · 失败牌 ${expectation.failCount}`,
  );
  await page.getByTestId('avalon-quest-result-close').click();
  await expect(panel).toBeHidden({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// One full quest round: nominate → vote → (quest) with settlement assertions
// ---------------------------------------------------------------------------

interface QuestRoundScript {
  readonly round: number;
  /** Build the team once the sitting leader is known. */
  readonly teamFor: (leaderSeat: number) => readonly number[];
  /** seat → ballot for all 10 players. */
  readonly ballots: ReadonlyMap<number, Ballot>;
  readonly voteResult: VoteResultExpectation;
  /** The one team member who plays a fail card; everyone else plays success. */
  readonly failerSeat?: number;
  readonly questResult?: QuestResultExpectation;
}

const LEADER_PICK_PATTERN = /点座位盘点选 \d+ 名队员/;
const LADY_PICK_PATTERN = /点座位盘点选一名没当过湖仙的玩家/;

async function runQuestRound(pages: Page[], roles: RoleName[], script: QuestRoundScript) {
  let team: readonly number[] = [];
  const leaderSeat = await test.step(`任务${script.round}：定位队长并组队`, async () => {
    const seat = await findSeatByProbe(pages, LEADER_PICK_PATTERN, '队长组队提示');
    team = script.teamFor(seat);
    await pickTeam(pages, seat, team);
    return seat;
  });

  await test.step(`任务${script.round}：全员公投`, async () => {
    const leaderPage = pages[leaderSeat]!;
    const leaderModal = leaderPage.getByTestId('avalon-vote-modal');
    await expect(leaderModal).toBeVisible({ timeout: 20_000 });
    for (const seat of team) {
      await expect(leaderPage.getByTestId(`avalon-vote-team-${seat}`)).toBeVisible();
    }
    // 提交以草稿为准：第二名玩家页面的投票队伍名单与草稿逐一一致。
    const observerPage = pages[(leaderSeat + 1) % PLAYER_COUNT]!;
    await expect(observerPage.getByTestId('avalon-vote-modal')).toBeVisible({ timeout: 20_000 });
    for (const seat of team) {
      await expect(observerPage.getByTestId(`avalon-vote-team-${seat}`)).toBeVisible();
    }
    for (let seat = 0; seat < pages.length; seat += 1) {
      await castVote(pages[seat]!, script.ballots.get(seat)!);
      if (seat === 0) {
        // PR-B (Avalon count ruling): the first voter's bottom panel
        // reports their own ballot plus the cast count — counts only,
        // never who else voted how.
        const label = script.ballots.get(0) === 'approve' ? '赞成' : '反对';
        await expect(
          pages[0]!.getByText(`你已投：${label}（揭晓前可改票）· 已投 1/${PLAYER_COUNT}`, {
            exact: true,
          }),
        ).toBeVisible({ timeout: 10_000 });
      }
    }
  });

  // Pick a page without a quest modal on top for the strict vote assertions:
  // any non-team page (for a rejected proposal every page qualifies).
  const assertSeat = script.questResult ? pages.findIndex((_, seat) => !team.includes(seat)) : 0;
  await expectAndDismissVoteResult(pages[assertSeat]!, script.voteResult);

  if (script.questResult !== undefined) {
    await test.step(`任务${script.round}：队员出牌`, async () => {
      for (const seat of team) {
        const play: Play = seat === script.failerSeat ? 'fail' : 'success';
        await playQuestCard(pages[seat]!, play, roles[seat]!);
      }
    });
    // 结算面板 6 秒自动关闭：最后一张牌落地后先直奔房主页断言任务结果，
    // 其余页面的面板清理放断言之后（探不到即已自动关闭，不算失败）。
    await expectAndDismissQuestResult(pages[0]!, script.questResult);
    await dismissVoteResultPanels(pages);
    await dismissQuestResultPanels(pages);
  } else {
    await dismissVoteResultPanels(pages);
  }
  return leaderSeat;
}

function allBallots(ballot: Ballot, overrides?: ReadonlyMap<number, Ballot>): Map<number, Ballot> {
  const ballots = new Map<number, Ballot>();
  for (let seat = 0; seat < PLAYER_COUNT; seat += 1) ballots.set(seat, ballot);
  if (overrides !== undefined) for (const [seat, value] of overrides) ballots.set(seat, value);
  return ballots;
}

/** leader + fillers, de-duplicated, truncated to size. */
function buildTeam(leaderSeat: number, size: number, fillers: readonly number[]): number[] {
  const team: number[] = [];
  for (const seat of [leaderSeat, ...fillers]) {
    if (!team.includes(seat)) team.push(seat);
    if (team.length === size) break;
  }
  if (team.length !== size) throw new Error(`buildTeam: cannot fill ${size} seats`);
  return team;
}

// ---------------------------------------------------------------------------
// Lady of the Lake
// ---------------------------------------------------------------------------

interface LadyCheckResult {
  readonly holderSeat: number;
  readonly targetSeat: number;
}

async function runLadyCheck(
  pages: Page[],
  chooseTarget: (holderSeat: number) => number,
  expectedFactionLabel: '是好人' | '是坏人',
  expectedHolderSeat?: number,
): Promise<LadyCheckResult> {
  const holderSeat = await findSeatByProbe(pages, LADY_PICK_PATTERN, '湖仙查验提示');
  if (expectedHolderSeat !== undefined) expect(holderSeat).toBe(expectedHolderSeat);
  const holderPage = pages[holderSeat]!;
  const targetSeat = chooseTarget(holderSeat);
  const targetPage = pages[targetSeat]!;
  // PR-B (lady bystanders): everyone else watches the public process
  // in their bottom panel — first the picking, then who was picked.
  const bystanderSeat = pages.findIndex((_, seat) => seat !== holderSeat && seat !== targetSeat);
  const bystanderPage = pages[bystanderSeat]!;
  await expect(
    bystanderPage.getByText(new RegExp(`${holderSeat + 1} 号 · .+ 正在选择查验对象`)),
  ).toBeVisible({ timeout: 10_000 });

  await new RoomPage(holderPage).getSeatTile(targetSeat).click();
  const confirmModal = holderPage.getByTestId(TESTIDS.alertModal);
  await expect(confirmModal).toBeVisible({ timeout: 10_000 });
  await expect(holderPage.getByTestId(TESTIDS.alertTitle)).toHaveText('湖中仙女查验');
  await holderPage.getByTestId(TESTIDS.alertButton(1)).click();
  await expect(confirmModal).toBeHidden({ timeout: 10_000 });
  await expect(
    bystanderPage.getByText(
      new RegExp(`${holderSeat + 1} 号 · .+ 已选择查验 ${targetSeat + 1} 号 · .+，等待对方确认`),
    ),
  ).toBeVisible({ timeout: 10_000 });

  // 被查验者先在自己界面确认展示，持有人随后才看到结果。
  const ackModal = targetPage.getByTestId('avalon-lady-acknowledge-modal');
  await expect(ackModal).toBeVisible({ timeout: 15_000 });
  await expect(ackModal).toContainText(`${holderSeat + 1} 号`);
  await targetPage.getByTestId('avalon-lady-acknowledge').click();
  await expect(ackModal).toBeHidden({ timeout: 10_000 });

  const resultModal = holderPage.getByTestId('avalon-lady-result-modal');
  await expect(resultModal).toBeVisible({ timeout: 15_000 });
  await expect(holderPage.getByTestId('avalon-lady-result-text')).toHaveText(
    new RegExp(`^${targetSeat + 1} 号 · .+ ${expectedFactionLabel}。$`),
  );
  await holderPage.getByTestId('avalon-lady-result-close').click();
  await expect(resultModal).toBeHidden({ timeout: 10_000 });
  return { holderSeat, targetSeat };
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

test.describe('Avalon full game', () => {
  test('10 名真人一局：夜晚、否决轮转、四轮任务、两次湖仙、保护轮、刺杀翻盘', async ({
    browser,
  }, testInfo) => {
    const fixture = await createPlayerContexts(browser, PLAYER_COUNT);
    const { pages } = fixture;
    const rooms = pages.map((page) => new RoomPage(page));
    const hostPage = pages[0];

    try {
      for (const page of pages) await page.setViewportSize(VIEWPORT);

      await test.step('房主建房并配置 10 人局（公投）', async () => {
        await new HomePage(hostPage).clickCreateRoom('avalon');
        await expect(hostPage.getByTestId('avalon-config')).toBeVisible({ timeout: 15_000 });
        // 人数与否决上限共用同一个步进器按钮名，用人数 testID 的父级作用域消歧。
        const count = hostPage.getByTestId('avalon-player-count');
        await expect(count).toHaveText('6');
        const countControls = hostPage.locator(
          'xpath=//*[@data-testid="avalon-player-count"]/ancestor::div[1]',
        );
        for (let expected = 7; expected <= 10; expected += 1) {
          await countControls.getByRole('button', { name: '增加人数' }).click();
          await expect(count).toHaveText(String(expected));
        }
        await hostPage.getByTestId('avalon-vote-mode-public').click();
        await expect(hostPage.getByText(/公投：结束投票后同时亮票/)).toBeVisible();
        await expect(hostPage.getByText('本局板子（10 人）')).toBeVisible();
        await expect(hostPage.getByText(/任务人数：3-4-4-5-5/)).toBeVisible();
        await hostPage.getByTestId('avalon-config-submit').click();
        await rooms[0]!.waitForReady('host');
      });

      await test.step('10 名真人入房入座', async () => {
        const code = await rooms[0]!.getRoomCode();
        await rooms[0]!.seatAt(0);
        for (let seat = 1; seat < PLAYER_COUNT; seat += 1) {
          await rooms[seat]!.joinViaCode(code);
          await rooms[seat]!.seatAt(seat);
        }
        await expect(hostPage.getByTestId(TESTIDS.roomNextStepButton)).toHaveAccessibleName(
          '下一步：分配角色',
          { timeout: 15_000 },
        );
      });
      await hostPage.screenshot({ path: testInfo.outputPath('avalon-lobby.png') });

      const roles = await test.step('发牌、全员查看身份并捕获各自角色', async () => {
        await rooms[0]!.clickHostManagementActionAndConfirm(
          TESTIDS.assignRolesButton,
          '分配角色？',
        );
        await expect(hostPage.getByText(/位玩家已查看身份，等待剩余玩家/)).toBeVisible({
          timeout: 15_000,
        });
        const captured: RoleName[] = [];
        for (const page of pages) captured.push(await viewAndCaptureRole(page));
        await expect(hostPage.getByTestId(TESTIDS.roomNextStepButton)).toHaveAccessibleName(
          '下一步：开始游戏',
          { timeout: 15_000 },
        );
        return captured;
      });

      // 引擎固定板 AVALON_BOARDS[10]：6 好 4 坏（忠臣×4、无爪牙）。
      const countRole = (name: RoleName) => roles.filter((role) => role === name).length;
      expect(countRole('梅林')).toBe(1);
      expect(countRole('派西维尔')).toBe(1);
      expect(countRole('忠臣')).toBe(4);
      expect(countRole('莫甘娜')).toBe(1);
      expect(countRole('刺客')).toBe(1);
      expect(countRole('莫德雷德')).toBe(1);
      expect(countRole('奥伯伦')).toBe(1);
      expect(countRole('爪牙')).toBe(0);

      const seatOf = (name: RoleName) => roles.indexOf(name);
      const merlinSeat = seatOf('梅林');
      const percivalSeat = seatOf('派西维尔');
      const morganaSeat = seatOf('莫甘娜');
      const assassinSeat = seatOf('刺客');
      const mordredSeat = seatOf('莫德雷德');
      const oberonSeat = seatOf('奥伯伦');
      const evilSeats = roles
        .map((role, seat) => (EVIL_ROLES.has(role) ? seat : -1))
        .filter((seat) => seat >= 0);
      const goodSeats = roles
        .map((role, seat) => (GOOD_ROLES.has(role) ? seat : -1))
        .filter((seat) => seat >= 0);
      expect(evilSeats).toHaveLength(4);
      expect(goodSeats).toHaveLength(6);

      await test.step('房主开始游戏，进入夜晚坏人互认', async () => {
        await rooms[0]!.clickHostManagementActionAndConfirm(TESTIDS.startGameButton, '开始游戏？');
        // 夜晚状态条是进度形态：第1步 / 共3步 · 坏人互认。
        await expect(hostPage.getByText('第1步 / 共3步', { exact: true })).toBeVisible({
          timeout: 15_000,
        });
        await expect(hostPage.getByText('坏人互认', { exact: true }).first()).toBeVisible();
      });

      await test.step('夜晚：奥伯伦全程闭眼（无确认入口、看不见任何同伴）', async () => {
        // 引擎参与者表（getAvalonNightParticipants）与可见性裁剪都把奥伯伦
        // 排除在互认外：他夜里没有确认按钮、没有弹窗，只能等待——这正是
        // 规则口径（不参与、不确认）。「别人也看不见他」由下一拍三人互认的
        // 同伴集合断言（不含奥伯伦）覆盖。
        await expect(pages[oberonSeat]!.getByTestId('avalon-night-info')).toHaveCount(0);
        // PR-B G-5: a non-participant's bottom panel names what they
        // are waiting for instead of going blank.
        await expect(pages[oberonSeat]!.getByText('等待本步玩家确认', { exact: true })).toBeVisible(
          { timeout: 10_000 },
        );
      });

      await test.step('夜晚：其余坏人互认同伴（不含奥伯伦）', async () => {
        const trio: ReadonlyArray<readonly [number, readonly number[]]> = [
          [morganaSeat, [assassinSeat, mordredSeat]],
          [assassinSeat, [morganaSeat, mordredSeat]],
          [mordredSeat, [morganaSeat, assassinSeat]],
        ];
        for (const [seat, peers] of trio) {
          await confirmNightInfo(pages[seat]!, '坏人互认', peers);
        }
        // 忠臣全程没有夜晚确认入口。
        const loyalSeat = goodSeats.find((seat) => seat !== merlinSeat && seat !== percivalSeat)!;
        await expect(pages[loyalSeat]!.getByTestId('avalon-night-info')).toHaveCount(0);
        // PR-B G-5: once step 1 settles, its confirmed participants
        // and the never-participating loyal seat both wait on step 2.
        await expect(
          pages[morganaSeat]!.getByText('等待本步玩家确认', { exact: true }),
        ).toBeVisible({ timeout: 10_000 });
        await expect(pages[loyalSeat]!.getByText('等待本步玩家确认', { exact: true })).toBeVisible({
          timeout: 10_000,
        });
      });

      await test.step('夜晚：梅林看见除莫德雷德外的全部坏人', async () => {
        await confirmNightInfo(pages[merlinSeat]!, '梅林的视野', [
          morganaSeat,
          assassinSeat,
          oberonSeat,
        ]);
      });

      await test.step('夜晚：派西维尔看见梅林与莫甘娜（不辨真假）', async () => {
        await confirmNightInfo(pages[percivalSeat]!, '派西维尔的视野', [merlinSeat, morganaSeat]);
      });

      // ---------------- 任务一：首提案否决、次提案通过、全成功 ----------------
      const leader1 = await runQuestRound(pages, roles, {
        round: 1,
        teamFor: () => [0, 1, 2],
        ballots: allBallots('reject'),
        voteResult: {
          approved: false,
          rejectStreak: 1,
          approveCount: 0,
          rejectCount: 10,
          rows: new Map([[0, '反对']]),
        },
      });

      const leader2 = await runQuestRound(pages, roles, {
        round: 1,
        teamFor: (leaderSeat) => buildTeam(leaderSeat, 3, goodSeats),
        ballots: allBallots(
          'approve',
          new Map<number, Ballot>([
            [evilSeats[0]!, 'reject'],
            [evilSeats[1]!, 'reject'],
          ]),
        ),
        voteResult: {
          approved: true,
          approveCount: 8,
          rejectCount: 2,
          // 赞成行选一名确定投了赞成的座位（两名指定反对者之外任意一人；
          // 不能选新队长——他可能恰好就是指定反对者之一）。
          rows: new Map<number, '赞成' | '反对'>([
            [evilSeats[0]!, '反对'],
            [evilSeats[1]!, '反对'],
            [
              Array.from({ length: PLAYER_COUNT }, (_, seat) => seat).find(
                (seat) => seat !== evilSeats[0] && seat !== evilSeats[1],
              )!,
              '赞成',
            ],
          ]),
        },
        questResult: { round: 1, success: true, successCount: 3, failCount: 0 },
      });
      // 否决后队长顺延一位（轮转断言）。
      expect(leader2).toBe((leader1 + 1) % PLAYER_COUNT);
      await expect(hostPage.getByTestId('avalon-history-summary')).toContainText(
        '任务一 · 成功（成功票 3）',
        { timeout: 15_000 },
      );

      // ---------------- 任务二：一票失败 → 任务失败，其后湖仙一 ----------------
      const failer2 = evilSeats[0]!;
      await runQuestRound(pages, roles, {
        round: 2,
        teamFor: (leaderSeat) => buildTeam(leaderSeat, 4, [failer2, ...goodSeats]),
        ballots: allBallots('approve'),
        voteResult: { approved: true, approveCount: 10, rejectCount: 0 },
        failerSeat: failer2,
        questResult: { round: 2, success: false, successCount: 3, failCount: 1 },
      });
      await expect(hostPage.getByTestId('avalon-history-summary')).toContainText(
        '任务二 · 失败（失败票 1）',
        { timeout: 15_000 },
      );

      const lady1 = await test.step('湖中仙女查验一：查中坏人、令牌转移', async () =>
        runLadyCheck(
          pages,
          (holderSeat) => evilSeats.find((seat) => seat !== holderSeat)!,
          '是坏人',
        ));

      await test.step('对局记录：按任务分 tab 回看已结算轮次', async () => {
        await hostPage.getByTestId('avalon-history-summary').click();
        await expect(hostPage.getByTestId('avalon-history-tab-1')).toBeVisible({
          timeout: 10_000,
        });
        await hostPage.getByTestId('avalon-history-tab-1').click();
        await expect(
          hostPage
            .getByTestId('avalon-history-round-1')
            .getByText('任务一 · 成功（成功票 3 · 失败票 0）', { exact: true }),
        ).toBeVisible();
        await hostPage.getByTestId('avalon-history-tab-2').click();
        await expect(
          hostPage
            .getByTestId('avalon-history-round-2')
            .getByText('任务二 · 失败（成功票 3 · 失败票 1）', { exact: true }),
        ).toBeVisible();
        await hostPage.getByTestId('avalon-history-close').click();
      });

      // ---------------- 任务三：全成功（第二胜），其后湖仙二 ----------------
      await runQuestRound(pages, roles, {
        round: 3,
        teamFor: (leaderSeat) => buildTeam(leaderSeat, 4, goodSeats),
        ballots: allBallots('approve'),
        voteResult: { approved: true, approveCount: 10, rejectCount: 0 },
        questResult: { round: 3, success: true, successCount: 4, failCount: 0 },
      });

      // 令牌转移：第二次的持有人必须就是第一次的被查验者（runLadyCheck 内先断言再动手）。
      await test.step('湖中仙女查验二：新持有人查中好人', async () =>
        runLadyCheck(
          pages,
          (holderSeat) =>
            goodSeats.find(
              (seat) =>
                seat !== holderSeat && seat !== lady1.holderSeat && seat !== lady1.targetSeat,
            )!,
          '是好人',
          lady1.targetSeat,
        ));

      // ---------------- 任务四：保护轮，一票失败仍判成功（第三胜） ----------------
      const failer4 = evilSeats[0]!;
      await runQuestRound(pages, roles, {
        round: 4,
        teamFor: (leaderSeat) => buildTeam(leaderSeat, 5, [failer4, ...goodSeats]),
        ballots: allBallots('approve'),
        voteResult: { approved: true, approveCount: 10, rejectCount: 0 },
        failerSeat: failer4,
        questResult: { round: 4, success: true, successCount: 4, failCount: 1 },
      });

      // ---------------- 刺杀：指认真梅林，坏人翻盘 ----------------
      await test.step('刺杀：刺客指认真梅林', async () => {
        const assassinPage = pages[assassinSeat]!;
        await expect(assassinPage.getByText(/点座位盘点选一名玩家指认其为梅林/)).toBeVisible({
          timeout: 20_000,
        });
        const otherEvilSeat = evilSeats.find(
          (seat) => seat !== assassinSeat && seat !== oberonSeat,
        )!;
        await expect(pages[otherEvilSeat]!.getByText(/坏人商量时间/)).toBeVisible();
        await expect(pages[goodSeats[0]!]!.getByText(/坏人正在商量刺杀目标/)).toBeVisible();
        await new RoomPage(assassinPage).getSeatTile(merlinSeat).click();
        await expect(assassinPage.getByTestId(TESTIDS.alertTitle)).toHaveText('指认梅林');
        // 确认文案只带被指认者名字（不含座号）；指认的座位对不对，由终局
        // 「刺客指认出了梅林 + 坏人获胜」反证——只有真梅林才会命中翻盘。
        await expect(assassinPage.getByTestId(TESTIDS.alertMessage)).toHaveText(
          /确定指认【.+】为梅林？/,
        );
        await assassinPage.getByTestId(TESTIDS.alertButton(1)).click();
      });

      await test.step('终局：坏人获胜、全员身份公开、对局记录收束', async () => {
        for (const page of [hostPage, pages[assassinSeat]!]) {
          const ended = page.getByTestId('avalon-ended');
          await expect(ended).toBeVisible({ timeout: 20_000 });
          await expect(ended.getByText('坏人获胜', { exact: true })).toBeVisible();
          await expect(ended.getByText(/刺客指认出了梅林/)).toBeVisible();
          await expect(ended.getByText(/刺客指认了/)).toBeVisible();
        }
        for (let seat = 0; seat < PLAYER_COUNT; seat += 1) {
          const row = hostPage.getByTestId(`avalon-ended-role-${seat}`);
          await expect(row).toContainText(roles[seat]!);
          await expect(row).toContainText(EVIL_ROLES.has(roles[seat]!) ? '坏人' : '好人');
        }
        await expect(hostPage.getByTestId('avalon-history-summary')).toContainText(
          '本局结束 · 坏人获胜',
        );
        // PR-B G-6: the ended wait lives only in the bottom panel of
        // seated non-host players (shared constant, no full stop);
        // the settlement section no longer repeats it for anyone and
        // the host is never told to wait on themselves.
        await expect(
          pages[1]!.getByText('等待房主操作（再来一局 / 返回大厅）', { exact: true }),
        ).toBeVisible({ timeout: 10_000 });
        await expect(
          pages[1]!.getByText('等待房主操作（再来一局 / 返回大厅）。', { exact: true }),
        ).toHaveCount(0);
        await expect(
          hostPage.getByText('等待房主操作（再来一局 / 返回大厅）', { exact: true }),
        ).toHaveCount(0);
        await hostPage.screenshot({ path: testInfo.outputPath('avalon-ended.png') });
      });
    } finally {
      await closeAll(fixture);
    }
  });
});
