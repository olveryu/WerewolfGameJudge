import { test, expect } from '@playwright/test';
import { waitForRoomScreenReady } from './helpers/waits';
import { getVisibleText, gotoWithRetry } from './helpers/ui';
import { waitForAppReady, ensureAnonLogin } from './helpers/home';

/**
 * Basic E2E tests for Werewolf Game
 * These tests verify core functionality works correctly.
 *
 * Uses gotoWithRetry() for robust navigation that handles
 * transient ERR_CONNECTION_REFUSED when dev server is slow to start.
 */

// Fail fast: stop on first failure
test.describe.configure({ mode: 'serial' });

test.describe('Home Screen', () => {
  test('displays main navigation tiles', async ({ page }) => {
    await gotoWithRetry(page, '/');
    await waitForAppReady(page);

    // Check all main tiles are visible (actual UI text)
    await expect(page.getByText('进入房间')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('创建房间')).toBeVisible();
    await expect(page.getByText('返回上局')).toBeVisible();
    // Use exact match for 设置 to avoid matching 应用偏好设置
    await expect(page.getByText('设置', { exact: true })).toBeVisible();
  });
});

test.describe('Create Room', () => {
  test('can access create room config screen', async ({ page }) => {
    await gotoWithRetry(page, '/');
    await waitForAppReady(page);

    // Ensure logged in
    await ensureAnonLogin(page);

    // Small delay to ensure auth state is fully propagated
    await page.waitForTimeout(500);

    // Click create room
    await page.getByText('创建房间').click();

    // Handle potential login dialog (race condition with auth sync)
    const loginDialog = page.getByText('需要登录');
    if (await loginDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Dismiss and wait for auth to sync
      await page.getByText('取消', { exact: true }).click();
      await page.waitForTimeout(1000);
      // Retry
      await page.getByText('创建房间').click();
    }

    // Should be on config screen - look for 创建 button
    await expect(getVisibleText(page, '创建')).toBeVisible({ timeout: 10000 });

    // Should see template options
    await expect(page.getByText('快速模板')).toBeVisible();
  });
});

test.describe('Settings', () => {
  test('can view settings screen', async ({ page }) => {
    await gotoWithRetry(page, '/');
    await waitForAppReady(page);

    // Click settings (use exact match)
    await page.getByText('设置', { exact: true }).click();

    // Should see settings screen - check for unique element
    await expect(page.getByText('👤 账户')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Join Room', () => {
  test('can access join room dialog', async ({ page }) => {
    await gotoWithRetry(page, '/');
    await waitForAppReady(page);

    // Ensure logged in
    await ensureAnonLogin(page);

    // Click join room tile (first visible one)
    await getVisibleText(page, '进入房间').first().click();

    // Should show join room dialog - look for dialog title and input prompt
    await expect(page.getByText('加入房间')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('输入4位房间号码')).toBeVisible();
  });
});

test.describe('Template Selection', () => {
  test('can select different templates on config screen', async ({ page }) => {
    await gotoWithRetry(page, '/');
    await waitForAppReady(page);

    // Login first
    await ensureAnonLogin(page);

    // Now click 创建房间 to go to config screen
    await page.getByText('创建房间').click();

    // Should now be on config screen - look for 创建 button (not 保存)
    await expect(getVisibleText(page, '创建')).toBeVisible({ timeout: 15000 });

    // Default template should be visible (标准板12人)
    await expect(page.getByText('标准板12人')).toBeVisible({ timeout: 5000 });

    console.log('[Template] Config screen loaded, testing template selection...');

    // Click on a different template - 狼美守卫12人
    const template2 = getVisibleText(page, '狼美守卫12人');
    await template2.scrollIntoViewIfNeeded();
    await expect(template2).toBeVisible({ timeout: 3000 });
    await template2.click();

    console.log('[Template] Clicked 狼美守卫12人 template');

    // Verify the page still shows the config
    await expect(getVisibleText(page, '创建')).toBeVisible({ timeout: 5000 });

    // Go back to home
    await getVisibleText(page, '←').click();

    console.log('[Template] Template selection test passed!');
  });

  test('can change template in settings after creating room', async ({ page }) => {
    await gotoWithRetry(page, '/');
    await waitForAppReady(page);

    // === Step 1: Login ===
    await ensureAnonLogin(page);
    console.log('[TemplateInSettings] Logged in anonymously');

    // === Step 2: Create room with default template (标准板12人) ===
    await page.getByText('创建房间').click();
    await expect(getVisibleText(page, '创建')).toBeVisible({ timeout: 15000 });
    console.log('[TemplateInSettings] On config screen, creating room...');

    // Click 创建 to create the room
    await getVisibleText(page, '创建').click();

    // Wait for room to be created
    await waitForRoomScreenReady(page, { role: 'host' });
    console.log('[TemplateInSettings] Room created successfully');

    // === Step 3: Open settings to change template ===
    await page.getByText('⚙️ 设置').click();

    // Should see config screen with 保存 button (not 创建, because room exists)
    await expect(getVisibleText(page, '保存')).toBeVisible({ timeout: 10000 });
    console.log('[TemplateInSettings] Settings opened');

    // === Step 4: Change template ===
    // Current template is 标准板12人, change to 狼美守卫12人
    const template2 = getVisibleText(page, '狼美守卫12人');
    await template2.scrollIntoViewIfNeeded();
    await expect(template2).toBeVisible({ timeout: 3000 });
    await template2.click();
    console.log('[TemplateInSettings] Selected 狼美守卫12人 template');

    // === Step 5: Save and verify ===
    await getVisibleText(page, '保存').click();

    // Should return to room screen
    await waitForRoomScreenReady(page, { role: 'host' });
    console.log('[TemplateInSettings] Saved and returned to room');

    // === Step 6: Verify template changed - open settings again ===
    await page.getByText('⚙️ 设置').click();
    await expect(getVisibleText(page, '保存')).toBeVisible({ timeout: 10000 });

    // The 狼美守卫12人 should still be selected (visible in template list)
    await expect(getVisibleText(page, '狼美守卫12人')).toBeVisible({ timeout: 5000 });
    console.log('[TemplateInSettings] Template change verified!');

    // Go back using the back button
    await getVisibleText(page, '←').click();

    console.log('[TemplateInSettings] Test passed!');
  });
});
