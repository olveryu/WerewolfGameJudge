import { expect, test } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { playDecryptoRound, setupDecryptoGame } from '../helpers/decrypto';
import { closeReviewDialog } from '../helpers/image-sharing';
import { DecryptoRoomPage } from '../pages/DecryptoRoomPage';

test.setTimeout(300_000);

test('six real players finish eight fixed-encryptor rounds, adjudicate a tie and restart', async ({
  browser,
}) => {
  const fixture = await createPlayerContexts(browser, 6);
  try {
    await Promise.all(
      fixture.pages.map((page) => page.setViewportSize({ width: 430, height: 900 })),
    );
    const rooms = fixture.pages.map((page) => new DecryptoRoomPage(page));
    const host = rooms[0]!;
    const members =
      await test.step('create, seat six independent players and choose fixed encryptors', () =>
        setupDecryptoGame(rooms, 'fixed'));
    let lastRound: Awaited<ReturnType<typeof playDecryptoRound>> | undefined;
    for (let round = 1; round <= 8; round++) {
      const previous = lastRound;
      lastRound =
        await test.step(`round ${round}: private clues, team answers and automatic public reveal`, () =>
          playDecryptoRound(rooms, members, round));
      if (previous !== undefined) expect(lastRound.encryptors).toEqual(previous.encryptors);
      if (round < 8) await host.continueRound();
    }
    if (lastRound === undefined) throw new Error('Eight rounds must be played');
    const words = lastRound.words;
    await test.step('eight rounds remain selectable behind one record table per team', async () => {
      await Promise.all(
        fixture.pages.map((page) =>
          expect(page.getByTestId(TESTIDS.decryptoTiebreakInput(0))).toBeVisible({
            timeout: 20_000,
          }),
        ),
      );
      for (const team of ['blue', 'purple'] as const) {
        await host.expectHistory(team, 8);
        await host.expectHistory(team, 1);
        await host.expectHistory(team, 8);
      }
    });
    await test.step('teams submit their guesses and only the host adjudicates', async () => {
      await Promise.all([
        rooms[members.blue[0]!]!.submitTiebreak(words.purple),
        rooms[members.purple[0]!]!.submitTiebreak(words.blue),
      ]);
      await expect(fixture.pages[0].getByTestId(TESTIDS.decryptoSubmitJudgement)).toBeVisible();
      await Promise.all(rooms.slice(1).map((room) => room.expectAwaitingHostJudgement()));
      await host.judge('blue', true);
      await host.judge('purple', true);
      await Promise.all(
        fixture.pages.map((page) =>
          expect(page.getByTestId(TESTIDS.decryptoOutcome)).toHaveText('平局：双方共同获胜'),
        ),
      );
    });
    await test.step('shared review contains both teams and restart keeps the real seats', async () => {
      await host.clickRoomAction(TESTIDS.roomReviewHostAction);
      const review = fixture.pages[0].getByTestId(TESTIDS.roomReviewDialog);
      await expect(review).toBeVisible();
      for (const word of [...words.blue, ...words.purple]) await expect(review).toContainText(word);
      await closeReviewDialog(fixture.pages[0]);
      await fixture.pages[0].getByTestId(TESTIDS.decryptoReturnToLobby).click();
      await Promise.all(rooms.map((room, seat) => room.expectPreservedSeats(seat, 6)));
    });
  } finally {
    await closeAll(fixture);
  }
});

test('four independent real players rotate encryptors without revealing passwords to teammates', async ({
  browser,
}) => {
  const fixture = await createPlayerContexts(browser, 4);
  try {
    const rooms = fixture.pages.map((page) => new DecryptoRoomPage(page));
    const members = await test.step('create the minimum-size rotating game', () =>
      setupDecryptoGame(rooms, 'rotating'));
    const first = await test.step('play the first round with private per-player screens', () =>
      playDecryptoRound(rooms, members, 1));
    await rooms[0]!.continueRound();
    const second = await test.step('play with the next encryptor on each team', () =>
      playDecryptoRound(rooms, members, 2));
    for (const team of ['blue', 'purple'] as const) {
      expect(second.encryptors[team]).not.toBe(first.encryptors[team]);
      expect(second.words[team]).toEqual(first.words[team]);
    }
  } finally {
    await closeAll(fixture);
  }
});
