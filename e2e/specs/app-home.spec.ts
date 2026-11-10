import { TESTIDS } from '../../packages/web/src/testids';
import { expect, test } from '../fixtures/app.fixture';
import { HomePage } from '../pages/HomePage';

/**
 * Home Screen E2E Tests
 *
 * Verifies:
 * - Navigation tiles visible
 * - Settings screen accessible
 * - Join room dialog accessible
 */
test.describe('App — Home Screen', () => {
  test('displays main navigation tiles', async ({ app }) => {
    const home = new HomePage(app.page);
    await home.expectNavigationTilesVisible();
  });

  test('can view settings screen', async ({ app }) => {
    const home = new HomePage(app.page);
    await home.clickSettings();

    await expect(app.page.getByTestId(TESTIDS.screenHeaderTitle)).toHaveText('设置', {
      timeout: 5000,
    });
  });

  test('can access join room dialog', async ({ app }) => {
    const home = new HomePage(app.page);
    await home.clickJoinRoom();

    await expect(app.page.getByTestId(TESTIDS.joinRoomDialog)).toHaveAccessibleDescription(
      '输入4位房间号码',
    );
  });
});
