import type { TemplateCategory } from '@game-judge/game-engine/games/werewolf/public';
import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { BoardPickerPage } from './BoardPickerPage';
import { RulesPage } from './RulesPage';

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
 * - Handoff to the Rules step (which owns create / save)
 */
export class ConfigPage {
  constructor(private readonly page: Page) {}

  // ---------------------------------------------------------------------------
  // Selectors
  // ---------------------------------------------------------------------------

  private get nextButton() {
    return this.page.getByTestId(TESTIDS.configNextButton);
  }

  private get backButton() {
    return this.page.getByTestId(TESTIDS.configBackButton);
  }

  // ---------------------------------------------------------------------------
  // Waits
  // ---------------------------------------------------------------------------

  /** Wait until the config screen is ready (create or edit mode). */
  async waitForReady() {
    await expect(this.page.getByTestId(TESTIDS.configScreenRoot)).toBeVisible({ timeout: 15000 });
    await expect(this.nextButton).toHaveText('下一步：规则');
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
  async selectTemplate(name: string, category?: TemplateCategory) {
    // Step 1: Click the template pill to go back to BoardPicker
    await this.clickTemplatePill();

    // Step 2: BoardPicker is now visible — select the template
    const boardPicker = new BoardPickerPage(this.page);
    await boardPicker.waitForReady();
    await boardPicker.selectTemplate(name, category);
  }

  /**
   * Click the template pill in the header.
   * In create mode this navigates to BoardPicker.
   */
  async clickTemplatePill() {
    await this.page.getByTestId(TESTIDS.configTemplatePill).click();
  }

  /** Expect template pill to be visible (config screen identity check). */
  async expectTemplateVisible() {
    await expect(this.page.getByTestId(TESTIDS.configTemplatePill)).toHaveText('预女猎白');
  }

  // ---------------------------------------------------------------------------
  // Faction Tabs
  // ---------------------------------------------------------------------------

  /**
   * Switch to a faction tab.
   * @param faction - Tab key: 'Villager' (good faction), 'Wolf' (wolf faction), 'Special' (third-party faction)
   */
  async switchToFactionTab(faction: 'Villager' | 'Wolf' | 'Special') {
    const tab = this.page.getByTestId(TESTIDS.configFactionTab(faction));
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }

  // ---------------------------------------------------------------------------
  // Role Chips
  // ---------------------------------------------------------------------------

  /** Toggle a role chip by its roleId (data-testid="config-role-chip-{roleId}"). */
  async toggleRole(roleId: string) {
    await this.page.getByTestId(TESTIDS.configRoleChip(roleId)).click();
  }

  /**
   * Select a variant role via the role info card's variant pills.
   *
   * Long-presses the base chip to open the role info card,
   * then clicks the variant pill and closes the card.
   */
  async selectVariant(baseRoleId: string, variantRoleId: string) {
    // Long-press to open role info card
    await this.page.getByTestId(TESTIDS.configRoleChip(baseRoleId)).click({ delay: 600 });
    const option = this.page.getByTestId(TESTIDS.configVariantOption(variantRoleId));
    await option.click();
    await expect(option).toHaveAttribute('aria-pressed', 'true');
    const confirmButton = this.page.getByTestId(TESTIDS.roleCardConfirmButton);
    await expect(confirmButton).toHaveText('知道了');
    await confirmButton.click();
    await expect(this.page.getByTestId(TESTIDS.roleCardModal)).toBeHidden();
  }

  /** Deselect multiple role chips. */
  async deselectRoles(roleIds: string[]) {
    for (const roleId of roleIds) {
      await this.toggleRole(roleId);
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
    const btn = this.page.getByTestId(TESTIDS.configStepperDec(roleId));
    const countLoc = this.page.getByTestId(TESTIDS.configStepperCount(roleId));
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
    const btn = this.page.getByTestId(TESTIDS.configStepperInc(roleId));
    const countLoc = this.page.getByTestId(TESTIDS.configStepperCount(roleId));
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
   * Starting from default Seer-Witch-Hunter-Villager (4w + seer + witch + hunter + idiot + 4v = 12):
   * - Good faction tab: deselect seer/witch/hunter/idiot chips, reduce villager 4→1
   * - Wolf faction tab: reduce wolf 4→1
   */
  async configure2Player() {
    // good faction tab is active by default
    await this.deselectRoles(['seer', 'witch', 'hunter', 'idiot']);
    await this.decreaseStepper('villager', 3); // 4 → 1

    // Switch to wolf faction tab to adjust wolf count
    await this.switchToFactionTab('Wolf');
    await this.decreaseStepper('wolf', 3); // 4 → 1
  }

  /**
   * Configure a 6-player template (2w + seer + witch + hunter + 1v = 6).
   *
   * Starting from default Seer-Witch-Hunter-Villager (4w + seer + witch + hunter + idiot + 4v = 12):
   * - Good faction tab: deselect idiot chip, reduce villager 4→1
   * - Wolf faction tab: reduce wolf 4→2
   */
  async configure6Player() {
    // good faction tab is active by default
    await this.deselectRoles(['idiot']);
    await this.decreaseStepper('villager', 3); // 4 → 1

    // Switch to wolf faction tab to adjust wolf count
    await this.switchToFactionTab('Wolf');
    await this.decreaseStepper('wolf', 2); // 4 → 2
  }

  // ---------------------------------------------------------------------------
  // Custom Template Builder
  // ---------------------------------------------------------------------------

  /**
   * Configure a custom template from default Seer-Witch-Hunter-Villager (4w + seer + witch + hunter + idiot + 4v = 12).
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

    // --- good faction (active by default) ---
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

    // --- wolf faction ---
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

    // --- Third-party faction (if needed) ---
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

  /** Press "下一步" without expecting the Rules step (board validation may reject). */
  async pressNext() {
    await this.nextButton.click();
  }

  /** Go to the Rules step with the current board. */
  async clickNext(): Promise<RulesPage> {
    await this.pressNext();
    const rules = new RulesPage(this.page);
    await rules.waitForReady();
    return rules;
  }

  /** Create the room with the current board and the rules as they come up. */
  async clickCreate() {
    const rules = await this.clickNext();
    await rules.clickCreate();
  }

  /** Save the edited board with the room's current rules. */
  async clickSave() {
    const rules = await this.clickNext();
    await rules.clickSave();
  }

  async clickBack() {
    await this.backButton.click();
  }
}
