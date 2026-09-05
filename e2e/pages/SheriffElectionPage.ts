import { expect, type Locator, type Page } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { RoomPage } from './RoomPage';

/** Page Object for the server-authoritative sheriff-election panel. */
export class SheriffElectionPage {
  constructor(private readonly page: Page) {}

  private get panel() {
    return this.page.getByTestId(TESTIDS.sheriffElectionPanel);
  }

  async waitForPhase(phaseTitle: string): Promise<void> {
    await expect(this.panel).toBeVisible({ timeout: 15_000 });
    await expect(this.page.getByTestId(TESTIDS.sheriffElectionPhase)).toHaveText(phaseTitle, {
      timeout: 15_000,
    });
  }

  async expectWideInspector(): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.sheriffElectionHud)).toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.sheriffElectionInspector)).toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.sheriffElectionSheet)).not.toBeVisible();
  }

  async openCompactDetails(): Promise<void> {
    const hud = this.page.getByTestId(TESTIDS.sheriffElectionHud);
    await expect(hud).toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.sheriffElectionInspector)).not.toBeVisible();
    await hud.click();
    await expect(this.page.getByTestId(TESTIDS.sheriffElectionSheet)).toBeVisible();
  }

  async closeCompactDetails(): Promise<void> {
    await this.page.getByTestId(TESTIDS.sheriffDetailsCloseButton).click();
    await expect(this.page.getByTestId(TESTIDS.sheriffElectionSheet)).not.toBeVisible();
  }

  /** Assert the Host's personal registration action and distinct phase-advance command. */
  async expectHostRegistrationActions(personalAction: 'register' | 'cancel'): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.audioWaitingButton)).not.toBeVisible({
      timeout: 30_000,
    });
    const personalLabel = personalAction === 'register' ? '报名上警' : '取消报名';
    const personalButton = this.page.getByTestId(
      personalAction === 'register'
        ? TESTIDS.sheriffRegisterButton
        : TESTIDS.sheriffCancelRegistrationButton,
    );
    const advanceLabel = '结束报名';
    const hostManagementButton = this.page.getByTestId(TESTIDS.roomHostManagementButton);
    await expect(personalButton).toHaveText(personalLabel, { timeout: 15_000 });
    await expect(hostManagementButton).toHaveAccessibleName('主持管理，待处理：结束报名');
    await this.expectSingleLineButtonLabel(personalButton, personalLabel);
    await this.expectSingleLineButtonLabel(hostManagementButton, '主持管理');
    await this.expectSingleLineButtonLabel(hostManagementButton, '待处理：结束报名');

    const personalBox = await personalButton.boundingBox();
    const hostManagementBox = await hostManagementButton.boundingBox();
    if (personalBox === null || hostManagementBox === null) {
      throw new Error('Host registration dock controls must have layout boxes');
    }
    expect(hostManagementBox.y).toBeGreaterThanOrEqual(personalBox.y + personalBox.height);

    const room = new RoomPage(this.page);
    const hostManagementPanel = await room.openHostManagement();
    const advanceButton = hostManagementPanel.getByTestId(TESTIDS.sheriffAdvanceButton);
    await expect(advanceButton).toHaveAccessibleName(advanceLabel);
    await room.closeHostManagement();
  }

  private async expectSingleLineButtonLabel(button: Locator, label: string): Promise<void> {
    const renderedLineCount = await button.evaluate((element, expectedLabel) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let textNode = walker.nextNode();
      while (textNode !== null && textNode.textContent !== expectedLabel) {
        textNode = walker.nextNode();
      }
      if (textNode === null) throw new Error(`Button text node not found: ${expectedLabel}`);

      const range = document.createRange();
      range.selectNodeContents(textNode);
      return range.getClientRects().length;
    }, label);
    expect(renderedLineCount).toBe(1);
  }

  async register(): Promise<void> {
    const button = this.page.getByTestId(TESTIDS.sheriffRegisterButton);
    await button.click();
    await expect(button).not.toBeVisible({ timeout: 15_000 });
  }

  async withdraw(): Promise<void> {
    const button = this.page.getByTestId(TESTIDS.sheriffWithdrawButton);
    await button.click();
    await expect(button).not.toBeVisible({ timeout: 15_000 });
  }

  async advance(): Promise<void> {
    await new RoomPage(this.page).clickHostManagementAction(TESTIDS.sheriffAdvanceButton);
  }

  async voteFor(candidateSeat: number): Promise<void> {
    const candidateButton = this.page.getByTestId(TESTIDS.sheriffCandidateButton(candidateSeat));
    await candidateButton.click();
    await expect(candidateButton).toHaveAttribute('aria-checked', 'true', { timeout: 15_000 });
    await expect(this.panel).toContainText(`已投给 ${candidateSeat + 1}号`, {
      timeout: 15_000,
    });
  }

  /** Assert that candidate identities remain private while registration is open. */
  async expectCandidateRecordsHidden(): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.sheriffRegisteredSeats)).not.toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.sheriffWithdrawnSeats)).not.toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.sheriffActiveCandidateSeats)).not.toBeVisible();
  }

  async expectRegisteredOrder(displaySeats: readonly number[]): Promise<void> {
    const registeredText = await this.page
      .getByTestId(TESTIDS.sheriffRegisteredSeats)
      .textContent();
    if (registeredText === null) {
      throw new Error('Sheriff registered-seat record has no text');
    }

    let previousPosition = -1;
    for (const displaySeat of displaySeats) {
      const currentPosition = registeredText.indexOf(`${displaySeat}号`, previousPosition + 1);
      expect(
        currentPosition,
        `Expected ${displaySeat}号 after index ${previousPosition}`,
      ).toBeGreaterThan(previousPosition);
      previousPosition = currentPosition;
    }
  }

  async expectWithdrawnSeat(displaySeat: number): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.sheriffWithdrawnSeats)).toContainText(
      `${displaySeat}号`,
      { timeout: 15_000 },
    );
  }

  /** Read the displayed authoritative speaking order as 1-based seat numbers. */
  async getSpeakingOrder(): Promise<readonly number[]> {
    const order = this.page.getByTestId(TESTIDS.sheriffSpeakingOrder);
    await expect(order).toBeVisible({ timeout: 15_000 });
    const text = await order.textContent();
    if (text === null) throw new Error('Sheriff speaking-order record has no text');
    const displaySeats = [...text.matchAll(/(\d+)号/g)].map((match) => Number(match[1]));
    if (displaySeats.length === 0) {
      throw new Error(`Sheriff speaking-order record contains no seats: ${text}`);
    }
    return displaySeats;
  }

  /** Assert that this client displays the exact authoritative speaking order. */
  async expectSpeakingOrder(displaySeats: readonly number[]): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.sheriffSpeakingOrder)).toHaveText(
      displaySeats.map((seat) => `${seat}号`).join(' · '),
      { timeout: 15_000 },
    );
  }

  async expectVoteProgress(progress: string): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.sheriffVoteProgress)).toHaveText(progress, {
      timeout: 15_000,
    });
  }

  async expectCanVote(canVote: boolean): Promise<void> {
    const abstainButton = this.page.getByTestId(TESTIDS.sheriffAbstainButton);
    if (canVote) {
      await expect(abstainButton).toBeVisible({ timeout: 15_000 });
      return;
    }
    await expect(abstainButton).not.toBeVisible();
  }

  async expectOpenBallotsHidden(): Promise<void> {
    await expect(this.panel).not.toContainText('→');
    await expect(this.page.getByTestId(TESTIDS.sheriffCompletedRound('first'))).not.toBeVisible();
  }

  async expectClosedRound(
    round: 'first' | 'runoff',
    expectedText: readonly string[],
  ): Promise<void> {
    const roundRecord = this.page.getByTestId(TESTIDS.sheriffCompletedRound(round));
    await expect(roundRecord).toBeVisible({ timeout: 15_000 });
    for (const text of expectedText) {
      await expect(roundRecord).toContainText(text);
    }
  }

  async expectResult(expectedText: string): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.sheriffElectionResult)).toContainText(expectedText, {
      timeout: 15_000,
    });
  }
}
