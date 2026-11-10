import { TESTIDS } from '../../packages/web/src/testids';
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
    const sheriffSwitch = app.page.getByTestId(TESTIDS.gameRuleSwitch('isSheriffElectionEnabled'));
    await expect(sheriffSwitch).toHaveAccessibleName('首日警长竞选');
    await expect(sheriffSwitch).toBeChecked();
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
    await expect(app.page.getByTestId(TESTIDS.configTemplatePill)).toHaveText('狼美守卫', {
      timeout: 5000,
    });

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
    await expect(app.page.getByTestId(TESTIDS.configTemplatePill)).toHaveText('狼美守卫', {
      timeout: 5000,
    });

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
  { gameType: 'undercover', title: '谁是卧底设置', submit: TESTIDS.gameConfigSubmit('undercover') },
] as const) {
  test(`${game.gameType} config keeps its primary action visible while content scrolls`, async ({
    app: { page },
  }, testInfo) => {
    await new HomePage(page).clickCreateRoom(game.gameType);
    await expect(page.getByTestId(TESTIDS.screenHeaderTitle)).toHaveText(game.title);
    await expect(page.getByTestId(game.submit)).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${game.gameType}-config.png`) });
    if (game.gameType === 'pictionary') {
      const unlimitedGallery = page.getByTestId(
        TESTIDS.gameConfigFieldOption('pictionary', 'galleryItemDurationSeconds', 'unlimited'),
      );
      await unlimitedGallery.scrollIntoViewIfNeeded();
      await expect(page.getByTestId(game.submit)).toBeInViewport();
      await expect(unlimitedGallery).toHaveText('不限时');
      await unlimitedGallery.click();
      await expect(unlimitedGallery).toBeChecked();
    }
  });
}
