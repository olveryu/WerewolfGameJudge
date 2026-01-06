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
