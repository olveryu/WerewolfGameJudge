import { expect } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { HomePage } from './HomePage';
import { RoomPage } from './RoomPage';

export type DecryptoTeam = 'blue' | 'purple';
export type DecryptoCode = readonly [number, number, number];

/** Decrypto controls and observations, exclusively through rendered UI. */
export class DecryptoRoomPage extends RoomPage {
  /** Create a room through the shared game configuration. */
  async createGame(count: number, mode: 'fixed' | 'rotating') {
    await new HomePage(this.page).clickCreateRoom('decrypto');
    for (let remaining = 6; remaining > count; remaining--)
      await this.page
        .getByTestId(TESTIDS.gameConfigFieldDecrement('decrypto', 'numberOfPlayers'))
        .click();
    await this.page
      .getByTestId(TESTIDS.gameConfigFieldOption('decrypto', 'encryptorMode', mode))
      .click();
    await this.page.getByTestId(TESTIDS.gameConfigSubmit('decrypto')).click();
    await this.waitForReady();
  }

  /** Read team membership from the mandatory setup dialog. */
  async members(team: DecryptoTeam, count: number): Promise<number[]> {
    const column = this.page.getByTestId(TESTIDS.decryptoTeam(team));
    await expect(column).toBeVisible();
    const seats: number[] = [];
    for (let seat = 0; seat < count; seat++)
      if (await column.getByTestId(TESTIDS.decryptoTeamMember(seat)).count()) seats.push(seat);
    return seats;
  }

  /** Choose one of the rendered options in fixed mode. */
  async chooseEncryptor(team: DecryptoTeam, seat: number) {
    await this.page.getByTestId(TESTIDS.decryptoEncryptorSelect(team)).selectOption(String(seat));
    await expect(this.page.getByTestId(TESTIDS.decryptoEncryptorSelect(team))).toHaveValue(
      String(seat),
    );
  }

  /** Confirm setup only when both teams meet the public gates. */
  async confirmTeams() {
    await this.page.getByTestId(TESTIDS.decryptoConfirmTeams).click();
    await expect(this.page.getByTestId(TESTIDS.decryptoHeading)).toHaveText('填写线索');
  }

  /** Read the visible seat label rather than a random seed or authority state. */
  async encryptor(team: DecryptoTeam): Promise<number> {
    const text = await this.page.getByTestId(TESTIDS.decryptoEncryptor(team)).innerText();
    const match = /出题：(\d+)号/.exec(text);
    if (match === null) throw new Error(`Missing visible ${team} encryptor: ${text}`);
    return Number(match[1]) - 1;
  }

  /** Require the current round and phase before inspecting private controls. */
  async expectRound(round: number, heading = '填写线索', timeout = 5_000) {
    await expect(this.page.getByTestId(TESTIDS.decryptoRound)).toHaveText(`第 ${round} / 8 轮`);
    await expect(this.page.getByTestId(TESTIDS.decryptoHeading)).toHaveText(heading, { timeout });
  }

  /** Read this viewer's four word cards. */
  async keywords(): Promise<string[]> {
    return Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        this.page.getByTestId(TESTIDS.decryptoKeyword(index)).innerText(),
      ),
    );
  }

  /** Assert teammate word synchronization and encryptor-only password access. */
  async expectPrivateView(words: readonly string[], isEncryptor: boolean) {
    for (const [index, word] of words.entries())
      await expect(this.page.getByTestId(TESTIDS.decryptoKeyword(index))).toHaveText(word);
    const code = this.page.getByTestId(TESTIDS.decryptoPrivateCode);
    if (isEncryptor) await expect(code).toBeVisible();
    else await expect(code).toHaveCount(0);
  }

  /** Read the three digits only from the encryptor's authorized password display. */
  async password(): Promise<DecryptoCode> {
    const code = this.page.getByTestId(TESTIDS.decryptoPrivateCode);
    await expect(code).toBeVisible();
    const values = (await code.getAttribute('aria-label'))?.match(/[1-4]/g)?.map(Number);
    if (values?.length !== 3 || new Set(values).size !== 3)
      throw new Error('Password must render three distinct digits');
    return [values[0]!, values[1]!, values[2]!];
  }

  /** Fill all three clues and wait for server acknowledgement. */
  async submitClues(team: DecryptoTeam, round: number) {
    for (let index = 0; index < 3; index++)
      await this.page
        .getByTestId(TESTIDS.decryptoClueInput(index))
        .fill(`${team}-${round}-${index}`);
    await this.page.getByTestId(TESTIDS.decryptoSubmitClues).click();
    await expect(this.page.getByTestId(TESTIDS.decryptoSubmitClues)).toHaveCount(0);
  }

  /** Select a team's sheet with the shared tabs. */
  async showTeam(team: DecryptoTeam) {
    await this.page.getByTestId(TESTIDS.decryptoHistoryTeam(team)).click();
    await expect(this.page.getByTestId(TESTIDS.decryptoTeamPanel(team))).toBeVisible();
  }

  /** Pick numbers through the actual clue picker, never through an API command. */
  async submitGuess(team: DecryptoTeam, kind: 'decode' | 'intercept', guess: DecryptoCode) {
    await this.showTeam(team);
    const panel = this.page.getByTestId(TESTIDS.decryptoTeamPanel(team));
    for (const [index, number] of guess.entries()) {
      await panel.getByTestId(TESTIDS.decryptoGuessDigit(kind, index)).click();
      await this.page.getByTestId(TESTIDS.decryptoNumberOption(number)).click();
    }
    await panel.getByTestId(TESTIDS.decryptoSubmitGuess(kind)).click();
    await expect(panel.getByTestId(TESTIDS.decryptoSubmitGuess(kind))).toHaveCount(0);
  }

  /** Prove the first-round restriction after positively selecting the opposing sheet. */
  async expectNoFirstRoundIntercept(team: DecryptoTeam) {
    await this.showTeam(team);
    const panel = this.page.getByTestId(TESTIDS.decryptoTeamPanel(team));
    await expect(panel).toContainText('第一轮不拦截');
    await expect(panel.getByTestId(TESTIDS.decryptoSubmitGuess('intercept'))).toHaveCount(0);
  }

  /** Require the completed public password on the selected sheet. */
  async expectPublicCode(team: DecryptoTeam, code: DecryptoCode) {
    await this.showTeam(team);
    await expect(this.page.getByTestId(TESTIDS.decryptoRevealedAnswer(team, 'code'))).toContainText(
      code.join(''),
    );
  }

  /** Advance the completed round with the host's visible control. */
  async continueRound() {
    await this.showTeam('purple');
    await this.page
      .getByTestId(TESTIDS.decryptoTeamPanel('purple'))
      .getByTestId(TESTIDS.decryptoContinue)
      .click();
  }

  /** Verify bounded round history, selecting an older entry without stacking tables. */
  async expectHistory(team: DecryptoTeam, round: number) {
    await this.showTeam(team);
    const panel = this.page.getByTestId(TESTIDS.decryptoTeamPanel(team));
    await panel.getByTestId(TESTIDS.decryptoHistoryRounds).click();
    await expect(panel.getByTestId(TESTIDS.decryptoHistoryEntry)).toHaveCount(1);
    await panel.getByTestId(TESTIDS.decryptoHistoryRoundButton(round)).click();
    await expect(panel.getByTestId(TESTIDS.decryptoHistoryCaption)).toContainText(`第 ${round} 轮`);
  }

  /** Submit the four guesses from one team's own browser context. */
  async submitTiebreak(words: readonly string[]) {
    for (const [index, word] of words.entries())
      await this.page.getByTestId(TESTIDS.decryptoTiebreakInput(index)).fill(word);
    await this.page.getByTestId(TESTIDS.decryptoTiebreakSubmit).click();
    await expect(this.page.getByTestId(TESTIDS.decryptoTiebreakSubmit)).toHaveCount(0);
  }

  /** Adjudicate the visible team's answers through the host-only controls. */
  async judge(team: DecryptoTeam, correct: boolean) {
    const submit = this.page.getByTestId(TESTIDS.decryptoSubmitJudgement);
    await expect(submit).toHaveText(`提交${team === 'blue' ? '蓝队' : '紫队'}判定`);
    for (let index = 0; index < 4; index++)
      await this.page.getByTestId(TESTIDS.decryptoJudgement(index)).setChecked(correct);
    await submit.click();
    if (team === 'blue') await expect(submit).toHaveText('提交紫队判定');
    else await expect(this.page.getByTestId(TESTIDS.decryptoOutcome)).toBeVisible();
  }

  /** Check permission only after this viewer receives the adjudication phase. */
  async expectAwaitingHostJudgement() {
    const stage = this.page.getByTestId(TESTIDS.decryptoStage);
    await expect(stage).toContainText('房主正在核对双方加赛答案。');
    await expect(stage.getByTestId(TESTIDS.decryptoSubmitJudgement)).toHaveCount(0);
  }

  /** Require every seat to survive restart and this identity to keep its original seat. */
  async expectPreservedSeats(ownSeat: number, count: number) {
    await this.waitForReady(ownSeat === 0 ? 'host' : 'joiner');
    await this.expectSeatCount(count);
    for (let seat = 0; seat < count; seat++) await this.expectSeatOccupied(seat);
    await expect(this.page.getByTestId(TESTIDS.mySeatBadge)).toHaveText(String(ownSeat + 1));
  }
}
