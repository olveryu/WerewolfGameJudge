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
test.describe('Config Screen', () => {
  test('can access config screen via board picker', async ({ app }) => {
    const home = new HomePage(app.page);
    await home.clickCreateRoom();

    const boardPicker = new BoardPickerPage(app.page);
    await boardPicker.waitForReady();
    await boardPicker.selectDefaultTemplate();

    const config = new ConfigPage(app.page);
    await config.waitForCreateMode();
    await config.expectTemplateVisible();
  });

  test('can select different templates via board picker', async ({ app }) => {
    const home = new HomePage(app.page);
    await home.clickCreateRoom();

    const boardPicker = new BoardPickerPage(app.page);
    await boardPicker.waitForReady();
    await boardPicker.selectTemplate('狼美守卫');

    const config = new ConfigPage(app.page);
    await config.waitForCreateMode();

    // Verify the selected template is shown
    await expect(app.page.getByText('狼美守卫')).toBeVisible({ timeout: 5000 });

    await config.clickBack();
  });

  test('can change template after initial selection', async ({ app }) => {
    const home = new HomePage(app.page);
    await home.clickCreateRoom();

    const boardPicker = new BoardPickerPage(app.page);
    await boardPicker.waitForReady();
    await boardPicker.selectDefaultTemplate();

    const config = new ConfigPage(app.page);
    await config.waitForCreateMode();

    // Go back to BoardPicker and select a different template
    await config.selectTemplate('狼美守卫');

    // Should be back on config screen with new template
    await config.waitForCreateMode();
    await expect(app.page.getByText('狼美守卫')).toBeVisible({ timeout: 5000 });

    await config.clickBack();
  });
});
