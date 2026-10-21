import { expect, test } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import { setupNPlayerGame } from '../helpers/multi-player';
import { waitForHostAudioAck } from '../helpers/night-driver';
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
    // The phase flip queued the night-end announcement in the same
    // state write, so it is still playing now — and while audio plays
    // the host's main action is in its blocked form (no
    // room-next-step-button), so the registration-actions assertion
    // below would time out. Wait for the host's audio ack (the
    // server-side gate lifting) before asserting, like a host who
    // waits out the announcement.
    await waitForHostAudioAck(setup.hostPage);
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

    await hostElection.endRegistration();
    await Promise.all(elections.map((election) => election.waitForPhase('竞选发言')));
    await Promise.all(elections.map((election) => election.expectRegisteredOrder([3, 1, 2])));
    const candidateSpeakingInstruction = await hostElection.getSpeakingInstruction();
    expect(candidateSpeakingInstruction).toMatch(/^从 [123]号开始，(顺时针|逆时针)发言$/);
    await Promise.all(
      elections.map((election) => election.expectSpeakingInstruction(candidateSpeakingInstruction)),
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

    // No manual publication exists any more: the last ballot arms
    // the 5s settle countdown and the round publishes itself on
    // expiry (the Host client drives progression at the deadline).
    await Promise.all(elections.map((election) => election.waitForPhase('平票发言')));
    await Promise.all(
      elections.map(async (election) => {
        await election.expectClosedRound('first', ['1号', '1 票', '2号']);
        await election.expectBallotGroups('first', [
          { candidate: 1, voters: [4] },
          { candidate: 2, voters: [5] },
        ]);
      }),
    );
    const runoffSpeakingInstruction = await hostElection.getSpeakingInstruction();
    expect(runoffSpeakingInstruction).toMatch(/^从 [12]号开始，(顺时针|逆时针)发言$/);
    await Promise.all(
      elections.map((election) => election.expectSpeakingInstruction(runoffSpeakingInstruction)),
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

    // Same automatic publication as the first round: wait for the
    // armed countdown to expire instead of clicking a close button.
    await Promise.all(elections.map((election) => election.waitForPhase('竞选结束')));
    await Promise.all(
      elections.map(async (election) => {
        await election.expectClosedRound('first', ['1号', '1 票', '2号']);
        await election.expectBallotGroups('first', [
          { candidate: 1, voters: [4] },
          { candidate: 2, voters: [5] },
        ]);
        await election.expectClosedRound('runoff', ['1号', '3 票', '2号', '0 票']);
        await election.expectBallotGroups('runoff', [
          { candidate: 1, voters: [3, 4, 5] },
          { candidate: 2, voters: [] },
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
