import { expect, type Locator, type Page } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { confirmAlert } from '../helpers/alerts';
import { anySeatTestId } from '../helpers/ui';
import { RoomPage } from './RoomPage';

const REGISTERED_SEAT_DOT = anySeatTestId(TESTIDS.sheriffRegisteredSeatDot);

/** Page Object for the server-authoritative sheriff-election panel. */
export class SheriffElectionPage {
  constructor(private readonly page: Page) {}

  private get panel() {
    return this.page.getByTestId(TESTIDS.sheriffElectionPanel);
  }

  async waitForPhase(phaseTitle: string): Promise<void> {
    const hudPhase =
      phaseTitle === '报名上警'
        ? '白天 · 警长竞选 · 报名进行中'
        : phaseTitle === '竞选结束'
          ? /^(?:白天 · )?警长竞选 · (?:\d+号 当选警长|本局没有警长)$/
          : `白天 · 警长竞选 · ${phaseTitle}${phaseTitle.endsWith('投票') ? '中' : ''}`;
    await expect(this.page.getByTestId(TESTIDS.sheriffElectionHudPhase)).toHaveText(hudPhase, {
      timeout: 15_000,
    });
  }

  async expectDetailsClosed(): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.sheriffElectionHud)).toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.sheriffElectionDialog)).not.toBeVisible();
  }

  async openDetails(): Promise<void> {
    const hud = this.page.getByTestId(TESTIDS.sheriffElectionHud);
    await expect(hud).toBeVisible();
    const detailsCard = this.page.getByTestId(TESTIDS.sheriffDetailsButton);
    await expect(detailsCard).toHaveAttribute('data-card-category', 'resource');
    await detailsCard.click();
    await expect(this.page.getByTestId(TESTIDS.sheriffElectionDialog)).toBeVisible();
  }

  async closeDetails(): Promise<void> {
    if (!(await this.page.getByTestId(TESTIDS.sheriffElectionDialog).isVisible())) return;
    await this.page.getByTestId(TESTIDS.roomDialogCloseButton).click();
    await expect(this.page.getByTestId(TESTIDS.sheriffElectionDialog)).not.toBeVisible();
  }

  private async ensureDetailsOpen(): Promise<void> {
    if (!(await this.page.getByTestId(TESTIDS.sheriffElectionDialog).isVisible())) {
      await this.openDetails();
    }
  }

  /** Assert the Host's personal registration action and distinct phase-advance command. */
  async expectHostRegistrationActions(personalAction: 'register' | 'cancel'): Promise<void> {
    await this.closeDetails();
    const personalLabel = personalAction === 'register' ? '报名上警' : '取消报名';
    const personalButton = this.page.getByTestId(
      personalAction === 'register'
        ? TESTIDS.sheriffRegisterButton
        : TESTIDS.sheriffCancelRegistrationButton,
    );
    const advanceLabel = '结束报名';
    const hostManagementButton = this.page.getByTestId(TESTIDS.roomMoreActionsButton);
    await expect(personalButton).toHaveText(personalLabel, { timeout: 15_000 });
    await expect(personalButton).toBeEnabled();
    await expect(hostManagementButton).toContainText(/更多操作|主持管理/);
    const identityButton = this.page.getByTestId(TESTIDS.roomViewIdentityButton);
    await expect(identityButton).toHaveAttribute('data-card-category', 'resource');
    const personalBounds = await personalButton.boundingBox();
    const identityBounds = await identityButton.boundingBox();
    if (personalBounds === null || identityBounds === null) {
      throw new Error('Sheriff action and identity cards must have layout bounds');
    }
    expect(personalBounds.x).toBeLessThan(identityBounds.x);
    await this.expectVisibleButtonLabel(personalButton, personalLabel);
    await this.expectVisibleButtonLabel(hostManagementButton, '主持管理');

    const viewport = this.page.viewportSize();
    if (viewport === null) throw new Error('Room action checks require a viewport');
    for (const button of [personalButton, hostManagementButton]) {
      const bounds = await button.boundingBox();
      if (bounds === null) throw new Error('Room action button must have layout bounds');
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(
        Math.min(bounds.y + bounds.height, viewport.height) - Math.max(bounds.y, 0),
      ).toBeGreaterThanOrEqual(44);
    }

    await personalButton.focus();
    await this.expectReachableByTab(hostManagementButton);
    const room = new RoomPage(this.page);
    const hostManagementPanel = await room.openHostManagement();
    const advanceButton = hostManagementPanel.getByTestId(TESTIDS.sheriffAdvanceButton);
    const grantButton = hostManagementPanel.getByTestId(TESTIDS.shareReviewButton);
    const infoButton = hostManagementPanel.getByTestId(TESTIDS.lastNightInfoButton);
    await expect(advanceButton).toHaveAccessibleName(advanceLabel);
    await expect(advanceButton).toBeEnabled();
    await expect(grantButton).toHaveAccessibleName('授权玩家查看');
    await expect(grantButton).toBeEnabled();
    await expect(infoButton).toHaveAccessibleName('昨夜信息');
    for (const button of [advanceButton, grantButton, infoButton]) {
      const bounds = await button.boundingBox();
      if (bounds === null) throw new Error('Host action must have layout bounds');
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(
        Math.min(bounds.y + bounds.height, viewport.height) - Math.max(bounds.y, 0),
      ).toBeGreaterThanOrEqual(44);
    }

    await advanceButton.focus();
    await this.expectReachableByTab(infoButton);
    const outlineStyle = await infoButton.evaluate(
      (element) => getComputedStyle(element).outlineStyle,
    );
    expect(outlineStyle).not.toBe('none');
    await this.expectReachableByTab(grantButton);

    await room.closeHostManagement();
  }

  private async expectReachableByTab(target: Locator): Promise<void> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await this.page.keyboard.press('Tab');
      if (await target.evaluate((element) => element === document.activeElement)) return;
    }
    await expect(target).toBeFocused();
  }

  private async expectVisibleButtonLabel(button: Locator, label: string): Promise<void> {
    const visible = await button.evaluate((element, expectedLabel) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let textNode = walker.nextNode();
      while (textNode !== null && textNode.textContent !== expectedLabel) {
        textNode = walker.nextNode();
      }
      if (textNode === null) throw new Error(`Button text node not found: ${expectedLabel}`);

      const range = document.createRange();
      range.selectNodeContents(textNode);
      const lines = [...range.getClientRects()];
      return (
        lines.length > 0 &&
        lines.every((line) => {
          const x = line.left + line.width / 2;
          const y = line.top + line.height / 2;
          return (
            line.left >= 0 &&
            line.right <= window.innerWidth &&
            line.top >= 0 &&
            line.bottom <= window.innerHeight &&
            element.contains(document.elementFromPoint(x, y))
          );
        })
      );
    }, label);
    expect(visible).toBe(true);
  }

  async register(): Promise<void> {
    await this.closeDetails();
    const button = this.page.getByTestId(TESTIDS.sheriffRegisterButton);
    await button.click();
    await confirmAlert(this.page, '报名上警？');
    await expect(button).not.toBeVisible({ timeout: 15_000 });
  }

  async withdraw(): Promise<void> {
    await this.closeDetails();
    const button = this.page.getByTestId(TESTIDS.sheriffWithdrawButton);
    await button.click();
    await confirmAlert(this.page, '确认退水？');
    await expect(button).not.toBeVisible({ timeout: 15_000 });
  }

  async advance(): Promise<void> {
    await this.closeDetails();
    const room = new RoomPage(this.page);
    await room.clickHostManagementActionAndConfirm(TESTIDS.sheriffAdvanceButton, '结束发言？');
    await room.expectHostManagementClosed();
  }

  /** Close registration; the advance action asks the Host to confirm first. */
  async endRegistration(): Promise<void> {
    await this.closeDetails();
    const room = new RoomPage(this.page);
    await room.clickHostManagementActionAndConfirm(TESTIDS.sheriffAdvanceButton, '结束报名？');
    await room.expectHostManagementClosed();
  }

  async voteFor(candidateSeat: number): Promise<void> {
    await this.ensureDetailsOpen();
    const candidateButton = this.page.getByTestId(TESTIDS.sheriffCandidateButton(candidateSeat));
    await candidateButton.click();
    await expect(candidateButton).toHaveAttribute('aria-checked', 'true', { timeout: 15_000 });
    await expect(this.panel).toContainText(`已投给 ${candidateSeat + 1}号`, {
      timeout: 15_000,
    });
  }

  /** Assert that candidate identities remain private while registration is open. */
  async expectCandidateRecordsHidden(): Promise<void> {
    await this.ensureDetailsOpen();
    await expect(this.page.getByTestId(TESTIDS.sheriffRegisteredSeats)).not.toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.sheriffWithdrawnSeats)).not.toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.sheriffActiveCandidateSeats)).not.toBeVisible();
  }

  async expectRegisteredOrder(displaySeats: readonly number[]): Promise<void> {
    await this.ensureDetailsOpen();
    const dots = this.page
      .getByTestId(TESTIDS.sheriffRegisteredSeats)
      .getByTestId(REGISTERED_SEAT_DOT);
    await expect(dots).toHaveCount(displaySeats.length, { timeout: 15_000 });

    const dotIds = await dots.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-testid')),
    );
    const actualOrder = dotIds.map((dotId) => {
      if (dotId === null) {
        throw new Error('Sheriff registered-seat dot has no test id');
      }
      const seat = REGISTERED_SEAT_DOT.exec(dotId)?.[1];
      if (seat === undefined) {
        throw new Error(`Unexpected sheriff registered-seat test id: ${dotId}`);
      }
      return Number(seat) + 1;
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
    await this.ensureDetailsOpen();
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
    await this.ensureDetailsOpen();
    await expect(this.page.getByTestId(TESTIDS.sheriffWithdrawnSeats)).toContainText(
      `${displaySeat}号`,
      { timeout: 15_000 },
    );
  }

  /** Read the displayed authoritative speaking instruction. */
  async getSpeakingInstruction(): Promise<string> {
    await this.ensureDetailsOpen();
    const instruction = this.page.getByTestId(TESTIDS.sheriffSpeakingInstruction);
    await expect(instruction).toBeVisible({ timeout: 15_000 });
    return instruction.innerText();
  }

  /** Assert that this client displays the same authoritative speaking instruction. */
  async expectSpeakingInstruction(instruction: string): Promise<void> {
    await this.ensureDetailsOpen();
    await expect(this.page.getByTestId(TESTIDS.sheriffSpeakingInstruction)).toHaveText(
      instruction,
      { timeout: 15_000 },
    );
  }

  async expectVoteProgress(progress: string): Promise<void> {
    await this.ensureDetailsOpen();
    await expect(this.page.getByTestId(TESTIDS.sheriffVoteProgress)).toHaveText(progress, {
      timeout: 15_000,
    });
  }

  /** Assert the election details name a seat that has not voted yet (0-based seat). */
  async expectPendingSeatVisible(seat: number): Promise<void> {
    await this.ensureDetailsOpen();
    await expect(this.page.getByTestId(TESTIDS.sheriffVoteProgressPendingSeats)).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      this.page.getByTestId(`${TESTIDS.sheriffVoteProgressPendingSeats}-seat-${seat}`),
    ).toBeVisible({ timeout: 15_000 });
  }

  async expectPendingSeatsHidden(): Promise<void> {
    await this.ensureDetailsOpen();
    await expect(this.page.getByTestId(TESTIDS.sheriffVoteProgressPendingSeats)).not.toBeVisible();
  }

  /** Assert the HUD counts down the armed settle countdown; seconds tick, so match the range. */
  async expectSettleCountdown(countText: RegExp): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.sheriffElectionHud)).toContainText(countText, {
      timeout: 10_000,
    });
  }

  /** Observe the automatic result before waiting for its server-driven dismissal. */
  async expectAutomaticResult(round: 'first' | 'runoff'): Promise<void> {
    const dialog = this.page.getByTestId(TESTIDS.sheriffResultDialog);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByTestId(TESTIDS.sheriffCompletedRound(round))).toBeVisible();
    await this.page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
  }

  /** Keep an unsubmitted note open across a public result. */
  async openNoteDraft(text: string): Promise<void> {
    await this.closeDetails();
    await this.page.getByTestId(TESTIDS.roomManualButton).click();
    await this.page.getByTestId(TESTIDS.werewolfNotepadButton).click();
    await this.page.getByTestId(TESTIDS.werewolfNotepadVoteNotes).fill(text);
  }

  async expectNoteDraftAndClose(text: string): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.werewolfNotepadVoteNotes)).toHaveValue(text);
    await this.page.getByTestId(TESTIDS.roomDialogCloseButton).click();
    await expect(this.page.getByTestId(TESTIDS.roomManualButton)).toBeFocused();
  }

  async expectCanVote(canVote: boolean): Promise<void> {
    await this.ensureDetailsOpen();
    const abstainButton = this.page.getByTestId(TESTIDS.sheriffAbstainButton);
    if (canVote) {
      await expect(abstainButton).toBeVisible({ timeout: 15_000 });
      return;
    }
    await expect(abstainButton).not.toBeVisible();
  }

  async expectOpenBallotsHidden(): Promise<void> {
    await this.ensureDetailsOpen();
    await expect(this.panel).not.toContainText('→');
    await expect(this.page.getByTestId(TESTIDS.sheriffCompletedRound('first'))).not.toBeVisible();
  }

  async expectClosedRound(
    round: 'first' | 'runoff',
    expectedText: readonly string[],
  ): Promise<void> {
    await this.ensureDetailsOpen();
    const roundRecord = this.page.getByTestId(TESTIDS.sheriffCompletedRound(round));
    await expect(roundRecord).toBeVisible({ timeout: 15_000 });
    for (const text of expectedText) {
      await expect(roundRecord).toContainText(text);
    }
  }

  async expectResult(expectedText: string): Promise<void> {
    await this.ensureDetailsOpen();
    await expect(this.page.getByTestId(TESTIDS.sheriffElectionResult)).toContainText(expectedText, {
      timeout: 15_000,
    });
  }
}
