import { expect, Page } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { getVisibleText } from '../helpers/ui';
import { BoardPickerPage } from './BoardPickerPage';

/**
 * Variant → base role mapping.
 *
 * Variant roles share a chip with their base role in the config UI.
 * Selecting a variant requires long-pressing the base chip to open the role info card,
 * then clicking the variant pill. Keep in sync with configData.ts `variants` arrays.
 */
const VARIANT_TO_BASE: Record<string, string> = {
  awakenedGargoyle: 'gargoyle',
  drunkSeer: 'mirrorSeer',
  poisoner: 'witch',
  treasureMaster: 'thief',
  wildChild: 'slacker',
};

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
    return this.page.locator('[data-testid="config-back-button"]').last();
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

  /**
   * Change the selected template by navigating back to BoardPicker.
   *
   * In create mode, clicking the template pill goes back to BoardPicker.
   * Then we select the desired template on BoardPicker, which navigates
   * back to Config with the new preset.
   */
  async selectTemplate(name: string) {
    // Step 1: Click the template pill to go back to BoardPicker
    await this.clickTemplatePill();

    // Step 2: BoardPicker is now visible — select the template
    const boardPicker = new BoardPickerPage(this.page);
    await boardPicker.waitForReady();
    await boardPicker.selectTemplate(name);
  }

  /**
   * Click the template pill in the header.
   * In create mode this navigates to BoardPicker.
   */
  async clickTemplatePill() {
    const pill = this.page.locator(`[data-testid="${TESTIDS.configTemplatePill}"]`);
    await pill.click();
  }

  /**
   * @deprecated Use selectTemplate() instead. The old TemplatePicker modal no longer exists.
   * In create mode, the template pill navigates back to BoardPicker.
   */
  async openTemplateDropdown(_currentTemplate: string) {
    await this.clickTemplatePill();
  }

  /** Expect template pill to be visible (config screen identity check). */
  async expectTemplateVisible() {
    // The template pill shows the short label (e.g. "预女猎白"), not the full name
    const root = this.page.locator(`[data-testid="${TESTIDS.configScreenRoot}"]`);
    await expect(root.getByText('预女猎白')).toBeVisible();
  }

  // ---------------------------------------------------------------------------
  // Faction Tabs
  // ---------------------------------------------------------------------------

  /**
   * Switch to a faction tab.
   * @param faction - Tab key: 'Villager' (好人阵营), 'Wolf' (狼人阵营), 'Special' (第三方阵营)
   */
  async switchToFactionTab(faction: 'Villager' | 'Wolf' | 'Special') {
    const tab = this.page.locator(`[data-testid="config-faction-tab-${faction}"]`);
    await tab.waitFor({ state: 'visible', timeout: 3000 });
    await tab.click();
    // Wait for tab content to render (tab panel should update)
    await expect(tab).toBeVisible({ timeout: 2000 });
  }

  // ---------------------------------------------------------------------------
  // Role Chips
  // ---------------------------------------------------------------------------

  /** Toggle a role chip by its roleId (data-testid="config-role-chip-{roleId}"). */
  async toggleRole(roleId: string) {
    const chip = this.page.locator(`[data-testid="config-role-chip-${roleId}"]`).first();
    await chip.waitFor({ state: 'attached', timeout: 2000 });
    await chip.click({ force: true });
  }

  /**
   * Select a variant role via the role info card's variant pills.
   *
   * Long-presses the base chip to open the role info card,
   * then clicks the variant pill and closes the card.
   */
  async selectVariant(baseRoleId: string, variantRoleId: string) {
    const chip = this.page.locator(`[data-testid="config-role-chip-${baseRoleId}"]`).first();
    await chip.waitFor({ state: 'attached', timeout: 2000 });
    // Long-press to open role info card
    await chip.click({ delay: 600 });
    // Click the variant pill
    const option = this.page.locator(`[data-testid="config-variant-option-${variantRoleId}"]`);
    await option.waitFor({ state: 'visible', timeout: 3000 });
    await option.click();
    // Close the role info card via "知道了" button.
    // Why NOT Escape? RN Web Modal onRequestClose doesn't reliably fire
    // in Playwright/Chromium (same issue documented in RoomPage.setAnimationNone).
    const confirmBtn = this.page.getByText('知道了', { exact: true });
    await confirmBtn.waitFor({ state: 'visible', timeout: 3000 });
    await confirmBtn.click();
    // Wait for modal to close
    const card = this.page.locator('[data-testid="role-card-modal"]').first();
    await card.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
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
    const countLoc = this.page.locator(`[data-testid="config-stepper-count-${roleId}"]`);
    await btn.waitFor({ state: 'visible', timeout: 3000 });
    for (let i = 0; i < clicks; i++) {
      const before = await countLoc.textContent();
      await btn.click();
      // Wait for count to actually change (event-driven, no fixed delay)
      await expect(countLoc).not.toHaveText(before!, { timeout: 2000 });
    }
  }

  /**
   * Click the stepper increase button for a bulk role N times.
   * @param roleId - Bulk role id ('wolf' or 'villager')
   * @param clicks - Number of times to click the increase button
   */
  async increaseStepper(roleId: string, clicks: number) {
    const btn = this.page.locator(`[data-testid="config-stepper-inc-${roleId}"]`);
    const countLoc = this.page.locator(`[data-testid="config-stepper-count-${roleId}"]`);
    await btn.waitFor({ state: 'visible', timeout: 3000 });
    for (let i = 0; i < clicks; i++) {
      const before = await countLoc.textContent();
      await btn.click();
      // Wait for count to actually change (event-driven, no fixed delay)
      await expect(countLoc).not.toHaveText(before!, { timeout: 2000 });
    }
  }

  // ---------------------------------------------------------------------------
  // Player Count
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Template Presets
  // ---------------------------------------------------------------------------

  /**
   * Configure a 2-player template (1 wolf + 1 villager).
   *
   * Starting from default 预女猎白 (4w + seer + witch + hunter + idiot + 4v = 12):
   * - 好人阵营 tab: deselect seer/witch/hunter/idiot chips, reduce villager 4→1
   * - 狼人阵营 tab: reduce wolf 4→1
   */
  async configure2Player() {
    // 好人阵营 tab is active by default
    await this.deselectRoles(['seer', 'witch', 'hunter', 'idiot']);
    await this.decreaseStepper('villager', 3); // 4 → 1

    // Switch to 狼人阵营 tab to adjust wolf count
    await this.switchToFactionTab('Wolf');
    await this.decreaseStepper('wolf', 3); // 4 → 1
  }

  /**
   * Configure a 6-player template (2w + seer + witch + hunter + 1v = 6).
   *
   * Starting from default 预女猎白 (4w + seer + witch + hunter + idiot + 4v = 12):
   * - 好人阵营 tab: deselect idiot chip, reduce villager 4→1
   * - 狼人阵营 tab: reduce wolf 4→2
   */
  async configure6Player() {
    // 好人阵营 tab is active by default
    await this.deselectRoles(['idiot']);
    await this.decreaseStepper('villager', 3); // 4 → 1

    // Switch to 狼人阵营 tab to adjust wolf count
    await this.switchToFactionTab('Wolf');
    await this.decreaseStepper('wolf', 2); // 4 → 2
  }

  // ---------------------------------------------------------------------------
  // Custom Template Builder
  // ---------------------------------------------------------------------------

  /**
   * Configure a custom template from default 预女猎白 (4w + seer + witch + hunter + idiot + 4v = 12).
   *
   * Deselects all default special roles, zeros out wolf/villager steppers,
   * then adds the requested roles.
   *
   * @param opts.wolves - Number of generic wolves (default 0)
   * @param opts.villagers - Number of villagers (default 0)
   * @param opts.goodRoles - RoleIds of god/good special roles to enable (e.g. ['seer', 'witch'])
   * @param opts.wolfRoles - RoleIds of wolf special roles to enable (e.g. ['nightmare', 'wolfQueen'])
   * @param opts.specialRoles - RoleIds of third-party roles to enable (e.g. ['slacker'])
   */
  async configureCustomTemplate(opts: {
    wolves?: number;
    villagers?: number;
    goodRoles?: string[];
    wolfRoles?: string[];
    specialRoles?: string[];
  }) {
    const { wolves = 0, villagers = 0, goodRoles = [], wolfRoles = [], specialRoles = [] } = opts;

    // --- 好人阵营 (active by default) ---
    // Deselect all default god roles
    await this.deselectRoles(['seer', 'witch', 'hunter', 'idiot']);
    // Adjust villager count from default 4 → target
    // Go directly to target (minimize clicks to avoid React batching issues)
    const villagerDelta = 4 - villagers; // default is 4
    if (villagerDelta > 0) {
      await this.decreaseStepper('villager', villagerDelta);
    } else if (villagerDelta < 0) {
      await this.increaseStepper('villager', -villagerDelta);
    }
    // Enable good special roles (handle variants via role info card)
    for (const roleId of goodRoles) {
      const base = VARIANT_TO_BASE[roleId];
      if (base) {
        await this.selectVariant(base, roleId);
      } else {
        await this.toggleRole(roleId);
      }
    }

    // --- 狼人阵营 ---
    await this.switchToFactionTab('Wolf');
    // Adjust wolf count from default 4 → target
    const wolfDelta = 4 - wolves;
    if (wolfDelta > 0) {
      await this.decreaseStepper('wolf', wolfDelta);
    } else if (wolfDelta < 0) {
      await this.increaseStepper('wolf', -wolfDelta);
    }
    // Enable wolf special roles (handle variants via role info card)
    for (const roleId of wolfRoles) {
      const base = VARIANT_TO_BASE[roleId];
      if (base) {
        await this.selectVariant(base, roleId);
      } else {
        await this.toggleRole(roleId);
      }
    }

    // --- 第三方阵营 (if needed) ---
    if (specialRoles.length > 0) {
      await this.switchToFactionTab('Special');
      for (const roleId of specialRoles) {
        const base = VARIANT_TO_BASE[roleId];
        if (base) {
          await this.selectVariant(base, roleId);
        } else {
          await this.toggleRole(roleId);
        }
      }
    }
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
