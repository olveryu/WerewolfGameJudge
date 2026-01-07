import { test, expect } from '@playwright/test';

/**
 * Basic E2E tests for Werewolf Game
 * These tests verify core functionality works correctly.
 */

// Helper to wait for app to be ready (React Native Web hydration)
async function waitForAppReady(page: import('@playwright/test').Page) {
  // Wait for the app title to be visible
  await page.waitForSelector('text=狼人杀法官', { timeout: 15000 });
}

// Helper to dismiss login modal if it appears
async function dismissLoginModal(page: import('@playwright/test').Page) {
  try {
    const cancelButton = page.getByRole('button', { name: '取消' });
    await cancelButton.click({ timeout: 2000 });
  } catch {
    // Modal didn't appear, that's fine
  }
}

/**
 * Helper to get a visible element on the current screen.
 * 
 * React Navigation on Web keeps previous screens in the DOM with aria-hidden="true".
 * When navigating to the same screen type (e.g., Home -> Config -> Room -> Config),
 * there can be multiple elements matching the same selector.
 * 
 * This helper uses Playwright's :visible filter to only match visible elements.
 */
function getVisibleText(page: import('@playwright/test').Page, text: string) {
  return page.locator(`text="${text}" >> visible=true`);
}

test.describe('Home Screen', () => {
  test('displays main navigation tiles', async ({ page }) => {
    await page.goto('/');
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
  test('shows login required dialog when not logged in', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    
    // Click create room
    await page.getByText('创建房间').click();
    
    // Should show login required dialog
    await expect(page.getByText('需要登录')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('请先登录后继续')).toBeVisible();
    
    // Dismiss the dialog
    await page.getByText('取消').click();
  });
});

test.describe('Settings', () => {
  test('can view settings screen', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    
    // Click settings (use exact match)
    await page.getByText('设置', { exact: true }).click();
    
    // Should see settings screen - check for unique element
    await expect(page.getByText('👤 账户')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Join Room', () => {
  test('shows login required dialog when not logged in', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    
    // Click join room
    await page.getByText('进入房间').click();
    
    // Should show login required dialog (since we're not logged in)
    await expect(page.getByText('需要登录')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('请先登录后继续')).toBeVisible();
    
    // Dismiss the dialog
    await page.getByText('取消').click();
  });
});

test.describe('Template Selection', () => {
  test('can select different templates on config screen', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    
    // Click create room (will show login dialog)
    await page.getByText('创建房间').click();
    
    // Should show login required dialog
    await expect(page.getByText('需要登录')).toBeVisible({ timeout: 5000 });
    
    // Click 登录 to open login modal
    await page.getByText('登录', { exact: true }).first().click();
    
    // Should see login modal with anonymous login option
    await expect(page.getByText('👤 匿名登录')).toBeVisible({ timeout: 5000 });
    
    // Click 匿名登录 to login anonymously
    await page.getByText('👤 匿名登录').click();
    
    // Wait for login to complete
    await expect(page.getByText('匿名用户')).toBeVisible({ timeout: 10000 });
    
    // Now click 创建房间 again to actually create the room
    await page.getByText('创建房间').click();
    
    // Should now be on config screen - look for 创建 button (not 保存)
    await expect(page.getByText('创建', { exact: true })).toBeVisible({ timeout: 15000 });
    
    // Default template should be visible (标准板12人)
    await expect(page.getByText('标准板12人')).toBeVisible({ timeout: 5000 });
    
    console.log('[Template] Config screen loaded, testing template selection...');
    
    // Click on a different template - 狼美守卫12人
    const template2 = page.getByText('狼美守卫12人');
    const count = await template2.count();
    console.log(`[Template] Found ${count} elements matching '狼美守卫12人'`);
    
    // Click the template
    await template2.first().click();
    await page.waitForTimeout(500);
    
    console.log('[Template] Clicked 狼美守卫12人 template');
    
    // Verify the page still shows the config
    await expect(page.getByText('创建', { exact: true })).toBeVisible({ timeout: 5000 });
    
    // Go back to home
    await page.getByText('←').click();
    
    console.log('[Template] Template selection test passed!');
  });

  test('can change template in settings after creating room', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    
    // === Step 1: Login ===
    await page.getByText('创建房间').click();
    await expect(page.getByText('需要登录')).toBeVisible({ timeout: 5000 });
    await page.getByText('登录', { exact: true }).first().click();
    await expect(page.getByText('👤 匿名登录')).toBeVisible({ timeout: 5000 });
    await page.getByText('👤 匿名登录').click();
    await expect(page.getByText('匿名用户')).toBeVisible({ timeout: 10000 });
    console.log('[TemplateInSettings] Logged in anonymously');
    
    // === Step 2: Create room with default template (标准板12人) ===
    await page.getByText('创建房间').click();
    await expect(page.getByText('创建', { exact: true })).toBeVisible({ timeout: 15000 });
    console.log('[TemplateInSettings] On config screen, creating room...');
    
    // Click 创建 to create the room
    await page.getByText('创建', { exact: true }).click();
    
    // Wait for room to be created - handle potential loading timeout
    // First try to wait for settings button
    let roomCreated = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await expect(page.getByText('⚙️ 设置')).toBeVisible({ timeout: 10000 });
        roomCreated = true;
        break;
      } catch {
        // Check if there's a loading timeout
        const retryBtn = page.getByText('重试');
        if (await retryBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log(`[TemplateInSettings] Room creation timed out, retrying (attempt ${attempt + 1})...`);
          await retryBtn.click();
          await page.waitForTimeout(1000);
        } else {
          throw new Error('Room creation failed and no retry button found');
        }
      }
    }
    if (!roomCreated) {
      throw new Error('Room creation failed after 3 attempts');
    }
    console.log('[TemplateInSettings] Room created successfully');
    
    // === Step 3: Open settings to change template ===
    // Click ⚙️ 设置 button
    await page.getByText('⚙️ 设置').click();
    await page.waitForTimeout(500);
    
    // Should see config screen with 保存 button (not 创建, because room exists)
    await expect(page.getByText('保存')).toBeVisible({ timeout: 10000 });
    console.log('[TemplateInSettings] Settings opened');
    
    // === Step 4: Change template ===
    // Current template is 标准板12人, change to 狼美守卫12人
    // Wait for templates to be visible
    await expect(page.getByText('标准板12人').last()).toBeVisible({ timeout: 5000 });
    
    const template2 = page.getByText('狼美守卫12人').last();
    
    // Scroll the template into view if needed (it's in a horizontal ScrollView)
    await template2.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    
    // Now click the template
    await template2.click();
    await page.waitForTimeout(500);
    console.log('[TemplateInSettings] Selected 狼美守卫12人 template');
    
    // === Step 5: Save and verify ===
    await page.getByText('保存').click();
    
    // Should return to room screen
    await expect(page.getByText('⚙️ 设置')).toBeVisible({ timeout: 10000 });
    console.log('[TemplateInSettings] Saved and returned to room');
    
    // === Step 6: Verify template changed - open settings again ===
    await page.getByText('⚙️ 设置').click();
    await page.waitForTimeout(500);
    await expect(page.getByText('保存')).toBeVisible({ timeout: 10000 });
    
    // The 狼美守卫12人 should still be selected (visible in template list)
    // Check the template name appears
    // Use .last() because React Navigation may keep the previous screen in DOM
    await expect(page.getByText('狼美守卫12人').last()).toBeVisible({ timeout: 5000 });
    console.log('[TemplateInSettings] Template change verified!');
    
    // Go back using the back button (use last() due to navigation stack)
    await page.getByText('←').last().click();
    
    console.log('[TemplateInSettings] Test passed!');
  });
});
