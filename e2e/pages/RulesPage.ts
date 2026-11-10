import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';

/**
 * RulesPage Page Object — final Werewolf config step.
 *
 * Reached from ConfigPage via "下一步：规则"; owns the house-rule switches and the
 * "创建房间" / "保存配置" submit button.
 */
export class RulesPage {
  constructor(private readonly page: Page) {}

  private get root() {
    return this.page.getByTestId(TESTIDS.gameRulesScreenRoot);
  }

  private get submitButton() {
    return this.page.getByTestId(TESTIDS.gameRulesSubmitButton);
  }

  /** Wait until the rules screen is visible. */
  async waitForReady() {
    await expect(this.root).toBeVisible({ timeout: 10000 });
  }

  /** Set a boolean house rule by its schema key, asserting the switch's label. */
  async setRule(rule: string, label: string, isEnabled: boolean): Promise<void> {
    const ruleSwitch = this.page.getByTestId(TESTIDS.gameRuleSwitch(rule));
    await expect(ruleSwitch).toHaveAccessibleName(label);
    await ruleSwitch.setChecked(isEnabled);
  }

  async setSheriffElectionEnabled(isEnabled: boolean): Promise<void> {
    await this.setRule('isSheriffElectionEnabled', '首日警长竞选', isEnabled);
  }

  /** Submit in create mode. */
  async clickCreate() {
    await expect(this.submitButton).toHaveText('创建房间');
    await this.submitButton.click();
  }

  /** Submit in edit mode. */
  async clickSave() {
    await expect(this.submitButton).toHaveText('保存配置');
    await this.submitButton.click();
  }
}
