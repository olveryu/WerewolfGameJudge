import { Page } from '@playwright/test';

// Helper to wait for app to be ready (React Native Web hydration)
export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForSelector('text=狼人杀法官', { timeout: 15000 });
}

/**
 * Helper to get a visible element on the current screen.
 *
 * React Navigation on Web keeps previous screens in the DOM with aria-hidden="true".
 * When navigating to the same screen type (e.g., Home -> Config -> Room -> Config),
 * there can be multiple elements matching the same selector.
 */
export function getVisibleText(page: Page, text: string) {
  return page.locator(`text="${text}" >> visible=true`);
}
