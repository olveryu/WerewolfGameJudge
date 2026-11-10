import { FIB_MAX_PLAYERS, FIB_MIN_PLAYERS } from '@game-judge/game-engine/games/fibking/public';
import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { pressAlertButton } from '../helpers/alerts';

const PLAYER_COUNT = TESTIDS.gameConfigField('fibking', 'numberOfPlayers');
const PLAYER_COUNT_INCREMENT = TESTIDS.gameConfigFieldIncrement('fibking', 'numberOfPlayers');
const SUBMIT = TESTIDS.gameConfigSubmit('fibking');

/** FibKing-owned config interactions over the shared schema-driven GameConfig screen. */
export class FibConfigPage {
  constructor(private readonly page: Page) {}

  async waitForCreateMode(): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.configScreenRoot)).toBeVisible({
      timeout: 10_000,
    });
    await expect(this.page.getByTestId(TESTIDS.screenHeaderTitle)).toHaveText('瞎掰王设置');
    await expect(this.page.getByTestId(PLAYER_COUNT)).toHaveValue('8');
    await expect(this.page.getByTestId(SUBMIT)).toHaveText('创建房间');
  }

  async setPlayerCount(count: number): Promise<void> {
    if (!Number.isSafeInteger(count) || count < FIB_MIN_PLAYERS || count > FIB_MAX_PLAYERS) {
      throw new Error(
        `FibConfigPage requires ${FIB_MIN_PLAYERS}-${FIB_MAX_PLAYERS} players, received ${count}`,
      );
    }
    const input = this.page.getByTestId(PLAYER_COUNT);
    await input.fill(String(count));
    await expect(input).toHaveValue(String(count));
  }

  async increment(): Promise<void> {
    const incrementButton = this.page.getByTestId(PLAYER_COUNT_INCREMENT);
    await expect(incrementButton).toHaveAccessibleName('增加人数');
    await incrementButton.click();
  }

  /** At the maximum the increment control is disabled instead of alerting. */
  async expectIncrementDisabledAtMaximum(): Promise<void> {
    await expect(this.page.getByTestId(PLAYER_COUNT_INCREMENT)).toBeDisabled();
    await expect(this.page.getByTestId(PLAYER_COUNT)).toHaveValue(String(FIB_MAX_PLAYERS));
  }

  async expectPlayerCount(count: number): Promise<void> {
    await expect(this.page.getByTestId(PLAYER_COUNT)).toHaveValue(String(count));
  }

  async createRoom(): Promise<void> {
    await this.page.getByTestId(SUBMIT).click();
  }

  async save(): Promise<void> {
    await expect(this.page.getByTestId(SUBMIT)).toHaveText('保存设置');
    await this.page.getByTestId(SUBMIT).click();
  }

  async saveExpectingRejectedShrink(): Promise<void> {
    await this.save();
    await expect(this.page.getByTestId(TESTIDS.alertMessage)).toHaveText(
      '目标人数之外的座位仍有真人入座，请先让这些玩家离座或换到空位',
    );
    await pressAlertButton(this.page, {
      title: '保存设置失败',
      buttonIndex: 0,
      buttonLabel: '确定',
    });
    await expect(this.page.getByTestId(TESTIDS.alertModalOverlay)).not.toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.configScreenRoot)).toBeVisible();
  }
}
