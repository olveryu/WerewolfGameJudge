import { expect, test } from '../fixtures/app.fixture';
import { ConfigPage } from '../pages/ConfigPage';
import { HomePage } from '../pages/HomePage';
import { RoomPage } from '../pages/RoomPage';

/**
 * Config Screen E2E Tests
 *
 * Verifies:
 * - Config screen accessible via "创建房间"
 * - Template selection works
 * - Template change in settings after room creation persists
 */
test.describe('Config Screen', () => {
  test('can access config screen and see templates', async ({ app }) => {
    const home = new HomePage(app.page);
    await home.clickCreateRoom();

    const config = new ConfigPage(app.page);
    await config.waitForCreateMode();
    await config.expectTemplateVisible();
  });

  test('can select different templates', async ({ app }) => {
    const home = new HomePage(app.page);
    await home.clickCreateRoom();

    const config = new ConfigPage(app.page);
    await config.waitForCreateMode();

    // Open dropdown and select alternate template
    await config.openTemplateDropdown('预女猎白');
    await config.selectTemplate('狼美守卫');

    // Should still be on config screen
    await config.waitForCreateMode();

    await config.clickBack();
  });

  test('can change template in settings after creating room', async ({ app }) => {
    const home = new HomePage(app.page);
    await home.clickCreateRoom();

    const config = new ConfigPage(app.page);
    await config.waitForCreateMode();
    await config.clickCreate();

    const room = new RoomPage(app.page);
    await room.waitForReady('host');

    // Open settings → should be in save mode
    await room.openSettings();
    const editConfig = new ConfigPage(app.page);
    await editConfig.waitForSaveMode();

    // Change template
    await editConfig.openTemplateDropdown('预女猎白');
    await editConfig.selectTemplate('狼美守卫');

    // Save and return to room
    await editConfig.clickSave();
    await room.waitForReady('host');

    // Verify: re-open settings, template should be persisted
    await room.openSettings();
    await editConfig.waitForSaveMode();
    await expect(app.page.getByText('狼美守卫')).toBeVisible({ timeout: 5000 });

    await editConfig.clickBack();
  });
});
