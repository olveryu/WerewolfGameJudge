import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { RoomPage } from './RoomPage';

/** All Avalon role display names (avalonRoleDisplay.ts); 爪牙 only exists on the 8p board. */
export const AVALON_ROLE_DISPLAY_NAMES: readonly string[] = [
  '梅林',
  '派西维尔',
  '忠臣',
  '莫甘娜',
  '刺客',
  '莫德雷德',
  '奥伯伦',
  '爪牙',
];

/**
 * Avalon room interactions on top of the shared room shell (RoomPage).
 *
 * Phase surfaces (adapter testIDs in avalonRoomAdapter.ts):
 * - viewing: avalon-view-role opens the shared role card (role-card-modal)
 * - night: avalon-night-info → AlertModal with a single 确认信息 button
 * - nominate: leader taps seat tiles, avalon-nominate-submit when the team is full
 * - vote / quest: auto-opened modals (avalon-vote-* / avalon-quest-*), result
 *   panels must be dismissed per page before the next phase can be driven
 * - lady: seat tap → AlertModal 确认查验; target confirms via
 *   avalon-lady-acknowledge; holder reads avalon-lady-result-modal
 * - assassin: seat tap → AlertModal 确认指认 (title 指认梅林)
 */
export class AvalonRoomPage extends RoomPage {
  constructor(page: Page) {
    super(page);
  }

  // ---------------------------------------------------------------------------
  // Locators
  // ---------------------------------------------------------------------------

  /** Seat tile wrapper (badges and labels live here, not on the pressable). */
  seatTileWrapper(seat: number) {
    return this.page.getByTestId(TESTIDS.seatTile(seat));
  }

  viewRoleButton() {
    return this.page.getByTestId('avalon-view-role');
  }

  nightInfoButton() {
    return this.page.getByTestId('avalon-night-info');
  }

  nominateSubmitButton() {
    return this.page.getByTestId('avalon-nominate-submit');
  }

  voteResultPanel() {
    return this.page.getByTestId('avalon-vote-result-panel');
  }

  questResultPanel() {
    return this.page.getByTestId('avalon-quest-result-panel');
  }

  // ---------------------------------------------------------------------------
  // Viewing: open own role card, capture the role name, dismiss
  // ---------------------------------------------------------------------------

  /**
   * Click 查看身份 (records the view server-side on open), read the role
   * display name from the card, then dismiss with 知道了.
   *
   * The name element precedes the structured description in DOM order, so
   * the first deepest exact-text match among known role names is the title
   * (description fields that mention other roles come later in the card).
   */
  async viewRoleAndCaptureRole(): Promise<string> {
    await expect(this.viewRoleButton()).toBeVisible({ timeout: 15_000 });
    await this.viewRoleButton().click();
    const modal = this.page.getByTestId('role-card-modal');
    await expect(modal).toBeVisible({ timeout: 15_000 });

    let captured: string | null = null;
    await expect
      .poll(
        async () => {
          captured = await modal.evaluate((root, names: readonly string[]) => {
            for (const el of root.querySelectorAll('*')) {
              const text = el.textContent?.trim() ?? '';
              if (!names.includes(text)) continue;
              const childCarriesSameText = [...el.children].some(
                (child) => (child.textContent?.trim() ?? '') === text,
              );
              if (!childCarriesSameText) return text;
            }
            return null;
          }, AVALON_ROLE_DISPLAY_NAMES);
          return captured;
        },
        { timeout: 15_000, intervals: [250] },
      )
      .not.toBeNull();

    // Mirror RoomPage.viewRoleAndCapture: the card can overflow small
    // viewports, so dismiss via evaluate click.
    await this.page
      .getByText('知道了', { exact: true })
      .evaluate((el) => (el as HTMLElement).click());
    await expect(modal).toHaveCount(0);
    return captured!;
  }

  // ---------------------------------------------------------------------------
  // Night: open the confirm dialog, return its message, confirm
  // ---------------------------------------------------------------------------

  /**
   * Click 确认信息 (bottom action), read the AlertModal message, confirm.
   * The button is disabled while the host audio broadcast is playing
   * (server rejects night.confirm during playback), so wait for enabled.
   */
  async confirmNightInfo(): Promise<string> {
    const button = this.nightInfoButton();
    await expect(button).toBeVisible({ timeout: 20_000 });
    await expect(button).toBeEnabled({ timeout: 30_000 });
    await button.click();
    const message = this.page.getByTestId(TESTIDS.alertMessage);
    await expect(message).toBeVisible({ timeout: 10_000 });
    const text = (await message.textContent()) ?? '';
    await this.page.getByTestId(TESTIDS.alertButton(0)).click();
    await expect(this.page.getByTestId(TESTIDS.alertModalOverlay)).toHaveCount(0);
    return text;
  }

  // ---------------------------------------------------------------------------
  // Nominate
  // ---------------------------------------------------------------------------

  /** Tap a seat tile (leader nomination toggle / lady pick / assassin pick). */
  async tapSeat(seat: number): Promise<void> {
    await this.getSeatTile(seat).click();
  }

  async expectSeatBadge(seat: number, label: string): Promise<void> {
    await expect(this.seatTileWrapper(seat)).toContainText(label, { timeout: 10_000 });
  }

  async submitTeam(): Promise<void> {
    const submit = this.nominateSubmitButton();
    await expect(submit).toBeEnabled({ timeout: 10_000 });
    await submit.click();
  }

  // ---------------------------------------------------------------------------
  // Vote / quest modals
  // ---------------------------------------------------------------------------

  /**
   * Ensure a phase modal is open: it auto-opens once per round, and the
   * bottom action reopens it. If the auto-open lands while the reopen
   * click is in flight, the click dies on the modal's inert backdrop —
   * the visibility assertion after the click is the real gate.
   */
  private async ensureModalOpen(modalTestID: string, openButtonTestID: string): Promise<void> {
    const modal = this.page.getByTestId(modalTestID);
    const alreadyOpen = await modal
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (alreadyOpen) return;
    await this.page
      .getByTestId(openButtonTestID)
      .click({ timeout: 5_000 })
      .catch(() => {});
    await expect(modal).toBeVisible({ timeout: 10_000 });
  }

  /** Cast (or change) this player's ballot in the vote modal, then close it. */
  async castBallot(ballot: 'approve' | 'reject'): Promise<void> {
    const modal = this.page.getByTestId('avalon-vote-modal');
    await this.ensureModalOpen('avalon-vote-modal', 'avalon-vote-open');
    await this.page
      .getByTestId(ballot === 'approve' ? 'avalon-vote-approve' : 'avalon-vote-reject')
      .click();
    // The modal confirms registration with a 已投票 hint naming the ballot.
    await expect(
      modal.getByText(ballot === 'approve' ? /已投票（赞成）/ : /已投票（反对）/),
    ).toBeVisible({ timeout: 10_000 });
    await this.page.getByTestId('avalon-vote-close').click();
    await expect(modal).toHaveCount(0);
  }

  /** Play this team member's quest card in the quest modal, then close it. */
  async playQuestCard(play: 'success' | 'fail'): Promise<void> {
    const modal = this.page.getByTestId('avalon-quest-modal');
    await this.ensureModalOpen('avalon-quest-modal', 'avalon-quest-open');
    await this.page
      .getByTestId(play === 'success' ? 'avalon-quest-success' : 'avalon-quest-fail')
      .click();
    await expect(
      modal.getByText(play === 'success' ? /已出牌（成功）/ : /已出牌（失败）/),
    ).toBeVisible({ timeout: 10_000 });
    await this.page.getByTestId('avalon-quest-close').click();
    await expect(modal).toHaveCount(0);
  }

  // ---------------------------------------------------------------------------
  // Result panels (per-page overlays; block the board until dismissed)
  // ---------------------------------------------------------------------------

  /**
   * Dismiss the vote result panel if it is showing on this page.
   * On team members the quest modal (mounted after the panel) covers it,
   * so close the quest modal first; the quest driver reopens it on demand.
   */
  async closeVoteResultPanel(): Promise<boolean> {
    const panel = this.voteResultPanel();
    const visible = await panel
      .waitFor({ state: 'visible', timeout: 2_000 })
      .then(() => true)
      .catch(() => false);
    if (!visible) return false;
    const questModal = this.page.getByTestId('avalon-quest-modal');
    if (await questModal.isVisible().catch(() => false)) {
      await this.page.getByTestId('avalon-quest-close').click();
      await expect(questModal).toHaveCount(0);
    }
    await this.page.getByTestId('avalon-vote-result-close').click();
    await expect(panel).toHaveCount(0);
    return true;
  }

  /** Dismiss the quest result panel if it is showing on this page. */
  async closeQuestResultPanel(): Promise<boolean> {
    const panel = this.questResultPanel();
    const visible = await panel
      .waitFor({ state: 'visible', timeout: 2_000 })
      .then(() => true)
      .catch(() => false);
    if (!visible) return false;
    await this.page.getByTestId('avalon-quest-result-close').click();
    await expect(panel).toHaveCount(0);
    return true;
  }

  async expectVoteResult(banner: string, counts: string): Promise<void> {
    await expect(this.voteResultPanel()).toBeVisible({ timeout: 20_000 });
    await expect(this.page.getByTestId('avalon-vote-result-banner')).toHaveText(banner);
    await expect(this.page.getByTestId('avalon-vote-result-counts')).toHaveText(counts);
  }

  async expectQuestResult(banner: string, counts: string): Promise<void> {
    await expect(this.questResultPanel()).toBeVisible({ timeout: 20_000 });
    await expect(this.page.getByTestId('avalon-quest-result-banner')).toHaveText(banner);
    await expect(this.page.getByTestId('avalon-quest-result-counts')).toHaveText(counts);
  }

  // ---------------------------------------------------------------------------
  // Lady of the Lake
  // ---------------------------------------------------------------------------

  /** Confirm the lady check in the AlertModal (buttons: 取消 / 确认查验). Returns the message. */
  async confirmLadyCheck(): Promise<string> {
    const message = this.page.getByTestId(TESTIDS.alertMessage);
    await expect(message).toBeVisible({ timeout: 10_000 });
    const text = (await message.textContent()) ?? '';
    await this.page.getByTestId(TESTIDS.alertButton(1)).click();
    await expect(this.page.getByTestId(TESTIDS.alertModalOverlay)).toHaveCount(0);
    return text;
  }

  /** As the checked target: confirm展示 in the acknowledge modal. */
  async acknowledgeLadyCheck(): Promise<void> {
    const modal = this.page.getByTestId('avalon-lady-acknowledge-modal');
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await this.page.getByTestId('avalon-lady-acknowledge').click();
    await expect(modal).toHaveCount(0);
  }

  /** As the holder: read the check result text, then dismiss the result modal. */
  async readLadyResult(): Promise<string> {
    const modal = this.page.getByTestId('avalon-lady-result-modal');
    await expect(modal).toBeVisible({ timeout: 15_000 });
    const text = (await this.page.getByTestId('avalon-lady-result-text').textContent()) ?? '';
    await this.page.getByTestId('avalon-lady-result-close').click();
    await expect(modal).toHaveCount(0);
    return text;
  }

  // ---------------------------------------------------------------------------
  // Assassin
  // ---------------------------------------------------------------------------

  /** Confirm the accusation in the AlertModal (title 指认梅林; buttons 取消 / 确认指认). */
  async confirmAccusation(): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.alertTitle)).toHaveText('指认梅林', {
      timeout: 10_000,
    });
    await this.page.getByTestId(TESTIDS.alertButton(1)).click();
    await expect(this.page.getByTestId(TESTIDS.alertModalOverlay)).toHaveCount(0);
  }
}
