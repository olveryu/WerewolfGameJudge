import { expect, test } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import { setupNPlayerGame } from '../helpers/multi-player';
import { runNightFlowLoop } from '../pages/NightFlowPage';
import { RoomPage } from '../pages/RoomPage';
import { SheriffElectionPage } from '../pages/SheriffElectionPage';

test.setTimeout(300_000);

test('first-day sheriff election resolves a tie with public authoritative history', async ({
  browser,
}, testInfo) => {
  const setup = await setupNPlayerGame(browser, {
    playerCount: 5,
    configureTemplate: async (config) =>
      config.configureCustomTemplate({ wolves: 1, villagers: 4 }),
    isSheriffElectionEnabled: true,
  });

  try {
    const pages = setup.fixture.pages;
    const hostElection = new SheriffElectionPage(pages[0]);
    const secondElection = new SheriffElectionPage(pages[1]!);
    const thirdElection = new SheriffElectionPage(pages[2]!);
    const fourthElection = new SheriffElectionPage(pages[3]!);
    const fifthElection = new SheriffElectionPage(pages[4]!);
    const elections = [hostElection, secondElection, thirdElection, fourthElection, fifthElection];
    const hostRoom = new RoomPage(setup.hostPage);

    const nightResult = await runNightFlowLoop(pages, testInfo, {
      maxIterations: 100,
      screenshotInterval: 15,
    });
    expect(nightResult.resultText).toBe('警长竞选已开始');
    await Promise.all(elections.map((election) => election.waitForPhase('报名上警')));

    await hostElection.expectWideInspector();
    await hostElection.expectHostRegistrationActions('register');
    const desktopViewport = setup.hostPage.viewportSize();
    if (desktopViewport === null) throw new Error('Sheriff E2E requires a viewport');
    await setup.hostPage.setViewportSize({ width: 320, height: 640 });
    await setup.hostPage.reload();
    await hostElection.expectHostRegistrationActions('register');
    await hostRoom.screenshot(testInfo, 'sheriff-election-host-registration-dock-320.png');
    await setup.hostPage.setViewportSize({ width: 390, height: 844 });
    await setup.hostPage.reload();
    await hostElection.expectHostRegistrationActions('register');
    await hostRoom.screenshot(testInfo, 'sheriff-election-host-registration-dock.png');
    await hostElection.openCompactDetails();
    await hostRoom.screenshot(testInfo, 'sheriff-election-compact.png');
    await hostElection.closeCompactDetails();
    await setup.hostPage.setViewportSize(desktopViewport);
    await setup.hostPage.reload();
    await hostElection.waitForPhase('报名上警');
    await hostElection.expectWideInspector();

    await thirdElection.register();
    await hostElection.register();
    await hostElection.expectHostRegistrationActions('cancel');
    await secondElection.register();
    await Promise.all(elections.map((election) => election.expectCandidateRecordsHidden()));

    await hostElection.advance();
    await Promise.all(elections.map((election) => election.waitForPhase('竞选发言')));
    await Promise.all(elections.map((election) => election.expectRegisteredOrder([3, 1, 2])));
    const candidateSpeakingOrder = await hostElection.getSpeakingOrder();
    expect([...candidateSpeakingOrder].sort((left, right) => left - right)).toEqual([1, 2, 3]);
    await Promise.all(
      elections.map((election) => election.expectSpeakingOrder(candidateSpeakingOrder)),
    );

    await thirdElection.withdraw();
    await Promise.all(elections.map((election) => election.expectWithdrawnSeat(3)));

    await hostElection.advance();
    await Promise.all(elections.map((election) => election.waitForPhase('首轮投票')));

    await hostElection.expectCanVote(false);
    await secondElection.expectCanVote(false);
    await thirdElection.expectCanVote(false);
    await fourthElection.expectCanVote(true);
    await fifthElection.expectCanVote(true);

    await fourthElection.voteFor(1);
    await hostElection.expectVoteProgress('1/2 已提交');
    await fourthElection.voteFor(0);
    await hostElection.expectVoteProgress('1/2 已提交');
    await hostElection.expectOpenBallotsHidden();

    await fifthElection.voteFor(1);
    await hostElection.expectVoteProgress('2/2 已提交');
    await hostElection.expectOpenBallotsHidden();
    await hostElection.advance();

    await Promise.all(elections.map((election) => election.waitForPhase('平票发言')));
    await Promise.all(
      elections.map((election) =>
        election.expectClosedRound('first', ['1号', '1票', '2号', '4号', '→', '5号']),
      ),
    );
    const runoffSpeakingOrder = await hostElection.getSpeakingOrder();
    expect([...runoffSpeakingOrder].sort((left, right) => left - right)).toEqual([1, 2]);
    await Promise.all(
      elections.map((election) => election.expectSpeakingOrder(runoffSpeakingOrder)),
    );
    await hostElection.advance();
    await Promise.all(elections.map((election) => election.waitForPhase('平票投票')));

    await hostElection.expectCanVote(false);
    await secondElection.expectCanVote(false);
    await thirdElection.expectCanVote(true);
    await fourthElection.expectCanVote(true);
    await fifthElection.expectCanVote(true);

    await thirdElection.voteFor(0);
    await fourthElection.voteFor(0);
    await fifthElection.voteFor(0);
    await hostElection.expectVoteProgress('3/3 已提交');
    await hostElection.advance();

    await Promise.all(elections.map((election) => election.waitForPhase('竞选结束')));
    await Promise.all(
      elections.map(async (election) => {
        await election.expectClosedRound('first', ['1号', '1票', '2号', '4号', '→', '5号']);
        await election.expectClosedRound('runoff', [
          '1号',
          '3票',
          '2号',
          '0票',
          '3号',
          '4号',
          '5号',
        ]);
        await election.expectResult('1号');
      }),
    );

    expect(await hostRoom.isLastNightInfoVisible()).toBe(true);
    await hostRoom.screenshot(testInfo, 'sheriff-election-completed.png');
  } finally {
    await closeAll(setup.fixture);
  }
});
