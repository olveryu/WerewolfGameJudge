import { TESTIDS } from '../../src/testids';
import { expect, test } from '../fixtures/app.fixture';
import { BoardPickerPage } from '../pages/BoardPickerPage';
import { ConfigPage } from '../pages/ConfigPage';
import { HomePage } from '../pages/HomePage';

/**
 * Config Screen E2E Tests
 *
 * Verifies:
 * - BoardPicker accessible via "创建房间", then Config via template selection
 * - Template selection works (via BoardPicker navigation)
 * - Config screen displays selected template
 */
test.describe('Werewolf — Config Screen', () => {
  test('can access config screen via board picker', async ({ app }) => {
    const home = new HomePage(app.page);
    await home.clickCreateRoom('werewolf');

    const boardPicker = new BoardPickerPage(app.page);
    await boardPicker.waitForReady();
    await boardPicker.selectDefaultTemplate();

    const config = new ConfigPage(app.page);
    await config.waitForReady();
    await config.expectTemplateVisible();
    await expect(app.page.getByTestId(TESTIDS.configNextButton)).toBeInViewport();
    await app.page.screenshot({ path: test.info().outputPath('werewolf-config.png') });

    const rules = await config.clickNext();
    await expect(app.page.getByRole('switch', { name: '首日警长竞选', exact: true })).toBeChecked();
    await rules.setSheriffElectionEnabled(false);
    await expect(app.page.getByTestId(TESTIDS.gameRulesSubmitButton)).toBeInViewport();
    await app.page.screenshot({ path: test.info().outputPath('werewolf-rules.png') });
  });

  test('can select different templates via board picker', async ({ app }) => {
    const home = new HomePage(app.page);
    await home.clickCreateRoom('werewolf');

    const boardPicker = new BoardPickerPage(app.page);
    await boardPicker.waitForReady();
    await boardPicker.selectTemplate('狼美守卫');

    const config = new ConfigPage(app.page);
    await config.waitForReady();

    // Verify the selected template is shown
    const configRoot = app.page.locator(`[data-testid="config-screen-root"]`);
    await expect(configRoot.getByText('狼美守卫')).toBeVisible({ timeout: 5000 });

    await config.clickBack();
  });

  test('can change template after initial selection', async ({ app }) => {
    const home = new HomePage(app.page);
    await home.clickCreateRoom('werewolf');

    const boardPicker = new BoardPickerPage(app.page);
    await boardPicker.waitForReady();
    await boardPicker.selectDefaultTemplate();

    const config = new ConfigPage(app.page);
    await config.waitForReady();

    // Go back to BoardPicker and select a different template
    await config.selectTemplate('狼美守卫');

    // Should be back on config screen with new template
    await config.waitForReady();
    const configRoot2 = app.page.locator(`[data-testid="config-screen-root"]`);
    await expect(configRoot2.getByText('狼美守卫')).toBeVisible({ timeout: 5000 });

    await config.clickBack();
  });
});

for (const game of [
  { gameType: 'fibking', title: '瞎掰王设置', submit: TESTIDS.gameConfigSubmit('fibking') },
  {
    gameType: 'pictionary',
    title: '你画我猜接龙设置',
    submit: TESTIDS.gameConfigSubmit('pictionary'),
  },
  { gameType: 'undercover', title: '谁是卧底设置', submit: 'undercover-config-submit' },
] as const) {
  test(`${game.gameType} config keeps its primary action visible while content scrolls`, async ({
    app: { page },
  }, testInfo) => {
    await new HomePage(page).clickCreateRoom(game.gameType);
    await expect(page.getByText(game.title, { exact: true })).toBeVisible();
    await expect(page.getByTestId(game.submit)).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${game.gameType}-config.png`) });
    if (game.gameType === 'pictionary') {
      await page.getByText('结果播放', { exact: true }).scrollIntoViewIfNeeded();
      await expect(page.getByTestId(game.submit)).toBeInViewport();
      await page.getByRole('radio', { name: '不限时', exact: true }).last().click();
      await expect(page.getByRole('radio', { name: '不限时', exact: true }).last()).toBeChecked();
    }
  });
}
