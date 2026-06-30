import { expect, test } from '../fixtures/app.fixture';

/**
 * Fibking (瞎掰王) entry-flow E2E.
 *
 * Verifies the new game-mode entry path end-to-end against the real worker:
 *   Home → 创建房间 → 模式卡(瞎掰王) → FibConfig(选人数) → 创建房间 → FibRoom Lobby.
 *
 * The full multi-player round (4 seats → start → reveal) requires the multi-client
 * harness and is covered separately; this spec gates the single-client entry + create.
 */
test.describe('Fibking entry', () => {
  test('create via mode picker → fib config → fib room lobby', async ({ app }) => {
    const page = app.page;

    // Open the game-mode picker from "创建房间".
    await page.getByText('创建房间').click();
    await expect(page.getByText('选择游戏模式')).toBeVisible({ timeout: 5000 });

    // Pick 瞎掰王 → FibConfig.
    await page.getByTestId('mode-fibking').click();
    await expect(page.getByTestId('fib-config-confirm')).toBeVisible({ timeout: 5000 });

    // Bump player count once (5 → 6) and create.
    await page.getByTestId('fib-count-inc').click();
    await expect(page.getByTestId('fib-count')).toHaveText('6');
    await page.getByTestId('fib-config-confirm').click();

    // FibRoom Lobby: host primary button + rules link visible.
    await expect(page.getByTestId('fib-start-round')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('玩法说明 ⓘ')).toBeVisible();
    // 6 seats rendered (0..5).
    await expect(page.getByTestId('fib-seat-0')).toBeVisible();
    await expect(page.getByTestId('fib-seat-5')).toBeVisible();
  });
});
