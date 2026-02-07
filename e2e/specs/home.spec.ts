import { test, expect } from '../fixtures/app.fixture';
import { HomePage } from '../pages/HomePage';

/**
 * Home Screen E2E Tests
 *
 * Verifies:
 * - Navigation tiles visible
 * - Settings screen accessible
 * - Join room dialog accessible
 */
test.describe('Home Screen', () => {
  test('displays main navigation tiles', async ({ app }) => {
    const home = new HomePage(app.page);
    await home.expectNavigationTilesVisible();
  });

  test('can view settings screen', async ({ app }) => {
    const home = new HomePage(app.page);
    await home.clickSettings();

    await expect(app.page.getByText('👤 账户')).toBeVisible({ timeout: 5000 });
  });

  test('can access join room dialog', async ({ app }) => {
    const home = new HomePage(app.page);
    await home.clickJoinRoom();

    await expect(app.page.getByText('加入房间')).toBeVisible({ timeout: 10000 });
    await expect(app.page.getByText('输入4位房间号码')).toBeVisible();
  });
});
