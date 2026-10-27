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
    const personalLabel = personalAction === 'register' ? '报名上警' : '取消报名';
    const personalButton = this.page.getByTestId(
      personalAction === 'register'
        ? TESTIDS.sheriffRegisterButton
        : TESTIDS.sheriffCancelRegistrationButton,
    );
    const advanceLabel = '结束报名';
    const hostManagementButton = this.page.getByTestId(TESTIDS.roomHostManagementButton);
    await expect(personalButton).toHaveText(personalLabel, { timeout: 15_000 });
    await expect(personalButton).toBeEnabled();
    await expect(hostManagementButton).toHaveAccessibleName('主持管理');
    await this.expectSingleLineButtonLabel(personalButton, personalLabel);
    await this.expectSingleLineButtonLabel(hostManagementButton, '主持管理');
    // Dawn: the host task is an equal choice between advancing the election
    // and announcing last night's result (a self-destruct can end the election).
    const consoleButton = this.page.getByTestId(`${TESTIDS.roomHostTaskCard}-sheriff-advance`);
    const infoButton = this.page.getByTestId(`${TESTIDS.roomHostTaskCard}-last-night-info`);
    await expect(consoleButton).toHaveAccessibleName('结束报名');
    await expect(infoButton).toHaveAccessibleName('昨夜信息');

    const personalBox = await personalButton.boundingBox();
    const hostManagementBox = await hostManagementButton.boundingBox();
    if (personalBox === null || hostManagementBox === null) {
      throw new Error('Host registration dock controls must have layout boxes');
    }
    expect(hostManagementBox.y).toBeGreaterThanOrEqual(personalBox.y + personalBox.height);

    const viewport = this.page.viewportSize();
    if (viewport === null) throw new Error('Room action checks require a viewport');
    for (const button of [personalButton, consoleButton, infoButton, hostManagementButton]) {
      const bounds = await button.boundingBox();
      if (bounds === null) throw new Error('Room action button must have layout bounds');
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      await expect(button).toBeInViewport({ ratio: 1 });
    }
    // Keyboard order follows the card: advance → last-night info → sheet entry.
    await consoleButton.focus();
    await this.page.keyboard.press('Tab');
    await expect(infoButton).toBeFocused();
    await this.page.keyboard.press('Tab');
    await expect(hostManagementButton).toBeFocused();
    const outlineStyle = await hostManagementButton.evaluate(
      (element) => getComputedStyle(element).outlineStyle,
    );
    expect(outlineStyle).not.toBe('none');

    const room = new RoomPage(this.page);
    const hostManagementPanel = await room.openHostManagement();
    const advanceButton = hostManagementPanel.getByTestId(TESTIDS.sheriffAdvanceButton);
    await expect(advanceButton).toHaveAccessibleName(advanceLabel);
    await expect(advanceButton).toBeEnabled();
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

  /** Close registration; the advance action asks the Host to confirm first. */
  async endRegistration(): Promise<void> {
    await new RoomPage(this.page).clickHostManagementActionAndConfirm(
      TESTIDS.sheriffAdvanceButton,
      '结束报名？',
    );
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
    const dots = this.page
      .getByTestId(TESTIDS.sheriffRegisteredSeats)
      .getByTestId(/^sheriff-registered-seat-\d+$/);
    await expect(dots).toHaveCount(displaySeats.length, { timeout: 15_000 });

    const dotIds = await dots.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-testid')),
    );
    const actualOrder = dotIds.map((dotId) => {
      if (dotId === null) {
        throw new Error('Sheriff registered-seat dot has no test id');
      }
      return Number(dotId.replace('sheriff-registered-seat-', '')) + 1;
    });
    expect(actualOrder).toEqual(displaySeats);
  }

  /**
   * Assert the exact voter set grouped under each candidate in a closed
   * round. Display seat numbers in, internal seat indexes in the testids.
   */
  async expectBallotGroups(
    round: 'first' | 'runoff',
    groups: readonly {
      readonly candidate: number;
      readonly voters: readonly number[];
    }[],
  ): Promise<void> {
    for (const group of groups) {
      const tallyGroup = this.page.getByTestId(
        TESTIDS.sheriffTallyGroup(round, group.candidate - 1),
      );
      await expect(tallyGroup).toBeVisible({ timeout: 15_000 });

      const chips = tallyGroup.getByTestId(new RegExp(`^sheriff-ballot-chip-${round}-\\d+$`));
      const chipIds = await chips.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('data-testid')),
      );
      const actualVoters = chipIds
        .map((chipId) => {
          if (chipId === null) {
            throw new Error('Sheriff ballot chip has no test id');
          }
          return Number(chipId.replace(`sheriff-ballot-chip-${round}-`, '')) + 1;
        })
        .sort((first, second) => first - second);
      expect(actualVoters).toEqual([...group.voters].sort((first, second) => first - second));
    }
  }

  async expectWithdrawnSeat(displaySeat: number): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.sheriffWithdrawnSeats)).toContainText(
      `${displaySeat}号`,
      { timeout: 15_000 },
    );
  }

  /** Read the displayed authoritative speaking instruction. */
  async getSpeakingInstruction(): Promise<string> {
    const instruction = this.page.getByTestId(TESTIDS.sheriffSpeakingInstruction);
    await expect(instruction).toBeVisible({ timeout: 15_000 });
    return instruction.innerText();
  }

  /** Assert that this client displays the same authoritative speaking instruction. */
  async expectSpeakingInstruction(instruction: string): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.sheriffSpeakingInstruction)).toHaveText(
      instruction,
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
