import { expect, test } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { AvalonConfigPage } from '../pages/AvalonConfigPage';
import { AvalonRoomPage } from '../pages/AvalonRoomPage';
import { HomePage } from '../pages/HomePage';

/**
 * Avalon 首个 e2e：10 真人 context、零 bot，一局覆盖完整流程。
 * 蓝图：~/workspace/avalon-e2e-10p-blueprint.md（引擎事实与定版脚本出处）。
 *
 * 发牌随机：先逐 context 读角色建 seat→role 映射，再按映射动态组队，
 * 不断言任何固定座位的角色。队长与湖仙持有人同样从 UI 实读。
 * 刺杀段有意走翻盘路径：刺客指认真梅林 → 刺杀成功、坏人获胜
 * （断言「三胜 ≠ 好人胜」完整语义，2026-10-15 用户定版）。
 */

test.setTimeout(900_000);

const EVIL_ROLES: ReadonlySet<string> = new Set(['莫甘娜', '刺客', '莫德雷德', '奥伯伦']);
const PLAYER_COUNT = 10;

/** Parse "N 号" seat labels out of a night-info message into 0-based seats. */
function parseSeatsFromNightMessage(message: string): number[] {
  return [...message.matchAll(/(\d+)\s*号/g)].map((match) => Number(match[1]) - 1);
}

function sortedSet(numbers: readonly number[]): number[] {
  return [...new Set(numbers)].sort((a, b) => a - b);
}

test('Avalon 10-player full game: night, viewing, veto, lady x2, protected quest 4, assassination flip', async ({
  browser,
}, testInfo) => {
  const fixture = await createPlayerContexts(browser, PLAYER_COUNT);
  const pages = fixture.pages;
  for (const page of pages) await page.setViewportSize({ width: 1280, height: 900 });
  const rooms = pages.map((page) => new AvalonRoomPage(page));
  const hostPage = pages[0];
  const hostRoom = rooms[0]!;

  try {
    // ------------------------------------------------------------------
    // Setup: host creates a 10-player public-vote room; 9 joiners seat.
    // ------------------------------------------------------------------
    await test.step('create 10p room and seat all players', async () => {
      await new HomePage(hostPage).clickCreateRoom('avalon');
      const config = new AvalonConfigPage(hostPage);
      await config.waitForCreateMode();
      await config.setPlayerCount(PLAYER_COUNT);
      await config.selectPublicVoteMode();
      await config.createRoom();
      await hostRoom.waitForReady('host');

      const roomCode = await hostRoom.getRoomCode();
      await hostRoom.seatAt(0);
      for (let i = 1; i < PLAYER_COUNT; i += 1) {
        await rooms[i]!.joinViaCode(roomCode);
        await rooms[i]!.seatAt(i);
      }
      await expect(hostPage.getByText('等待入座 · 10/10', { exact: true })).toBeVisible({
        timeout: 15_000,
      });
    });

    // ------------------------------------------------------------------
    // Three-stage flow: deal → everyone views → host begins.
    // ------------------------------------------------------------------
    const roleBySeat = new Map<number, string>();
    await test.step('deal roles and capture seat->role map during viewing', async () => {
      await hostRoom.clickHostManagementAction(TESTIDS.startGameButton);

      for (let seat = 0; seat < PLAYER_COUNT; seat += 1) {
        const role = await rooms[seat]!.viewRoleAndCaptureRole();
        roleBySeat.set(seat, role);
        if (seat === 4) {
          await expect(hostPage.getByText('等待全员查看身份 · 5/10', { exact: true })).toBeVisible({
            timeout: 15_000,
          });
        }
      }
      await testInfo.attach('avalon-role-map', {
        body: JSON.stringify([...roleBySeat.entries()]),
        contentType: 'application/json',
      });

      // The 10p board is fixed (AVALON_BOARDS[10]); only the seat
      // assignment is random, so the multiset is a sound assertion.
      const counts = new Map<string, number>();
      for (const role of roleBySeat.values()) counts.set(role, (counts.get(role) ?? 0) + 1);
      expect(counts.get('梅林')).toBe(1);
      expect(counts.get('派西维尔')).toBe(1);
      expect(counts.get('忠臣')).toBe(4);
      expect(counts.get('莫甘娜')).toBe(1);
      expect(counts.get('刺客')).toBe(1);
      expect(counts.get('莫德雷德')).toBe(1);
      expect(counts.get('奥伯伦')).toBe(1);

      await expect(
        hostPage.getByText('全员已查看身份，等待房主开始游戏', { exact: true }),
      ).toBeVisible({ timeout: 15_000 });
      await hostRoom.clickHostManagementAction(TESTIDS.startGameButton);
    });

    const seatOfRole = (role: string): number => {
      for (const [seat, name] of roleBySeat) if (name === role) return seat;
      throw new Error(`role ${role} not found in captured map`);
    };
    const goodSeats = [...roleBySeat.entries()]
      .filter(([, role]) => !EVIL_ROLES.has(role))
      .map(([seat]) => seat)
      .sort((a, b) => a - b);
    const evilSeats = [...roleBySeat.entries()]
      .filter(([, role]) => EVIL_ROLES.has(role))
      .map(([seat]) => seat)
      .sort((a, b) => a - b);
    const merlinSeat = seatOfRole('梅林');
    const percivalSeat = seatOfRole('派西维尔');
    const morganaSeat = seatOfRole('莫甘娜');
    const assassinSeat = seatOfRole('刺客');
    const mordredSeat = seatOfRole('莫德雷德');
    const oberonSeat = seatOfRole('奥伯伦');

    // ------------------------------------------------------------------
    // Night: evil reveal (Oberon shut out) → Merlin → Percival.
    // ------------------------------------------------------------------
    await test.step('night steps with per-step visibility assertions', async () => {
      // Step 1 (evilReveal): only Morgana / Assassin / Mordred participate.
      await expect(rooms[morganaSeat]!.nightInfoButton()).toBeVisible({ timeout: 20_000 });
      // Oberon never participates (闭眼): no confirm entry on his page,
      // and a loyal servant has none either during this step.
      await expect(rooms[oberonSeat]!.nightInfoButton()).toHaveCount(0);
      await expect(rooms[goodSeats[0]!]!.nightInfoButton()).toHaveCount(0);

      const evilPeerExpectations = new Map<number, number[]>([
        [morganaSeat, [assassinSeat, mordredSeat]],
        [assassinSeat, [morganaSeat, mordredSeat]],
        [mordredSeat, [morganaSeat, assassinSeat]],
      ]);
      for (const [seat, expectedPeers] of evilPeerExpectations) {
        const message = await rooms[seat]!.confirmNightInfo();
        expect(sortedSet(parseSeatsFromNightMessage(message))).toEqual(sortedSet(expectedPeers));
      }

      // Step 2 (merlinReveal): Merlin sees Morgana + Assassin + Oberon,
      // never Mordred (set equality covers the exclusion).
      const merlinMessage = await rooms[merlinSeat]!.confirmNightInfo();
      expect(sortedSet(parseSeatsFromNightMessage(merlinMessage))).toEqual(
        sortedSet([morganaSeat, assassinSeat, oberonSeat]),
      );

      // Step 3 (percivalReveal): Percival sees Merlin + Morgana.
      const percivalMessage = await rooms[percivalSeat]!.confirmNightInfo();
      expect(sortedSet(parseSeatsFromNightMessage(percivalMessage))).toEqual(
        sortedSet([merlinSeat, morganaSeat]),
      );

      await expect(hostPage.getByText('第 1 轮 · 队长组队中', { exact: true })).toBeVisible({
        timeout: 15_000,
      });
    });

    // ------------------------------------------------------------------
    // Shared drivers (leader / vote / quest / lady read live UI state).
    // ------------------------------------------------------------------
    const findLeaderSeat = async (): Promise<number> => {
      for (let seat = 0; seat < PLAYER_COUNT; seat += 1) {
        const isLeader = await pages[seat]!.getByText('点座位盘点选')
          .waitFor({ state: 'visible', timeout: 1_000 })
          .then(() => true)
          .catch(() => false);
        if (isLeader) return seat;
      }
      throw new Error('findLeaderSeat: no page shows the leader nomination prompt');
    };

    const castAllBallots = async (ballotBySeat: ReadonlyMap<number, 'approve' | 'reject'>) => {
      const seats = [...ballotBySeat.keys()].sort((a, b) => a - b);
      for (const seat of seats) {
        if (seat === seats[seats.length - 1]) {
          // Reveal discipline: no result panel exists before the last ballot.
          await expect(hostRoom.voteResultPanel()).toHaveCount(0);
        }
        await rooms[seat]!.castBallot(ballotBySeat.get(seat)!);
      }
    };

    const proposeAndVote = async (options: {
      team: readonly number[];
      ballotBySeat: ReadonlyMap<number, 'approve' | 'reject'>;
      banner: string;
      counts: string;
    }): Promise<number> => {
      const leaderSeat = await findLeaderSeat();
      const leaderRoom = rooms[leaderSeat]!;
      for (const seat of options.team) await leaderRoom.tapSeat(seat);
      await leaderRoom.expectSeatBadge(options.team[0]!, '队员');
      await leaderRoom.submitTeam();
      await castAllBallots(options.ballotBySeat);
      await hostRoom.expectVoteResult(options.banner, options.counts);
      for (const room of rooms) await room.closeVoteResultPanel();
      return leaderSeat;
    };

    const runQuest = async (options: {
      team: readonly number[];
      failSeats: ReadonlySet<number>;
      banner: string;
      counts: string;
    }) => {
      for (let i = 0; i < options.team.length; i += 1) {
        const seat = options.team[i]!;
        if (i === options.team.length - 1) {
          // Reveal discipline: no result panel exists before the last card.
          await expect(hostRoom.questResultPanel()).toHaveCount(0);
        }
        await rooms[seat]!.playQuestCard(options.failSeats.has(seat) ? 'fail' : 'success');
      }
      await hostRoom.expectQuestResult(options.banner, options.counts);
      for (const room of rooms) await room.closeQuestResultPanel();
    };

    const findLadyHolderSeat = async (): Promise<number> => {
      for (let seat = 0; seat < PLAYER_COUNT; seat += 1) {
        const isHolder = await pages[seat]!.getByText('点座位盘点选一名没当过湖仙的玩家进行查验')
          .waitFor({ state: 'visible', timeout: 1_000 })
          .then(() => true)
          .catch(() => false);
        if (isHolder) return seat;
      }
      throw new Error('findLadyHolderSeat: no page shows the lady holder prompt');
    };

    const runLadyCheck = async (options: {
      pickTarget: (holderSeat: number) => number;
      expectedFactionText: '是好人' | '是坏人';
    }): Promise<{ holderSeat: number; targetSeat: number }> => {
      const holderSeat = await findLadyHolderSeat();
      const targetSeat = options.pickTarget(holderSeat);
      await rooms[holderSeat]!.tapSeat(targetSeat);
      const confirmText = await rooms[holderSeat]!.confirmLadyCheck();
      expect(confirmText).toContain(`${targetSeat + 1} 号`);
      await rooms[targetSeat]!.acknowledgeLadyCheck();
      const resultText = await rooms[holderSeat]!.readLadyResult();
      expect(resultText).toContain(`${targetSeat + 1} 号`);
      expect(resultText).toContain(options.expectedFactionText);
      return { holderSeat, targetSeat };
    };

    const allApprove = (): ReadonlyMap<number, 'approve' | 'reject'> =>
      new Map([...roleBySeat.keys()].map((seat) => [seat, 'approve' as const]));

    // ------------------------------------------------------------------
    // Quest 1 (3p): one veto (leader rotates), then pass, all success.
    // ------------------------------------------------------------------
    let firstLeader = -1;
    await test.step('quest 1: vetoed once, then approved and succeeds', async () => {
      const team = goodSeats.slice(0, 3);
      const rejectBallots = new Map<number, 'approve' | 'reject'>(
        [...roleBySeat.keys()].map((seat) => [seat, seat < 6 ? 'reject' : 'approve']),
      );
      firstLeader = await proposeAndVote({
        team,
        ballotBySeat: rejectBallots,
        banner: '组队被否决·第 1 次',
        counts: '赞成 4 · 反对 6 · 弃权 0',
      });

      const secondLeader = await findLeaderSeat();
      expect(secondLeader).not.toBe(firstLeader);
      // A non-leader page names the current leader in its waiting message.
      const observerSeat = (secondLeader + 1) % PLAYER_COUNT;
      await expect(
        pages[observerSeat]!.getByText(`等待队长组队（${secondLeader + 1} 号座位）`),
      ).toBeVisible({ timeout: 10_000 });

      const leaderRoom = rooms[secondLeader]!;
      for (const seat of team) await leaderRoom.tapSeat(seat);
      await leaderRoom.submitTeam();
      await castAllBallots(allApprove());
      await hostRoom.expectVoteResult('组队通过', '赞成 10 · 反对 0 · 弃权 0');
      for (const room of rooms) await room.closeVoteResultPanel();

      await runQuest({
        team,
        failSeats: new Set(),
        banner: '第 1 轮 · 任务成功',
        counts: '成功牌 3 · 失败牌 0',
      });
    });

    // ------------------------------------------------------------------
    // Quest 2 (4p): one evil member plays fail → quest fails. Lady #1.
    // ------------------------------------------------------------------
    let ladyFirst: { holderSeat: number; targetSeat: number } | null = null;
    await test.step('quest 2: single fail sinks it, then lady check #1', async () => {
      const evilOnTeam = evilSeats[0]!;
      const team = [...goodSeats.slice(0, 3), evilOnTeam];
      await proposeAndVote({
        team,
        ballotBySeat: allApprove(),
        banner: '组队通过',
        counts: '赞成 10 · 反对 0 · 弃权 0',
      });
      await runQuest({
        team,
        failSeats: new Set([evilOnTeam]),
        banner: '第 2 轮 · 任务失败',
        counts: '成功牌 3 · 失败牌 1',
      });

      ladyFirst = await runLadyCheck({
        pickTarget: (holderSeat) => goodSeats.find((seat) => seat !== holderSeat)!,
        expectedFactionText: '是好人',
      });
    });

    // ------------------------------------------------------------------
    // Quest 3 (4p): all success. Lady #2: token passed to check #1 target.
    // ------------------------------------------------------------------
    await test.step('quest 3: succeeds, then lady check #2 with passed token', async () => {
      const team = goodSeats.slice(0, 4);
      await proposeAndVote({
        team,
        ballotBySeat: allApprove(),
        banner: '组队通过',
        counts: '赞成 10 · 反对 0 · 弃权 0',
      });
      await runQuest({
        team,
        failSeats: new Set(),
        banner: '第 3 轮 · 任务成功',
        counts: '成功牌 4 · 失败牌 0',
      });

      const ladySecond = await runLadyCheck({
        pickTarget: (holderSeat) =>
          evilSeats.find((seat) => seat !== holderSeat && seat !== ladyFirst!.holderSeat)!,
        expectedFactionText: '是坏人',
      });
      // The token passed: check #2's holder is check #1's target.
      expect(ladySecond.holderSeat).toBe(ladyFirst!.targetSeat);
    });

    // ------------------------------------------------------------------
    // Quest 4 (5p, protected round): exactly one fail card still succeeds
    // (needs 2 fails at 7+ players) → third success → straight to the
    // assassination, with NO third lady check.
    // ------------------------------------------------------------------
    await test.step('quest 4: one fail is not enough in the protected round', async () => {
      const evilOnTeam = evilSeats[0]!;
      const team = [...goodSeats.slice(0, 4), evilOnTeam];
      await proposeAndVote({
        team,
        ballotBySeat: allApprove(),
        banner: '组队通过',
        counts: '赞成 10 · 反对 0 · 弃权 0',
      });
      await runQuest({
        team,
        failSeats: new Set([evilOnTeam]),
        banner: '第 4 轮 · 任务成功',
        counts: '成功牌 4 · 失败牌 1',
      });

      // Straight to assassination: no lady stage after the third success.
      await expect(hostPage.getByText('刺杀阶段', { exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        pages[ladyFirst!.targetSeat]!.getByText('点座位盘点选一名没当过湖仙的玩家进行查验'),
      ).toHaveCount(0);
      for (const page of pages) {
        await expect(page.getByTestId('avalon-lady-acknowledge-modal')).toHaveCount(0);
      }
    });

    // ------------------------------------------------------------------
    // Assassination: the assassin names the real Merlin → evil flips
    // the game despite three successful quests (deliberate flip path).
    // ------------------------------------------------------------------
    await test.step('assassination: assassin finds Merlin, evil wins', async () => {
      await rooms[assassinSeat]!.tapSeat(merlinSeat);
      await rooms[assassinSeat]!.confirmAccusation();

      const ended = hostPage.getByTestId('avalon-ended');
      await expect(ended).toBeVisible({ timeout: 20_000 });
      await expect(ended.getByText('坏人获胜', { exact: true })).toBeVisible();
      await expect(ended.getByText('刺客指认出了梅林', { exact: true })).toBeVisible();
      await expect(hostPage.getByTestId(`avalon-ended-role-${merlinSeat}`)).toContainText('梅林');
      await expect(hostPage.getByTestId(`avalon-ended-role-${assassinSeat}`)).toContainText('刺客');
      await hostPage.screenshot({ path: testInfo.outputPath('avalon-ended.png') });
    });
  } finally {
    await closeAll(fixture);
  }
});
