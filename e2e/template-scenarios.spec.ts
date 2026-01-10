import { test, expect, Page, BrowserContext } from '@playwright/test';
import { waitForAppReady } from './helpers/home';
import { withStep, gotoWithRetry } from './helpers/ui';

/**
 * [DEPRECATED - SKIPPED]
 * 
 * Template Scenario E2E Tests - LEGACY FILE
 * 
 * This file is SKIPPED because:
 * 1. E2E 不应裁决模板结果（狼刀谁/女巫救不救/最后死谁）
 * 2. 这种测试太依赖 UI/网络/selector/弹窗，flaky 且维护成本爆炸
 * 3. 模板正确性（谁死/平安夜/昨夜信息）已下沉到 Jest:
 *    - src/models/__tests__/templates/contract.test.ts (数据自洽)
 *    - src/models/__tests__/templates/<TemplateName>.test.ts (场景覆盖)
 * 
 * E2E 只保留 smoke 测试 (night1.basic.spec.ts)：
 * - 验证"流程可跑通 + UI 可见"
 * - 不写"精确死亡名单/精确昨夜信息文本"的断言
 * 
 * 若需重新启用，移除下方的 test.describe.skip
 */

// Increase timeout for multiplayer tests
test.setTimeout(300000);

// Fail fast: stop on first failure
test.describe.configure({ mode: 'serial' });

// ============ HELPER FUNCTIONS ============

/**
 * Diagnose the environment: print page origin and any supabase config we can extract.
 * This helps identify if the app is hitting the wrong supabase URL or can't reach it.
 */
async function diagnoseEnvironment(page: Page, label: string): Promise<void> {
  try {
    console.log(`\n========== ENVIRONMENT DIAGNOSIS: ${label} ==========`);
    
    const envInfo = await page.evaluate(() => {
      const info: Record<string, string> = {};
      
      // Page origin
      info['window.location.origin'] = window.location.origin;
      info['window.location.href'] = window.location.href;
      
      // Try to get Expo public env vars (available in web builds)
      if (typeof process !== 'undefined' && process.env) {
        info['EXPO_PUBLIC_SUPABASE_URL'] = process.env.EXPO_PUBLIC_SUPABASE_URL || '(not set)';
        info['EXPO_PUBLIC_SUPABASE_ANON_KEY'] = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? '(set, hidden)' : '(not set)';
      } else {
        info['process.env'] = '(not available in browser)';
      }
      
      // Try to find supabase client config in window (some apps expose it)
      // @ts-expect-error
      if (window.__SUPABASE_URL__) {
        // @ts-expect-error
        info['window.__SUPABASE_URL__'] = window.__SUPABASE_URL__;
      }
      
      return info;
    });
    
    for (const [key, value] of Object.entries(envInfo)) {
      console.log(`  ${key}: ${value}`);
    }
    
    console.log(`========== END DIAGNOSIS ==========\n`);
  } catch (e) {
    console.log(`[diagnoseEnvironment] Error: ${e}`);
  }
}

/**
 * Dismiss the "加载超时" dialog if it is present.
 *
 * - If the dialog is present (either "加载超时" text, or "重试"/"返回" is visible), click:
 *   - "重试" first (preferred); otherwise "返回"
 * - Never throws (let withStep handle throwing)
 * - Returns true if something was dismissed
 */
async function dismissLoadingTimeoutIfPresent(page: Page, label: string): Promise<boolean> {
  try {
    const hasTimeoutText = await page.getByText('加载超时').isVisible({ timeout: 800 }).catch(() => false);

    // Match variants like "✓ 重试" / "重试" (same for 返回)
    const retryBtn = page.getByText(/重试/);
    const backBtn = page.getByText(/返回/);
    const retryVisible = await retryBtn.isVisible({ timeout: 800 }).catch(() => false);
    const backVisible = await backBtn.isVisible({ timeout: 800 }).catch(() => false);

    if (!hasTimeoutText && !retryVisible && !backVisible) {
      return false;
    }

    let via: 'retry' | 'back';
    if (retryVisible) {
      via = 'retry';
      console.log(`[TimeoutDialog][${label}] found via ${via}`);
      await retryBtn.first().click({ timeout: 2000 }).catch(() => {});
    } else if (backVisible) {
      via = 'back';
      console.log(`[TimeoutDialog][${label}] found via ${via}`);
      await backBtn.first().click({ timeout: 2000 }).catch(() => {});
    } else {
      // We saw "加载超时" but no actionable buttons
      console.log(`[TimeoutDialog][${label}] found (no retry/back visible)`);
      await page.waitForTimeout(500);
      return true;
    }

    await page.waitForTimeout(500);
    console.log(`[TimeoutDialog][${label}] dismissed via ${via}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Dismiss any generic alert dialogs that might block the UI.
 * Examples:
 *   - "没有上局游戏记录" with "确定" button
 *   - "提示" with "确定" button
 * Never throws; returns true if a dialog was dismissed.
 */
async function dismissGenericAlertIfPresent(page: Page, label: string): Promise<boolean> {
  try {
    // Check for common alert patterns
    const alerts = [
      { text: '没有上局游戏记录', btn: '确定' },
      { text: '提示', btn: '确定' },
    ];
    
    for (const alert of alerts) {
      const hasAlert = await page.getByText(alert.text).isVisible({ timeout: 500 }).catch(() => false);
      if (hasAlert) {
        console.log(`[GenericAlert][${label}] Found: "${alert.text}"`);
        const btn = page.getByText(alert.btn, { exact: true });
        if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(300);
          console.log(`[GenericAlert][${label}] Dismissed via "${alert.btn}"`);
          return true;
        }
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Dismiss "需要登录" / "请先登录后继续" dialog and complete anonymous login.
 * - Detects login-required overlays and completes the full login flow
 * - Never throws; returns true if login was needed and completed
 */
async function dismissLoginRequiredIfPresent(page: Page, label: string): Promise<boolean> {
  try {
    // Check for login-required overlay (either variant)
    const hasLoginRequired1 = await page.getByText('需要登录').isVisible({ timeout: 800 }).catch(() => false);
    const hasLoginRequired2 = await page.getByText('请先登录后继续').isVisible({ timeout: 500 }).catch(() => false);
    const hasLoginRequired3 = await page.getByText('请先登陆后继续').isVisible({ timeout: 500 }).catch(() => false);

    if (!hasLoginRequired1 && !hasLoginRequired2 && !hasLoginRequired3) {
      return false;
    }

    console.log(`[LoginRequired][${label}] found`);

    // Priority 1: Click "点击登录" if visible
    const clickLoginBtn = page.getByText('点击登录');
    if (await clickLoginBtn.isVisible({ timeout: 800 }).catch(() => false)) {
      console.log(`[LoginRequired][${label}] clicking 点击登录`);
      await clickLoginBtn.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(500);
    }

    // Priority 2: Click anonymous login button (use regex to match variants)
    const anonLoginBtn = page.getByText(/匿名登录/);
    if (await anonLoginBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log(`[LoginRequired][${label}] clicking 匿名登录`);
      await anonLoginBtn.first().click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    // Wait for login to complete (匿名用户 visible = logged in)
    console.log(`[LoginRequired][${label}] waiting for login to complete...`);
    await expect(page.getByText('匿名用户')).toBeVisible({ timeout: 15000 });

    // IMPORTANT: After login, the dialog may still be visible. Wait for it to dismiss.
    // If it doesn't auto-dismiss, click "取消" to close it.
    await page.waitForTimeout(500);
    const dialogStillVisible = await page.getByText('需要登录').isVisible({ timeout: 500 }).catch(() => false);
    if (dialogStillVisible) {
      console.log(`[LoginRequired][${label}] dialog still visible after login, clicking 取消`);
      const cancelBtn = page.getByText('取消', { exact: true });
      if (await cancelBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await cancelBtn.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(300);
      }
    }

    // Final wait for dialog to be fully gone
    await page.getByText('需要登录').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

    console.log(`[LoginRequired][${label}] completed anonymous login`);
    return true;
  } catch (e) {
    console.log(`[LoginRequired][${label}] error: ${e}`);
    return false;
  }
}

async function waitForLoggedIn(page: Page, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
  // Optional but recommended: dismiss any transient timeout dialog before we do anything else.
  await dismissLoadingTimeoutIfPresent(page, `waitForLoggedIn attempt ${attempt}`).catch(() => {});

    if (await page.getByText('👤 匿名登录').isVisible().catch(() => false)) {
      await page.getByText('取消').click().catch(() => {});
      await page.waitForTimeout(500);
    }
    
    await expect(
      page.getByText('匿名用户').or(page.getByText('点击登录'))
    ).toBeVisible({ timeout: 10000 });
    
    const noModalBlocking = !(await page.getByText('👤 匿名登录').isVisible().catch(() => false));
    if (noModalBlocking && await page.getByText('匿名用户').isVisible()) {
      return;
    }
    
    console.log(`[Login] Attempt ${attempt}/${maxRetries}...`);
    await page.getByText('点击登录').click();
    await expect(page.getByText('👤 匿名登录')).toBeVisible({ timeout: 5000 });
    await page.getByText('👤 匿名登录').click();
    
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      
      if (await page.getByText('登录失败').isVisible().catch(() => false)) {
        await page.getByText('确定', { exact: true }).click();
        await expect(page.getByText('登录失败')).not.toBeVisible({ timeout: 3000 }).catch(() => {});
        const waitTime = 3000 * attempt;
        await page.waitForTimeout(waitTime);
        break;
      }
      
      const modalClosed = !(await page.getByText('👤 匿名登录').isVisible().catch(() => false));
      if (modalClosed && await page.getByText('匿名用户').isVisible().catch(() => false)) {
        return;
      }
    }
  }
  
  throw new Error(`Login failed after ${maxRetries} attempts`);
}

// Click on a specific seat number tile (1-based)
async function clickSeat(page: Page, seatNumber: number): Promise<void> {
  // The seat tiles are rendered with seat number as text
  // Wait a bit for the UI to be interactive
  await page.waitForTimeout(500);
  
  // Find all elements with the seat number text
  const seatLocator = page.locator(`text="${seatNumber}"`);
  const count = await seatLocator.count();
  console.log(`      [clickSeat] Found ${count} elements with text "${seatNumber}"`);
  
  // Click the first visible one
  await expect(seatLocator.first()).toBeVisible({ timeout: 5000 });
  await seatLocator.first().click();
  await page.waitForTimeout(500);
}

// Confirm action dialog (with network error handling)
async function confirmAction(page: Page): Promise<void> {
  console.log(`      [confirmAction] Looking for 确定 button...`);
  
  // Wait for either 确定 button or 重试 button (network error)
  const maxWaitTime = 30000; // Increased to 30s to handle slow network + retry
  const startTime = Date.now();
  let hasClickedConfirm = false;
  let retryCount = 0;
  const maxRetries = 5;
  
  while (Date.now() - startTime < maxWaitTime) {
    // Check for network error retry dialog first
    const retryButton = page.getByText('重试', { exact: true });
    if (await retryButton.isVisible({ timeout: 100 }).catch(() => false)) {
      retryCount++;
      console.log(`      [confirmAction] Found network error dialog, retry attempt ${retryCount}/${maxRetries}...`);
      
      if (retryCount > maxRetries) {
        throw new Error(`confirmAction: Too many retries (${retryCount}), network appears unstable`);
      }
      
      await retryButton.click();
      // Wait longer after retry for RPC to complete (up to 10s timeout)
      await page.waitForTimeout(2000);
      
      // After retry, wait for UI to stabilize
      // Don't assume "dialog gone = success" - keep checking
      continue; // Keep looping to check actual state
    }
    
    // Check for 确定 button
    const confirmButton = page.getByText('确定', { exact: true });
    if (await confirmButton.isVisible({ timeout: 100 }).catch(() => false)) {
      await confirmButton.click();
      hasClickedConfirm = true;
      console.log(`      [confirmAction] Clicked 确定`);
      
      // Wait for RPC to complete
      await page.waitForTimeout(1000);
      
      // Keep looping to check if retry dialog appears
      continue;
    }
    
    // If we've clicked confirm before and now no dialogs are visible, we're done
    if (hasClickedConfirm) {
      const anyDialog = await confirmButton.isVisible({ timeout: 100 }).catch(() => false) ||
                        await retryButton.isVisible({ timeout: 100 }).catch(() => false);
      if (!anyDialog) {
        console.log(`      [confirmAction] No dialogs visible after confirm, success`);
        return;
      }
    }
    
    await page.waitForTimeout(200);
  }
  
  throw new Error('confirmAction: 确定 button not found within timeout');
}

// Wait for and dismiss the "好" dialog after audio plays (with network error handling)
async function waitForActionDialog(page: Page, timeoutMs = 30000): Promise<void> {
  // Wait for any dialog element to appear
  // We check for specific elements that indicate a dialog is ready
  const startTime = Date.now();
  let lastDebugTime = 0;
  while (Date.now() - startTime < timeoutMs) {
    // Debug: print page state every 5 seconds
    const elapsed = Date.now() - startTime;
    if (elapsed - lastDebugTime > 5000) {
      lastDebugTime = elapsed;
      // Check if we're in the room and game is ongoing
      const isInRoom = await page.getByText(/房间 \d{4}/).isVisible().catch(() => false);
      const seeRoleBtn = await page.getByText('查看身份').isVisible().catch(() => false);
      const skipBtn = await page.getByText('跳过').isVisible().catch(() => false);
      const pageUrl = page.url();
      console.log(`      [waitForActionDialog] ${elapsed}ms - URL: ${pageUrl}, inRoom: ${isInRoom}, seeRoleBtn: ${seeRoleBtn}, skipBtn: ${skipBtn}`);
    }
    
    // Check for network error retry dialog and click it
    const retryButton = page.getByText('重试', { exact: true });
    if (await retryButton.isVisible({ timeout: 50 }).catch(() => false)) {
      console.log(`      [waitForActionDialog] Network error dialog detected, clicking retry...`);
      await retryButton.click();
      await page.waitForTimeout(500);
      continue;
    }
    
    // Check for "好" button
    if (await page.getByText('好', { exact: true }).isVisible().catch(() => false)) {
      return;
    }
    // Check for witch save dialog (救助/不救助 buttons)
    if (await page.getByText('是否救助?').isVisible().catch(() => false)) {
      return;
    }
    // Check for "昨夜无人倒台"
    if (await page.getByText('昨夜无人倒台').isVisible().catch(() => false)) {
      return;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`waitForActionDialog: No dialog appeared within ${timeoutMs}ms`);
}

// Dismiss "好" dialog after audio - used for most roles
async function dismissActionDialog(page: Page): Promise<void> {
  // First wait for the dialog to appear
  await waitForActionDialog(page);
  
  // If it's the "好" button, click it
  const okButton = page.getByText('好', { exact: true });
  if (await okButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await okButton.click();
    await page.waitForTimeout(300);
  }
}

// Skip current role's action - click skip button then confirm
async function skipAction(page: Page, timeout: number = 5000): Promise<void> {
  // Look for skip button: "不使用技能" or "投票空刀"
  const skipButton = page.getByText('不使用技能').or(page.getByText('投票空刀'));
  await expect(skipButton).toBeVisible({ timeout });
  await skipButton.click();
  await page.waitForTimeout(300);
  await confirmAction(page);
}

// Handle witch action - complex dialog flow
async function executeWitchAction(
  page: Page,
  targetSeat: number | null,
  isPoison: boolean,
  witchWasKilled: boolean = false
): Promise<void> {
  // Wait for witch dialog with longer timeout
  await waitForActionDialog(page);
  
  // Check what dialog we have - use longer timeout due to Supabase sync delays
  const noVictimText = page.getByText('昨夜无人倒台');
  const cannotSaveSelfText = page.getByText('女巫无法自救');
  const saveButton = page.getByText('救助', { exact: true });
  const noSaveButton = page.getByText('不救助', { exact: true });
  
  // Wait for dialog to stabilize - Supabase real-time can cause flaky UI updates
  // Poll for either dialog type with longer timeout
  const dialogTimeout = 15000;
  const startTime = Date.now();
  let foundNoVictim = false;
  let foundCannotSaveSelf = false;
  let foundSaveDialog = false;
  
  console.log('    [Witch] Waiting for witch dialog to stabilize...');
  
  while (Date.now() - startTime < dialogTimeout) {
    foundNoVictim = await noVictimText.isVisible().catch(() => false);
    foundCannotSaveSelf = await cannotSaveSelfText.isVisible().catch(() => false);
    foundSaveDialog = await saveButton.isVisible().catch(() => false);
    
    if (foundNoVictim || foundCannotSaveSelf || foundSaveDialog) {
      // Wait a bit more to ensure dialog is stable
      await page.waitForTimeout(500);
      // Re-check to make sure it's still there
      foundNoVictim = await noVictimText.isVisible().catch(() => false);
      foundCannotSaveSelf = await cannotSaveSelfText.isVisible().catch(() => false);
      foundSaveDialog = await saveButton.isVisible().catch(() => false);
      if (foundNoVictim || foundCannotSaveSelf || foundSaveDialog) {
        break;
      }
    }
    await page.waitForTimeout(200);
  }
  
  console.log(`    [Witch] Dialog found: noVictim=${foundNoVictim}, cannotSaveSelf=${foundCannotSaveSelf}, saveDialog=${foundSaveDialog}`);
  
  if (foundNoVictim) {
    // No one killed - click "好" to continue
    console.log('    [Witch] No victim - clicking 好');
    await page.getByText('好', { exact: true }).click();
    await page.waitForTimeout(500);
    
    if (targetSeat !== null && isPoison) {
      // Use poison
      console.log(`    [Witch] Using poison on seat ${targetSeat}`);
      await clickSeat(page, targetSeat);
      await confirmAction(page);
    } else {
      // Skip - click "不使用技能"
      console.log('    [Witch] Skipping poison');
      await skipAction(page);
    }
  } else if (foundCannotSaveSelf) {
    // Witch was killed - cannot save herself, click "好" to proceed to poison dialog
    console.log('    [Witch] Cannot save self - clicking 好');
    await page.getByText('好', { exact: true }).click();
    await page.waitForTimeout(800);
    
    // Wait for poison dialog and dismiss it
    console.log('    [Witch] Waiting for poison dialog...');
    const okButton = page.getByText('好', { exact: true });
    await expect(okButton).toBeVisible({ timeout: 5000 });
    await okButton.click();
    await page.waitForTimeout(1000);
    
    if (targetSeat !== null && isPoison) {
      // Use poison
      console.log(`    [Witch] Using poison on seat ${targetSeat}`);
      await clickSeat(page, targetSeat);
      await confirmAction(page);
    } else {
      // Skip poison
      console.log('    [Witch] Skipping poison');
      await skipAction(page, 10000);
    }
  } else if (foundSaveDialog) {
    // Someone was killed - save/don't save dialog
    if (targetSeat !== null && !isPoison) {
      // Save the victim
      console.log('    [Witch] Saving victim');
      await saveButton.click();
      await page.waitForTimeout(500);
    } else {
      // Don't save - might use poison
      console.log('    [Witch] Not saving, clicking 不救助');
      await noSaveButton.click();
      await page.waitForTimeout(800);
      
      // Wait for poison dialog and dismiss it
      console.log('    [Witch] Waiting for poison dialog...');
      const okButton = page.getByText('好', { exact: true });
      await expect(okButton).toBeVisible({ timeout: 5000 });
      await okButton.click();
      await page.waitForTimeout(1000); // Wait for dialog to close and UI to update
      
      if (targetSeat !== null && isPoison) {
        // Use poison
        console.log(`    [Witch] Using poison on seat ${targetSeat}`);
        await clickSeat(page, targetSeat);
        await confirmAction(page);
      } else {
        // Skip poison too - wait longer for skip button to appear
        console.log('    [Witch] Skipping poison');
        await skipAction(page, 10000);
      }
    }
  } else {
    // Neither dialog appeared - this shouldn't happen
    // Log debug info and try to recover
    const bodyText = await page.locator('body').textContent().catch(() => 'error');
    console.log(`    [Witch] ERROR: No witch dialog found! Page content: ${bodyText?.substring(0, 500)}`);
    throw new Error('Witch dialog did not appear within timeout');
  }
}

// Execute wolf votes - all wolves must vote for the same target
async function executeWolfVotes(
  roleMapping: Map<string, Page[]>,
  targetSeat: number | null  // 1-based seat number
): Promise<void> {
  const wolfPages = getPagesForRole(roleMapping, 'wolf');
  console.log(`    [Wolf voting] ${wolfPages.length} wolves voting for target: ${targetSeat ?? 'skip'}`);
  
  for (let i = 0; i < wolfPages.length; i++) {
    const wolfPage = wolfPages[i];
    console.log(`      Wolf ${i + 1}/${wolfPages.length} voting...`);
    
    // Wait for wolf's turn - the dialog should appear
    await waitForActionDialog(wolfPage);
    
    // Click "好" to dismiss initial dialog
    const okButton = wolfPage.getByText('好', { exact: true });
    if (await okButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await okButton.click();
      await wolfPage.waitForTimeout(300);
    }
    
    if (targetSeat === null) {
      // Vote for empty kill (空刀)
      const emptyKillButton = wolfPage.getByText('投票空刀');
      await expect(emptyKillButton).toBeVisible({ timeout: 5000 });
      await emptyKillButton.click();
      await wolfPage.waitForTimeout(300);
    } else {
      // Click on target seat
      await clickSeat(wolfPage, targetSeat);
    }
    
    // Confirm vote
    await confirmAction(wolfPage);
    console.log(`      Wolf ${i + 1} voted!`);
  }
}

// Execute a role action with specific target
async function executeRoleAction(
  page: Page,   // The page of the player with this role
  role: string,
  targetSeat: number | null,
  isPoison = false // For witch: true = poison, false = save
): Promise<void> {
  console.log(`    [Action] ${role}: target=${targetSeat}, isPoison=${isPoison}`);
  
  // Handle witch specially - has complex dialog flow
  if (role === 'witch') {
    await executeWitchAction(page, targetSeat, isPoison);
    return;
  }
  
  // Hunter and darkWolfKing only need to confirm status - clicking "好" auto-proceeds
  // Their dialog shows "猎人技能状态" or "黑狼王技能状态" with a "好" button
  // that automatically calls proceedWithAction(null) when clicked
  if (role === 'hunter' || role === 'darkWolfKing') {
    await waitForActionDialog(page);
    const okButton = page.getByText('好', { exact: true });
    if (await okButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await okButton.click();
      await page.waitForTimeout(500);
    }
    console.log(`    [Action] ${role} completed!`);
    return;
  }
  
  // For other roles: wait for dialog, dismiss "好", then act
  await dismissActionDialog(page);
  
  if (targetSeat === null) {
    // Skip action
    await skipAction(page);
  } else {
    // Click on target seat
    await clickSeat(page, targetSeat);
    await confirmAction(page);
    
    // For seer/psychic: there's an extra "result" dialog showing the check result
    // that also has a "确定" button to proceed
    if (role === 'seer' || role === 'psychic') {
      console.log(`      [${role}] Waiting for check result dialog...`);
      await page.waitForTimeout(500);
      const resultConfirm = page.getByText('确定', { exact: true });
      if (await resultConfirm.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log(`      [${role}] Found result dialog, clicking confirm...`);
        await resultConfirm.click();
        await page.waitForTimeout(300);
      }
    }
  }
  console.log(`    [Action] ${role} completed!`);
}

// Wait for night to end (重新开始 button appears)
async function waitForNightEnd(page: Page, maxWait = 60000): Promise<void> {
  const restartButton = page.getByText('重新开始');
  await expect(restartButton).toBeVisible({ timeout: maxWait });
}

// Get last night info dialog content
async function getLastNightInfo(page: Page): Promise<string> {
  // Click "查看昨晚信息" button
  const infoButton = page.getByText('查看昨晚信息');
  await expect(infoButton).toBeVisible({ timeout: 5000 });
  await infoButton.click();
  
  // Wait for first confirmation dialog to appear
  await page.waitForTimeout(500);
  
  // First dialog: "确定查看昨夜信息？" - click 确定 to proceed
  const confirmFirstDialog = page.getByText('确定', { exact: true }).first();
  await confirmFirstDialog.click();
  
  // Wait for actual last night info dialog to appear
  await page.waitForTimeout(500);
  
  // Get the dialog content - look for text containing "昨天晚上" or "平安夜"
  const dialogContent = page.locator('text=/昨天晚上.*/')
    .or(page.locator('text=平安夜'));
  
  const text = await dialogContent.textContent({ timeout: 3000 }).catch(() => null);
  
  // Dismiss the info dialog
  await page.getByText('确定', { exact: true }).click().catch(() => {});
  
  return text || '';
}

// ============ DYNAMIC ROLE DETECTION ============
// Role display name to internal name mapping
const ROLE_DISPLAY_TO_INTERNAL: { [displayName: string]: string } = {
  '村民': 'villager',
  '狼人': 'wolf',
  '预言家': 'seer',
  '女巫': 'witch',
  '猎人': 'hunter',
  '白痴': 'idiot',
  '守卫': 'guard',
  '狼王': 'darkWolfKing',
  '狼美人': 'wolfQueen',
  '石像鬼': 'gargoyle',
  '守墓人': 'graveyardKeeper',
  '梦魇': 'nightmare',
  '血月使徒': 'bloodMoon',
  '猎魔人': 'witcher',
  '摄梦人': 'celebrity',
  '魔术师': 'magician',
  '机械狼': 'wolfRobot',
  '通灵师': 'psychic',
  '恶灵骑士': 'spiritKnight',
};

// Read a player's role by clicking "查看身份" button (with network error handling)
async function getPlayerRole(page: Page, timeoutMs = 10000): Promise<string | null> {
  try {
    console.log('    [getPlayerRole] Starting...');
    // Use exact: true to avoid matching "⏳ 等待查看身份"
    const viewRoleButton = page.getByText('查看身份', { exact: true });
    
    // Check if button exists and is clickable with proper timeout
    console.log('    [getPlayerRole] Checking button visibility...');
    await expect(viewRoleButton).toBeVisible({ timeout: timeoutMs });
    console.log('    [getPlayerRole] Button is visible');
    
    console.log('    [getPlayerRole] Clicking button...');
    // Add timeout and force to prevent hang during page transitions
    await viewRoleButton.click({ timeout: 5000, force: true });
    console.log('    [getPlayerRole] Button clicked, waiting for dialog...');
    
    // Wait and check for either role text or retry dialog
    const maxWaitTime = 15000;
    const startTime = Date.now();
    let lastLogTime = 0;
    
    while (Date.now() - startTime < maxWaitTime) {
      const elapsed = Date.now() - startTime;
      
      // Log progress every 3 seconds
      if (elapsed - lastLogTime > 3000) {
        lastLogTime = elapsed;
        console.log(`    [getPlayerRole] Still waiting... ${elapsed}ms elapsed`);
      }
      
      // Check for network error retry dialog
      const retryButton = page.getByText('重试', { exact: true });
      if (await retryButton.isVisible({ timeout: 100 }).catch(() => false)) {
        console.log('    [getPlayerRole] Network error dialog detected, clicking retry...');
        await retryButton.click();
        await page.waitForTimeout(1000);
        continue; // Keep waiting for role text
      }
      
      // Check for role text
      const roleText = page.locator('text=/你的身份是：.*/');
      const text = await roleText.textContent({ timeout: 200 }).catch(() => null);
      if (text) {
        console.log('    [getPlayerRole] Role text:', text);
        
        // Dismiss dialog
        const confirmButton = page.getByText('确定', { exact: true });
        await confirmButton.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(200);
        
        // Extract role name: "你的身份是：狼人" -> "狼人"
        const rolePattern = /你的身份是：(.+)/;
        const match = rolePattern.exec(text);
        if (!match) {
          console.log('    [getPlayerRole] Could not parse role from text');
          return null;
        }
        
        const displayName = match[1];
        return ROLE_DISPLAY_TO_INTERNAL[displayName] || displayName;
      }
      
      await page.waitForTimeout(200);
    }
    
    console.log('    [getPlayerRole] Timeout - role text not found after 15s');
    return null;
  } catch (err) {
    console.log('    [getPlayerRole] Error:', err);
    return null;
  }
}

// Build role -> page mapping by reading each player's role
async function buildRoleMapping(pages: Page[]): Promise<Map<string, Page[]>> {
  const roleToPages = new Map<string, Page[]>();
  
  console.log('[RoleMapping] Reading roles from all players...');
  
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const role = await getPlayerRole(page);
    
    if (role) {
      console.log(`  Seat ${i + 1}: ${role}`);
      const existing = roleToPages.get(role) || [];
      existing.push(page);
      roleToPages.set(role, existing);
    } else {
      console.log(`  Seat ${i + 1}: (no role found)`);
    }
  }
  
  return roleToPages;
}

// Get pages for a specific role
function getPagesForRole(roleMapping: Map<string, Page[]>, role: string): Page[] {
  return roleMapping.get(role) || [];
}

// Interface for scenario definition
interface NightScenario {
  name: string;
  actions: { targetSeat: number | null; isPoison?: boolean }[];
  expectedDeaths: number[]; // 1-based seat numbers
  expectedInfo: string; // Expected text in last night info
}

// Interface for template definition
interface TemplateConfig {
  name: string;
  actionOrder: string[];
  scenarios: NightScenario[];
}

// ============ TEMPLATE CONFIGURATIONS ============
// Mirrors the unit tests in src/models/__tests__/templates/

const TEMPLATE_CONFIGS: TemplateConfig[] = [
  {
    name: '标准板12人',
    // wolf → witch → seer → hunter
    actionOrder: ['wolf', 'witch', 'seer', 'hunter'],
    scenarios: [
      {
        name: '狼人杀村民，女巫不救',
        actions: [
          { targetSeat: 1 },  // wolf kills seat 1
          { targetSeat: null }, // witch does nothing
          { targetSeat: 5 },  // seer checks seat 5
          { targetSeat: null }, // hunter confirms
        ],
        expectedDeaths: [1],
        expectedInfo: '1号玩家死亡',
      },
      {
        name: '狼人杀村民，女巫毒狼人',
        actions: [
          { targetSeat: 1 },  // wolf kills seat 1
          { targetSeat: 5, isPoison: true }, // witch poisons seat 5 (wolf)
          { targetSeat: 6 },  // seer checks seat 6
          { targetSeat: null }, // hunter confirms
        ],
        expectedDeaths: [1, 5],
        expectedInfo: '1号, 5号玩家死亡',
      },
      {
        name: '狼人杀女巫，女巫不能自救',
        actions: [
          { targetSeat: 4 },  // wolf kills witch (seat 4 based on role order)
          { targetSeat: null }, // witch cannot save herself, skip
          { targetSeat: 6 },  // seer checks seat 6
          { targetSeat: null }, // hunter confirms
        ],
        expectedDeaths: [4],
        expectedInfo: '4号玩家死亡',
      },
    ],
  },
  {
    name: '狼美守卫12人',
    // guard → wolf → wolfQueen → witch → seer → hunter
    actionOrder: ['guard', 'wolf', 'wolfQueen', 'witch', 'seer', 'hunter'],
    scenarios: [
      {
        name: '守卫守护成功',
        actions: [
          { targetSeat: 1 },  // guard protects seat 1
          { targetSeat: 1 },  // wolf kills seat 1 (protected!)
          { targetSeat: null }, // wolfQueen doesn't charm
          { targetSeat: null }, // witch does nothing
          { targetSeat: 5 },  // seer checks seat 5
          { targetSeat: null }, // hunter confirms
        ],
        expectedDeaths: [],
        expectedInfo: '平安夜',
      },
      {
        name: '守卫守其他人，狼人杀村民',
        actions: [
          { targetSeat: 9 },  // guard protects seer (seat 9)
          { targetSeat: 1 },  // wolf kills seat 1
          { targetSeat: null }, // wolfQueen doesn't charm
          { targetSeat: null }, // witch does nothing
          { targetSeat: 5 },  // seer checks seat 5
          { targetSeat: null }, // hunter confirms
        ],
        expectedDeaths: [1],
        expectedInfo: '1号玩家死亡',
      },
    ],
  },
  {
    name: '狼王守卫12人',
    // guard → wolf → witch → seer → hunter → darkWolfKing
    actionOrder: ['guard', 'wolf', 'witch', 'seer', 'hunter', 'darkWolfKing'],
    scenarios: [
      {
        name: '正常杀人流程',
        actions: [
          { targetSeat: 9 },  // guard protects seer
          { targetSeat: 1 },  // wolf kills seat 1
          { targetSeat: null }, // witch does nothing
          { targetSeat: 5 },  // seer checks seat 5
          { targetSeat: null }, // hunter confirms
          { targetSeat: null }, // darkWolfKing confirms
        ],
        expectedDeaths: [1],
        expectedInfo: '1号玩家死亡',
      },
    ],
  },
  {
    name: '石像鬼守墓人12人',
    // gargoyle → wolf → witch → seer → hunter
    actionOrder: ['gargoyle', 'wolf', 'witch', 'seer', 'hunter'],
    scenarios: [
      {
        name: '石像鬼查神，狼人杀人',
        actions: [
          { targetSeat: 9 },  // gargoyle checks seat 9 (seer)
          { targetSeat: 1 },  // wolf kills seat 1
          { targetSeat: null }, // witch does nothing
          { targetSeat: 5 },  // seer checks seat 5
          { targetSeat: null }, // hunter confirms
        ],
        expectedDeaths: [1],
        expectedInfo: '1号玩家死亡',
      },
    ],
  },
  {
    name: '梦魇守卫12人',
    // nightmare → guard → wolf → witch → seer → hunter
    actionOrder: ['nightmare', 'guard', 'wolf', 'witch', 'seer', 'hunter'],
    scenarios: [
      {
        name: '梦魇封锁预言家',
        actions: [
          { targetSeat: 9 },  // nightmare blocks seer
          { targetSeat: 10 }, // guard protects witch
          { targetSeat: 1 },  // wolf kills seat 1
          { targetSeat: null }, // witch does nothing
          { targetSeat: 5 },  // seer checks (blocked)
          { targetSeat: null }, // hunter confirms
        ],
        expectedDeaths: [1],
        expectedInfo: '1号玩家死亡',
      },
    ],
  },
  {
    name: '血月猎魔12人',
    // wolf → witch → seer (bloodMoon has no night action)
    actionOrder: ['wolf', 'witch', 'seer'],
    scenarios: [
      {
        name: '正常杀人流程',
        actions: [
          { targetSeat: 1 },  // wolf kills seat 1
          { targetSeat: null }, // witch does nothing
          { targetSeat: 5 },  // seer checks seat 5
        ],
        expectedDeaths: [1],
        expectedInfo: '1号玩家死亡',
      },
    ],
  },
  {
    name: '狼王摄梦人12人',
    // celebrity → wolf → witch → seer → hunter → darkWolfKing
    actionOrder: ['celebrity', 'wolf', 'witch', 'seer', 'hunter', 'darkWolfKing'],
    scenarios: [
      {
        name: '摄梦人保护被杀者',
        actions: [
          { targetSeat: 1 },  // celebrity protects seat 1
          { targetSeat: 1 },  // wolf kills seat 1 (protected!)
          { targetSeat: null }, // witch does nothing
          { targetSeat: 5 },  // seer checks seat 5
          { targetSeat: null }, // hunter confirms
          { targetSeat: null }, // darkWolfKing confirms
        ],
        expectedDeaths: [],
        expectedInfo: '平安夜',
      },
    ],
  },
  {
    name: '狼王魔术师12人',
    // magician → wolf → witch → seer → hunter → darkWolfKing
    actionOrder: ['magician', 'wolf', 'witch', 'seer', 'hunter', 'darkWolfKing'],
    scenarios: [
      {
        name: '魔术师不交换',
        actions: [
          { targetSeat: null }, // magician doesn't swap
          { targetSeat: 1 },  // wolf kills seat 1
          { targetSeat: null }, // witch does nothing
          { targetSeat: 5 },  // seer checks seat 5
          { targetSeat: null }, // hunter confirms
          { targetSeat: null }, // darkWolfKing confirms
        ],
        expectedDeaths: [1],
        expectedInfo: '1号玩家死亡',
      },
    ],
  },
  {
    name: '机械狼通灵师12人',
    // wolfRobot → guard → wolf → witch → psychic → hunter
    actionOrder: ['wolfRobot', 'guard', 'wolf', 'witch', 'psychic', 'hunter'],
    scenarios: [
      {
        name: '机械狼学习技能',
        actions: [
          { targetSeat: 9 },  // wolfRobot learns from psychic
          { targetSeat: 10 }, // guard protects witch
          { targetSeat: 1 },  // wolf kills seat 1
          { targetSeat: null }, // witch does nothing
          { targetSeat: 5 },  // psychic checks seat 5
          { targetSeat: null }, // hunter confirms
        ],
        expectedDeaths: [1],
        expectedInfo: '1号玩家死亡',
      },
    ],
  },
  {
    name: '恶灵骑士12人',
    // guard → wolf → witch → seer → hunter
    actionOrder: ['guard', 'wolf', 'witch', 'seer', 'hunter'],
    scenarios: [
      {
        name: '正常杀人流程',
        actions: [
          { targetSeat: 9 },  // guard protects seer
          { targetSeat: 1 },  // wolf kills seat 1
          { targetSeat: null }, // witch does nothing
          { targetSeat: 5 },  // seer checks seat 5
          { targetSeat: null }, // hunter confirms
        ],
        expectedDeaths: [1],
        expectedInfo: '1号玩家死亡',
      },
    ],
  },
];

// ============ TEST SUITE ============

// ⚠️ SKIP - This entire test suite is deprecated. See file header for explanation.
test.describe.skip('Template Scenarios E2E', () => {
  test('All templates - night scenarios with verification', async ({ browser }) => {
    const PLAYER_COUNT = 12;
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];

    // Create 12 browser contexts
    console.log(`[Setup] Creating ${PLAYER_COUNT} browser contexts...`);
    for (let i = 0; i < PLAYER_COUNT; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      // Add console listener to capture browser logs
      page.on('console', msg => {
        const text = msg.text();
        if (text.includes('[ActionDialog Effect]') || text.includes('[ViewRole]') || text.includes('[Restart]') || text.includes('[AssignRoles]')) {
          console.log(`[Browser ${i + 1}] ${text}`);
        }
      });

      // ========== NETWORK DIAGNOSTICS FOR SUPABASE ==========
      // Track if we've logged the first supabase URL (to identify actual target)
      let firstSupabaseUrlLogged = false;

      // Listen for failed requests (ECONNREFUSED, DNS, CORS preflight failures, etc.)
      page.on('requestfailed', request => {
        const url = request.url();
        // Filter: only supabase-related or localhost:54321 (local supabase default)
        if (url.includes('supabase') || url.includes(':54321') || url.includes('127.0.0.1') || url.includes('localhost')) {
          const failure = request.failure();
          console.log(`[NET FAIL][Browser ${i + 1}] ${request.method()} ${url}`);
          console.log(`  -> errorText: ${failure?.errorText || 'unknown'}`);
        }
      });

      // Listen for responses with errors (401, 403, 404, 500, etc.)
      page.on('response', async response => {
        const url = response.url();
        const status = response.status();
        const request = response.request();
        const method = request.method();
        
        // Filter: only supabase-related
        if (url.includes('supabase') || url.includes(':54321')) {
          // Log the first supabase URL to identify target
          if (!firstSupabaseUrlLogged) {
            firstSupabaseUrlLogged = true;
            const urlObj = new URL(url);
            console.log(`[NET INFO][Browser ${i + 1}] First Supabase request detected:`);
            console.log(`  -> Target host: ${urlObj.origin}`);
          }
          
          // Log ALL POST/INSERT requests to rooms table (to track room creation)
          if (method === 'POST' && url.includes('/rooms')) {
            // Log request headers to diagnose auth issues
            const reqHeaders = request.headers();
            const authHeader = reqHeaders['authorization'] || 'MISSING';
            const apikeyHeader = reqHeaders['apikey'] || 'MISSING';
            console.log(`[NET POST][Browser ${i + 1}] ${method} ${url} -> ${status}`);
            console.log(`  -> Authorization: ${authHeader.substring(0, 50)}...`);
            console.log(`  -> apikey: ${apikeyHeader.substring(0, 30)}...`);
            try {
              const body = await response.text();
              console.log(`  -> Response body: ${body.substring(0, 500)}`);
            } catch { 
              console.log(`  -> Response body: (unable to read)`);
            }
          }
          
          // Log errors
          if (status >= 400) {
            console.log(`[NET ERROR][Browser ${i + 1}] ${status} ${response.statusText()} - ${url}`);
          }
        }
      });
      // ========== END NETWORK DIAGNOSTICS ==========
      
      contexts.push(context);
      pages.push(page);
    }

    const hostPage = pages[0];
    const joinerPages = pages.slice(1);

    try {
      // ========== INITIAL SETUP ==========
      const firstTemplate = TEMPLATE_CONFIGS[0];
      console.log(`[Setup] Setting up room with template: ${firstTemplate.name}`);

      await withStep('Host goto(/)', hostPage, async () => {
        await gotoWithRetry(hostPage, '/');
      });
      await withStep('Host dismissLoadingTimeoutIfPresent after goto(/)', hostPage, async () => {
        await dismissLoadingTimeoutIfPresent(hostPage, 'Host after goto(/)');
      });
      await withStep('Host waitForAppReady', hostPage, async () => {
        await waitForAppReady(hostPage);
      });

      // ========== ENVIRONMENT DIAGNOSIS ==========
      await diagnoseEnvironment(hostPage, 'Host after waitForAppReady');

      await withStep('Host waitForLoggedIn', hostPage, async () => {
        await waitForLoggedIn(hostPage);
      });

      // Dismiss "请先登陆后继续" if it appears before clicking 创建房间
      await withStep('Host dismissLoginRequiredIfPresent', hostPage, async () => {
        await dismissLoginRequiredIfPresent(hostPage, 'Host before 创建房间');
      });

      // Dismiss "没有上局游戏记录" alert if it appears
      await withStep('Host dismissGenericAlertIfPresent', hostPage, async () => {
        await dismissGenericAlertIfPresent(hostPage, 'Host before 创建房间');
      });

      // Create room with first template
      await withStep('Host click 创建房间', hostPage, async () => {
        // Pre-condition: dismiss any dialogs and ensure logged in
        await dismissGenericAlertIfPresent(hostPage, 'before click 创建房间');
        await dismissLoginRequiredIfPresent(hostPage, 'before click 创建房间');
        await expect(hostPage.getByText('匿名用户')).toBeVisible({ timeout: 15000 });
        // Now click
        await hostPage.getByText('创建房间').click();
      });
      await withStep('Host create room with template 标准板12人', hostPage, async () => {
        await expect(hostPage.getByText('快速模板')).toBeVisible({ timeout: 5000 });
        await hostPage.getByText(firstTemplate.name, { exact: true }).click();
        await hostPage.getByText('创建', { exact: true }).click();
        await expect(hostPage.getByText(/房间 \d{4}/)).toBeVisible({ timeout: 15000 });
      });

      const roomText = await hostPage.getByText(/房间 \d{4}/).textContent();
      const roomNumber = roomText?.match(/\d{4}/)?.[0];
      if (!roomNumber) throw new Error('Failed to extract room number');
      console.log(`[Setup] Room created: ${roomNumber}`);

      // Host is auto-seated on seat 1 after room creation
      // Wait for seat 1 to show "1" (seated) instead of "空" (empty)
      await hostPage.waitForTimeout(1000);  // Wait for auto-seat to complete
      
      // Verify host is seated by checking that there are now 11 empty seats instead of 12
      const emptySeats = hostPage.getByText('空');
      const emptyCount = await emptySeats.count();
      console.log(`[Setup] Empty seats after host auto-seated: ${emptyCount}`);
      
      // Host should be seated - we should see seat "1" with a player
      if (emptyCount === 12) {
        // Host not auto-seated, manually seat
        console.log('[Setup] Host not auto-seated, manually seating...');
        await emptySeats.first().click();
        await hostPage.getByText('确定', { exact: true }).click().catch(() => {});
        await hostPage.waitForTimeout(500);
      }
      console.log(`[Setup] Host seated`);

      // All joiners join and sit - do it sequentially with longer waits
      for (let i = 0; i < joinerPages.length; i++) {
        const page = joinerPages[i];
        console.log(`[Setup] Player ${i + 2}/12 joining...`);
        
        await withStep(`Player ${i + 2} join room`, page, async () => {
          await gotoWithRetry(page, '/');
          await dismissLoadingTimeoutIfPresent(page, `Joiner ${i + 2} after goto(/)`);
          await waitForAppReady(page);

          await dismissLoadingTimeoutIfPresent(page, `Joiner ${i + 2} before login`);
          await waitForLoggedIn(page);
          await dismissLoadingTimeoutIfPresent(page, `Joiner ${i + 2} after login`);
          
          // Dismiss any generic alerts (e.g. "没有上局游戏记录")
          await dismissGenericAlertIfPresent(page, `Joiner ${i + 2} after login`);
          
          // Dismiss login-required overlay if present (needed for each player)
          await dismissLoginRequiredIfPresent(page, `Joiner ${i + 2} before 进入房间`);
          
          await page.getByText('进入房间').click();
          await expect(page.getByText('加入房间')).toBeVisible({ timeout: 5000 });
          await page.getByPlaceholder('0000').fill(roomNumber);

          await page.getByText('加入', { exact: true }).click();

          // Handle timeout dialog with simple retry (max 3 attempts)
          for (let attempt = 0; attempt < 3; attempt++) {
            await dismissLoadingTimeoutIfPresent(page, `Joiner ${i + 2} after clicking join attempt ${attempt + 1}`);
            if (await page.getByText(/房间 \d{4}/).isVisible({ timeout: 3000 }).catch(() => false)) {
              break;
            }
          }
          
          // Final verification
          await expect(page.getByText(/房间 \d{4}/)).toBeVisible({ timeout: 10000 });
          
          // Wait a bit for room state to sync
          await page.waitForTimeout(500);
          
          const emptySeat = page.getByText('空').first();
          await expect(emptySeat).toBeVisible({ timeout: 5000 });
          await emptySeat.click();
          await page.getByText('确定', { exact: true }).click().catch(() => {});
          await page.waitForTimeout(500);
        });
      }

      console.log('[Setup] All 12 players joined!');
      await hostPage.waitForTimeout(2000);

  // ========== TEST EACH TEMPLATE'S SCENARIOS ==========
  // Only run 标准板12人 + scenario1 for verification (fail-fast debugging).
  const TEMPLATES_TO_TEST = TEMPLATE_CONFIGS.filter((t) => t.name === '标准板12人');
      
      for (let templateIndex = 0; templateIndex < TEMPLATES_TO_TEST.length; templateIndex++) {
        const template = TEMPLATES_TO_TEST[templateIndex];
        console.log(`\n========== Template ${templateIndex + 1}/${TEMPLATES_TO_TEST.length}: ${template.name} ==========`);

        // Change template using settings if not the first template
        if (templateIndex > 0) {
          console.log(`[${template.name}] Changing template via settings...`);
          
          // Debug: Log what's visible on host page
          const prepareBtn = await hostPage.getByText('准备看牌').isVisible().catch(() => false);
          const settingsBtn = await hostPage.getByText('⚙️ 设置').isVisible().catch(() => false);
          const restartBtn = await hostPage.getByText('重新开始').isVisible().catch(() => false);
          const roomText = await hostPage.getByText(/房间 \d{4}/).isVisible().catch(() => false);
          console.log(`[Debug] prepareBtn=${prepareBtn}, settingsBtn=${settingsBtn}, restartBtn=${restartBtn}, roomText=${roomText}`);
          
          // Host clicks settings button
          const settingsButton = hostPage.getByText('⚙️ 设置');
          await expect(settingsButton).toBeVisible({ timeout: 5000 });
          await settingsButton.click();
          
          // Wait for navigation to config screen - wait for room text to disappear
          await expect(hostPage.getByText(/房间 \d{4}/)).toBeHidden({ timeout: 5000 }).catch(() => {});
          
          // Wait for config screen to fully load (loading state ends when '快速模板' appears)
          // In edit mode, isLoading=true initially, hiding template list until room data loads
          // Wait for loading indicator to disappear first (if visible)
          await hostPage.getByText('加载中...').waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
          
          // Wait for first visible '快速模板' element (there might be multiple section headers)
          await hostPage.getByText('快速模板').first().waitFor({ state: 'visible', timeout: 15000 });
          
          // Wait for the target template to be visible
          await hostPage.getByText(template.name, { exact: true }).first().waitFor({ state: 'visible', timeout: 5000 });
          
          // Select new template
          await hostPage.getByText(template.name, { exact: true }).first().click();
          
          // Save changes
          await hostPage.getByText('保存', { exact: true }).click();
          
          // Wait for return to room
          await expect(hostPage.getByText(/房间 \d{4}/)).toBeVisible({ timeout: 10000 });
          console.log(`[${template.name}] Template changed!`);
          
          // All players need to re-sit after template change
          await hostPage.waitForTimeout(1000);
          for (const page of pages) {
            const emptySeat = page.getByText('空');
            if (await emptySeat.first().isVisible({ timeout: 2000 }).catch(() => false)) {
              await emptySeat.first().click();
              await page.getByText('确定', { exact: true }).click().catch(() => {});
              await page.waitForTimeout(300);
            }
          }
          await hostPage.waitForTimeout(1000);
        }

        for (let scenarioIndex = 0; scenarioIndex < template.scenarios.length; scenarioIndex++) {
          if (scenarioIndex !== 0) continue; // scenario1 only
          const scenario = template.scenarios[scenarioIndex];
          console.log(`\n----- Scenario ${scenarioIndex + 1}: ${scenario.name} -----`);

          // Re-seat if needed (after restart within same template)
          if (scenarioIndex > 0) {
            await hostPage.waitForTimeout(1000);
            for (const page of pages) {
              const emptySeat = page.getByText('空');
              if (await emptySeat.first().isVisible({ timeout: 1000 }).catch(() => false)) {
                await emptySeat.first().click();
                await page.getByText('确定', { exact: true }).click().catch(() => {});
                await page.waitForTimeout(200);
              }
            }
            await hostPage.waitForTimeout(1000);
          }

          // Start game
          await withStep('Host prepareToFlip', hostPage, async () => {
            const prepareButton = hostPage.getByText('准备看牌');
            await expect(prepareButton).toBeVisible({ timeout: 10000 });
            await prepareButton.click();
            await expect(hostPage.getByText('允许看牌')).toBeVisible({ timeout: 3000 });
            await hostPage.getByText('确定', { exact: true }).click();
            
            // Wait for "准备看牌" button to disappear (roomStatus changed to assigned)
            // Also handle network retry dialogs that may appear
            const maxWaitTime = 30000;
            const startTime = Date.now();
            while (Date.now() - startTime < maxWaitTime) {
              // Check for network error retry dialog
              const retryButton = hostPage.getByText('重试', { exact: true });
              if (await retryButton.isVisible({ timeout: 100 }).catch(() => false)) {
                console.log(`[${template.name}] Network error dialog detected, clicking retry...`);
                await retryButton.click();
                await hostPage.waitForTimeout(500);
                continue;
              }
              
              // Check if prepare button is hidden
              if (!(await prepareButton.isVisible({ timeout: 100 }).catch(() => true))) {
                break;
              }
              
              await hostPage.waitForTimeout(200);
            }
            
            // Verify the button is actually hidden
            await expect(prepareButton).not.toBeVisible({ timeout: 5000 });
          });
          
          // IMPORTANT: Wait for all clients to sync the room status change
          // Without this, some clients may still have old roomStatus and won't update hasViewedRole
          await hostPage.waitForTimeout(1000);
          console.log(`[${template.name}] Prepare button hidden, all players viewing roles...`);

          // All players must view their roles before "开始游戏" becomes visible
          // IMPORTANT: Must view roles sequentially with delay to avoid race condition
          // Each player's markPlayerViewedRole update must complete before the next one starts
          for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const viewRoleButton = page.getByText('查看身份', { exact: true });
            const isVisible = await viewRoleButton.isVisible({ timeout: 1000 }).catch(() => false);
            console.log(`  Seat ${i + 1}: view role button visible = ${isVisible}`);
            
            // Retry loop for network errors
            const maxRetries = 5;
            let retryCount = 0;
            let success = false;
            
            while (!success && retryCount < maxRetries) {
              try {
                await expect(viewRoleButton).toBeVisible({ timeout: 5000 });
                await viewRoleButton.click();
                await page.waitForTimeout(800); // Wait for RPC to complete (with FOR UPDATE lock)
                
                // Check for network error retry dialog
                const retryButton = page.getByText('重试', { exact: true });
                const confirmButton = page.getByText('确定', { exact: true });
                
                // Wait a bit for dialog to appear
                await page.waitForTimeout(500);
                
                // Check if retry dialog appeared (network error)
                if (await retryButton.isVisible({ timeout: 300 }).catch(() => false)) {
                  console.log(`  Seat ${i + 1}: Network error, clicking retry... (attempt ${retryCount + 1})`);
                  await retryButton.click();
                  await page.waitForTimeout(1000);
                  retryCount++;
                  continue;
                }
                
                // Dismiss the role dialog if confirm button is visible
                if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                  await confirmButton.click({ timeout: 3000 });
                  await page.waitForTimeout(800); // Wait for subscription update before next player
                  console.log(`  Seat ${i + 1}: viewed role OK`);
                  success = true;
                } else {
                  // No dialog visible, maybe already dismissed or error
                  retryCount++;
                  console.log(`  Seat ${i + 1}: No dialog visible, retrying... (attempt ${retryCount})`);
                }
              } catch (e) {
                retryCount++;
                console.log(`  Seat ${i + 1}: Error viewing role (attempt ${retryCount}) - ${e}`);
                await page.waitForTimeout(500);
              }
            }
            
            if (!success) {
              console.log(`  Seat ${i + 1}: Failed to view role after ${maxRetries} attempts`);
            }
          }
          
          // Extra wait for all realtime subscriptions to sync
          await hostPage.waitForTimeout(2000);
          console.log(`[${template.name}] All players viewed roles, waiting for start button...`);

          // Build role mapping BEFORE starting the game (when game starts, ActionDialogs will appear)
          const roleMapping = await buildRoleMapping(pages);
          console.log(`[${template.name}] Role mapping built!`);

          await withStep(`[${template.name}] Start game`, hostPage, async () => {
            const startButton = hostPage.getByText('开始游戏');
            await expect(startButton).toBeVisible({ timeout: 10000 });
            await startButton.click();
            await expect(hostPage.getByText('开始游戏？')).toBeVisible({ timeout: 3000 });
            await hostPage.getByText('确定', { exact: true }).click();
            await expect(hostPage.getByText('开始游戏')).not.toBeVisible({ timeout: 10000 });
          });
          console.log(`[${template.name}] Game started!`);

          // Execute each action in order
          for (let actionIndex = 0; actionIndex < scenario.actions.length; actionIndex++) {
            const action = scenario.actions[actionIndex];
            const roleName = template.actionOrder[actionIndex];
            console.log(`  [${roleName}] Target: ${action.targetSeat ?? 'skip'}`);
            
            // Special handling for wolf - all wolves must vote
            if (roleName === 'wolf') {
              await executeWolfVotes(roleMapping, action.targetSeat);
            } else {
              // Get the page for this role
              const rolePages = getPagesForRole(roleMapping, roleName);
              if (rolePages.length === 0) {
                console.error(`No page found for role ${roleName}`);
                continue;
              }
              const rolePage = rolePages[0];
              await executeRoleAction(rolePage, roleName, action.targetSeat, action.isPoison);
            }
          }

          // Wait for night to end
          await withStep(`[${template.name}] Wait for night end`, hostPage, async () => {
            await waitForNightEnd(hostPage);
          });
          console.log(`[${template.name}] Night ended!`);

          // Verify last night info
          const lastNightInfo = await withStep(`[${template.name}] Get last night info`, hostPage, async () => {
            return await getLastNightInfo(hostPage);
          });
          console.log(`[${template.name}] Last night info: "${lastNightInfo}"`);
          
          // Check if expected info is in the result
          if (scenario.expectedInfo === '平安夜') {
            expect(lastNightInfo).toContain('平安夜');
          } else {
            expect(lastNightInfo).toContain(scenario.expectedInfo);
          }

          console.log(`✅ Scenario "${scenario.name}" passed!`);

          // Restart for next scenario (if not last scenario of last template)
          const isLastScenario = templateIndex === TEMPLATE_CONFIGS.length - 1 && 
                                  scenarioIndex === template.scenarios.length - 1;
          if (!isLastScenario) {
            console.log(`[${template.name}] Restarting for next scenario...`);
            const restartButton = hostPage.getByText('重新开始');
            await expect(restartButton).toBeVisible({ timeout: 5000 });
            await restartButton.click();
            await expect(hostPage.getByText('重新开始游戏？')).toBeVisible({ timeout: 3000 });
            await hostPage.getByText('确定', { exact: true }).click();
            
            // Wait for room to reset to seating status (准备看牌 button should appear)
            const restartPrepareButton = hostPage.getByText('准备看牌');
            await expect(restartPrepareButton).toBeVisible({ timeout: 10000 });
            console.log(`[${template.name}] Room restarted, 准备看牌 button visible`);
            
            // CRITICAL: Wait for all clients to receive the reset hasViewedRole state
            // Without sufficient wait, clients may still have stale hasViewedRole=true
            // which causes markPlayerViewedRole RPC to be skipped
            await hostPage.waitForTimeout(2000);
          }
        }

        console.log(`✅ Template "${template.name}" - all scenarios passed!`);
      }

      console.log('\n========== ALL TEMPLATE SCENARIOS PASSED! ==========');

    } finally {
      console.log('[Cleanup] Closing all browser contexts...');
      for (const context of contexts) {
        await context.close().catch((e) => console.warn('[Cleanup] context.close error:', e));
      }
    }
  });
});
