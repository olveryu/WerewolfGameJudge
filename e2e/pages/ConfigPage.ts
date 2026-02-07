import { Page, expect } from '@playwright/test';
import { getVisibleText } from '../helpers/ui';

/**
 * ConfigPage Page Object
 *
 * Encapsulates all Config Screen interactions:
 * - Template selection
 * - Role chip toggling
 * - Player count reading
 * - Create / Save actions
 */
export class ConfigPage {
  constructor(private readonly page: Page) {}

  // ---------------------------------------------------------------------------
  // Selectors
  // ---------------------------------------------------------------------------

  private get createButton() {
    return getVisibleText(this.page, '创建房间');
  }

  private get saveButton() {
    return getVisibleText(this.page, '保存配置');
  }

  private get backButton() {
    return getVisibleText(this.page, '←');
  }

  // ---------------------------------------------------------------------------
  // Waits
  // ---------------------------------------------------------------------------

  /** Wait until the config screen is ready (create mode). */
  async waitForCreateMode() {
    await expect(this.createButton).toBeVisible({ timeout: 15000 });
  }

  /** Wait until the config screen is ready (edit/save mode). */
  async waitForSaveMode() {
    await expect(this.saveButton).toBeVisible({ timeout: 10000 });
  }

  // ---------------------------------------------------------------------------
  // Template
  // ---------------------------------------------------------------------------

  /** Click the template dropdown and select a template by name. */
  async selectTemplate(name: string) {
    const dropdown = getVisibleText(this.page, name);
    await dropdown.scrollIntoViewIfNeeded();
    await expect(dropdown).toBeVisible({ timeout: 5000 });
    await dropdown.click();
  }

  /**
   * Open the template dropdown by clicking the template pill.
   * @param currentTemplate Short label of current template (e.g. '标准板')
   */
  async openTemplateDropdown(currentTemplate: string) {
    const dropdown = getVisibleText(this.page, currentTemplate);
    await expect(dropdown).toBeVisible({ timeout: 5000 });
    await dropdown.click();
    // Wait for the modal to appear
    await expect(this.page.getByText('选择板子')).toBeVisible({ timeout: 3000 });
  }

  /** Expect template pill to be visible (config screen identity check). */
  async expectTemplateVisible() {
    // The template pill shows the short label (e.g. "标准板"), not the full name
    await expect(this.page.getByText('标准板')).toBeVisible();
  }

  // ---------------------------------------------------------------------------
  // Faction Tabs
  // ---------------------------------------------------------------------------

  /**
   * Switch to a faction tab.
   * @param faction - Tab key: 'villager' (好人阵营), 'wolf' (狼人阵营), 'special' (中立阵营)
   */
  async switchToFactionTab(faction: 'villager' | 'wolf' | 'special') {
    const tab = this.page.locator(`[data-testid="config-faction-tab-${faction}"]`);
    await tab.waitFor({ state: 'visible', timeout: 3000 });
    await tab.click();
    await this.page.waitForTimeout(100);
  }

  // ---------------------------------------------------------------------------
  // Role Chips
  // ---------------------------------------------------------------------------

  /** Toggle a role chip by its roleId (data-testid="config-role-chip-{roleId}"). */
  async toggleRole(roleId: string) {
    const chip = this.page.locator(`[data-testid="config-role-chip-${roleId}"]`).first();
    await chip.waitFor({ state: 'attached', timeout: 2000 });
    await chip.click({ force: true });
    await this.page.waitForTimeout(50);
  }

  /** Deselect multiple role chips. Silently skips missing chips. */
  async deselectRoles(roleIds: string[]) {
    for (const roleId of roleIds) {
      try {
        await this.toggleRole(roleId);
      } catch {
        // chip not found, skip
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Bulk Role Stepper
  // ---------------------------------------------------------------------------

  /**
   * Click the stepper decrease button for a bulk role N times.
   * @param roleId - Bulk role id ('wolf' or 'villager')
   * @param clicks - Number of times to click the decrease button
   */
  async decreaseStepper(roleId: string, clicks: number) {
    const btn = this.page.locator(`[data-testid="config-stepper-dec-${roleId}"]`);
    await btn.waitFor({ state: 'visible', timeout: 3000 });
    for (let i = 0; i < clicks; i++) {
      await btn.click();
      await this.page.waitForTimeout(50);
    }
  }

  /**
   * Click the stepper increase button for a bulk role N times.
   * @param roleId - Bulk role id ('wolf' or 'villager')
   * @param clicks - Number of times to click the increase button
   */
  async increaseStepper(roleId: string, clicks: number) {
    const btn = this.page.locator(`[data-testid="config-stepper-inc-${roleId}"]`);
    await btn.waitFor({ state: 'visible', timeout: 3000 });
    for (let i = 0; i < clicks; i++) {
      await btn.click();
      await this.page.waitForTimeout(50);
    }
  }

  // ---------------------------------------------------------------------------
  // Player Count
  // ---------------------------------------------------------------------------

  /** Read the player count from header (e.g. "6 名玩家" → 6). */
  async getPlayerCount(): Promise<number | null> {
    const text = await this.page
      .getByText(/\d+ 名玩家/)
      .first()
      .textContent()
      .catch(() => null);
    if (!text) return null;
    const match = /(\d+)/.exec(text);
    return match ? Number.parseInt(match[1], 10) : null;
  }

  // ---------------------------------------------------------------------------
  // Settings (Animation)
  // ---------------------------------------------------------------------------

  /**
   * Disable role reveal animation so E2E tests see the static "我知道了" card.
   * Opens gear → clicks animation dropdown → selects "⚡ 无动画" → closes settings.
   */
  async setAnimationNone() {
    // Open settings sheet
    const gearBtn = this.page.locator('[data-testid="config-gear-btn"]');
    await gearBtn.waitFor({ state: 'visible', timeout: 3000 });
    await gearBtn.click();
    // Wait for animation dropdown to be visible (it's inside the settings sheet)
    await expect(this.page.getByText('动画')).toBeVisible({ timeout: 3000 });

    // Click the animation dropdown trigger (shows "▼" arrow)
    const animTrigger = this.page.getByText('▼').first();
    await animTrigger.click();
    await this.page.waitForTimeout(200);

    // Select "⚡ 无动画" in the opened dropdown modal
    const noneOption = this.page.getByText('⚡ 无动画');
    await expect(noneOption).toBeVisible({ timeout: 3000 });
    await noneOption.click();
    await this.page.waitForTimeout(200);

    // Close settings sheet — click on overlay area (top of screen, outside content)
    await this.page.mouse.click(10, 10);
    await this.page.waitForTimeout(200);
  }

  // ---------------------------------------------------------------------------
  // Template Presets
  // ---------------------------------------------------------------------------

  /**
   * Configure a 2-player template (1 wolf + 1 villager).
   *
   * Starting from default 标准板 (4w + seer + witch + hunter + idiot + 4v = 12):
   * - 好人阵营 tab: deselect seer/witch/hunter/idiot chips, reduce villager 4→1
   * - 狼人阵营 tab: reduce wolf 4→1
   */
  async configure2Player() {
    // Disable animation so role viewing uses static "我知道了" card
    await this.setAnimationNone();

    // 好人阵营 tab is active by default
    await this.deselectRoles(['seer', 'witch', 'hunter', 'idiot']);
    await this.decreaseStepper('villager', 3); // 4 → 1

    // Switch to 狼人阵营 tab to adjust wolf count
    await this.switchToFactionTab('wolf');
    await this.decreaseStepper('wolf', 3); // 4 → 1
  }

  /**
   * Configure a 6-player template (2w + seer + witch + hunter + 1v = 6).
   *
   * Starting from default 标准板 (4w + seer + witch + hunter + idiot + 4v = 12):
   * - 好人阵营 tab: deselect idiot chip, reduce villager 4→1
   * - 狼人阵营 tab: reduce wolf 4→2
   */
  async configure6Player() {
    // Disable animation so role viewing uses static "我知道了" card
    await this.setAnimationNone();

    // 好人阵营 tab is active by default
    await this.deselectRoles(['idiot']);
    await this.decreaseStepper('villager', 3); // 4 → 1

    // Switch to 狼人阵营 tab to adjust wolf count
    await this.switchToFactionTab('wolf');
    await this.decreaseStepper('wolf', 2); // 4 → 2
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async clickCreate() {
    await this.createButton.click();
  }

  async clickSave() {
    await this.saveButton.click();
  }

  async clickBack() {
    await this.backButton.click();
  }
}
