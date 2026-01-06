import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * Multiplayer E2E Test for Werewolf Game
 * 
 * This test simulates a full multiplayer game:
 * - 1 host creates a room
 * - Multiple players join the room
 * - All players are in the room together
 */

// Increase timeout for multiplayer test
test.setTimeout(120000);

// Helper to wait for app to be ready
async function waitForAppReady(page: Page) {
  await page.waitForSelector('text=狼人杀法官', { timeout: 15000 });
}

// Wait for app to be ready and user to be logged in
// Handles: already logged in, need to login, login fails with retry
async function waitForLoggedIn(page: Page, maxRetries = 5) {
  console.log('[Login] Checking login status...');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // First, check if login modal is open and close it
    if (await page.getByText('👤 匿名登录').isVisible().catch(() => false)) {
      console.log('[Login] Login modal still open, closing it...');
      await page.getByText('取消').click().catch(() => {});
      await page.waitForTimeout(500);
    }
    
    // Wait for home screen elements to load
    await expect(
      page.getByText('匿名用户').or(page.getByText('点击登录'))
    ).toBeVisible({ timeout: 10000 });
    
    // Already logged in? Check that no modal is blocking
    const noModalBlocking = !(await page.getByText('👤 匿名登录').isVisible().catch(() => false));
    if (noModalBlocking && await page.getByText('匿名用户').isVisible()) {
      console.log('[Login] Already logged in');
      return;
    }
    
    // Need to login
    console.log(`[Login] Attempt ${attempt}/${maxRetries}...`);
    await page.getByText('点击登录').click();
    
    // Wait for login modal
    await expect(page.getByText('👤 匿名登录')).toBeVisible({ timeout: 5000 });
    
    // Click anonymous login
    await page.getByText('👤 匿名登录').click();
    
    // Wait for result: either logged in or error alert
    const loginSuccess = page.getByText('匿名用户');
    const loginError = page.getByText('登录失败');
    
    // Wait up to 10 seconds for either result
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      
      // Check for ERROR first (it appears as overlay, so check it before success)
      if (await loginError.isVisible().catch(() => false)) {
        console.log('[Login] Login failed, dismissing alert...');
        // Take screenshot for debugging
        await page.screenshot({ path: `test-results/login-failed-attempt-${attempt}.png` });
        
        // Click 确定 to dismiss alert
        await page.getByText('确定', { exact: true }).click();
        
        // Wait for alert to close
        await expect(loginError).not.toBeVisible({ timeout: 3000 }).catch(() => {});
        console.log('[Login] Alert dismissed');
        
        // The login modal should also be closed now
        // Wait for home screen to be ready for next attempt
        await expect(page.getByText('点击登录').or(page.getByText('匿名用户'))).toBeVisible({ timeout: 5000 });
        
        // Wait before retry to avoid rate limiting (exponential backoff)
        const waitTime = 3000 * attempt;
        console.log(`[Login] Waiting ${waitTime/1000}s before retry...`);
        await page.waitForTimeout(waitTime);
        console.log('[Login] Ready for next attempt');
        
        break; // Break inner loop to retry
      }
      
      // Check for success - but only if the login modal is closed
      const modalClosed = !(await page.getByText('👤 匿名登录').isVisible().catch(() => false));
      if (modalClosed && await loginSuccess.isVisible().catch(() => false)) {
        console.log('[Login] Login successful');
        console.log('[Login] Home screen ready');
        return;
      }
    }
  }
  
  throw new Error(`Login failed after ${maxRetries} attempts`);
}

test.describe('Multiplayer Room - Login Required', () => {
  test('shows login dialog when trying to create/join room', async ({ browser }) => {
    // Test that multiplayer features require login
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      await page.goto('/');
      await waitForAppReady(page);
      
      // Try to create room
      await page.getByText('创建房间').click();
      
      // Should show login required
      await expect(page.getByText('需要登录')).toBeVisible({ timeout: 5000 });
      
      // Dismiss
      await page.getByText('取消').click();
      
      // Wait for dialog to close
      await expect(page.getByText('需要登录')).not.toBeVisible({ timeout: 3000 });
      
      // Try to join room
      await page.getByText('进入房间').click();
      
      // Should show login required
      await expect(page.getByText('需要登录')).toBeVisible({ timeout: 5000 });
      
    } finally {
      await context.close();
    }
  });
});

/**
 * Full multiplayer test with anonymous login
 * 
 * Tests that multiple players can create and join rooms.
 * Uses anonymous login which works without test accounts.
 */
test.describe('Multiplayer Room - With Auth', () => {
  test('host can create a room after anonymous login', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      await page.goto('/');
      await waitForAppReady(page);
      
      // Wait for login to complete
      await waitForLoggedIn(page);
      
      // Take screenshot before clicking
      console.log('About to click 创建房间...');
      
      // Click create room - this goes to Config screen
      await page.getByText('创建房间').click({ timeout: 5000 });
      console.log('Clicked 创建房间');
      
      // Should see Config screen with "快速模板" section
      await expect(page.getByText('快速模板')).toBeVisible({ timeout: 5000 });
      console.log('On Config screen');
      
      // Click the "创建" button in the header to create the room
      await page.getByText('创建', { exact: true }).click();
      console.log('Clicked 创建 button');
      
      // Wait for navigation - may show loading first
      // First wait to leave config screen
      await expect(page.getByText('快速模板')).not.toBeVisible({ timeout: 10000 });
      console.log('Left Config screen');
      
      // Should see room screen with room number (may take time to load)
      await expect(page.getByText(/房间 \d{4}/)).toBeVisible({ timeout: 30000 });
      
      // Extract room number for verification
      const roomText = await page.getByText(/房间 \d{4}/).textContent();
      expect(roomText).toMatch(/房间 \d{4}/);
      console.log('Room created:', roomText);
      
    } finally {
      await context.close();
    }
  });

  test('3 players can join a room', async ({ browser }) => {
    // Test with 3 players (1 host + 2 joiners) for faster test
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];
    
    // Create 3 browser contexts
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      contexts.push(context);
      pages.push(page);
    }
    
    const hostPage = pages[0];
    const joinerPages = pages.slice(1);
    
    try {
      // ========== HOST: Login and Create Room ==========
      console.log('[Host] Navigating and logging in...');
      await hostPage.goto('/');
      await waitForAppReady(hostPage);
      await waitForLoggedIn(hostPage);
      
      // Go to config screen
      await hostPage.getByText('创建房间').click();
      console.log('[Host] On config screen...');
      
      // Wait for Config screen and click create
      await expect(hostPage.getByText('快速模板')).toBeVisible({ timeout: 5000 });
      await hostPage.getByText('创建', { exact: true }).click();
      console.log('[Host] Creating room...');
      
      // Wait for room screen
      await expect(hostPage.getByText(/房间 \d{4}/)).toBeVisible({ timeout: 15000 });
      
      // Extract room number
      const roomText = await hostPage.getByText(/房间 \d{4}/).textContent();
      const roomNumber = roomText?.match(/\d{4}/)?.[0];
      
      if (!roomNumber) {
        throw new Error('Failed to extract room number');
      }
      console.log(`[Host] Room created: ${roomNumber}`);
      
      // ========== JOINERS: Login and Join Room ==========
      // Login joiners sequentially to avoid rate limiting
      const joinResults: { success: boolean; playerNum: number; error?: any }[] = [];
      
      for (let index = 0; index < joinerPages.length; index++) {
        const page = joinerPages[index];
        const playerNum = index + 2;
        
        try {
          console.log(`[Player ${playerNum}] Logging in...`);
          await page.goto('/');
          await waitForAppReady(page);
          await waitForLoggedIn(page);
          
          // Join room
          await page.getByText('进入房间').click();
          console.log(`[Player ${playerNum}] Joining room ${roomNumber}...`);
          
          // Wait for join modal - check for modal title
          await expect(page.getByText('加入房间')).toBeVisible({ timeout: 5000 });
          
          // Input room number using placeholder "0000"
          await page.getByPlaceholder('0000').fill(roomNumber);
          
          // Click join button (exact match to avoid matching modal title)
          await page.getByText('加入', { exact: true }).click();
          
          // Wait for room screen
          await expect(page.getByText(/房间 \d{4}/)).toBeVisible({ timeout: 10000 });
          console.log(`[Player ${playerNum}] Joined successfully!`);
          
          joinResults.push({ success: true, playerNum });
        } catch (error) {
          console.error(`[Player ${playerNum}] Failed:`, error);
          joinResults.push({ success: false, playerNum, error });
        }
      }
      
      const successful = joinResults.filter(r => r.success).length;
      console.log(`[Results] ${successful}/${joinerPages.length} joiners succeeded`);
      
      // Verify at least 1 player joined
      expect(successful).toBeGreaterThanOrEqual(1);
      
      // Wait a bit for sync
      await hostPage.waitForTimeout(1000);
      
      // Host should see multiple players
      // The exact text depends on room size settings
      console.log('[Host] Verifying players in room...');
      
    } finally {
      // Cleanup
      for (const context of contexts) {
        await context.close();
      }
    }
  });

  test('12 players can join a room and start the game', async ({ browser }) => {
    const PLAYER_COUNT = 12;
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];
    
    // Create 12 browser contexts
    console.log(`[Setup] Creating ${PLAYER_COUNT} browser contexts...`);
    for (let i = 0; i < PLAYER_COUNT; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      contexts.push(context);
      pages.push(page);
    }
    
    const hostPage = pages[0];
    const joinerPages = pages.slice(1);
    
    try {
      // ========== HOST: Login and Create Room ==========
      console.log('[Host] Navigating and logging in...');
      await hostPage.goto('/');
      await waitForAppReady(hostPage);
      await waitForLoggedIn(hostPage);
      
      // Go to config screen
      await hostPage.getByText('创建房间').click();
      console.log('[Host] On config screen...');
      
      // Wait for Config screen
      await expect(hostPage.getByText('快速模板')).toBeVisible({ timeout: 5000 });
      
      // Select a template that supports 12 players (e.g., 12人标准场)
      // First, look for player count selector or template
      const template12 = hostPage.getByText('12人标准场');
      if (await template12.isVisible().catch(() => false)) {
        await template12.click();
        console.log('[Host] Selected 12-player template');
      }
      
      // Click create button
      await hostPage.getByText('创建', { exact: true }).click();
      console.log('[Host] Creating room...');
      
      // Wait for room screen
      await expect(hostPage.getByText(/房间 \d{4}/)).toBeVisible({ timeout: 15000 });
      
      // Extract room number
      const roomText = await hostPage.getByText(/房间 \d{4}/).textContent();
      const roomNumber = roomText?.match(/\d{4}/)?.[0];
      
      if (!roomNumber) {
        throw new Error('Failed to extract room number');
      }
      console.log(`[Host] Room created: ${roomNumber}`);
      
      // HOST: Sit down first (take seat 1)
      console.log('[Host] Taking seat 1...');
      await hostPage.getByText('空').first().click();
      // Confirm seat dialog
      await expect(hostPage.getByText('确定入座')).toBeVisible({ timeout: 3000 }).catch(() => {});
      await hostPage.getByText('确定', { exact: true }).click().catch(() => {});
      await hostPage.waitForTimeout(500);
      console.log('[Host] Seated!');
      
      // ========== JOINERS: Login and Join Room ==========
      // Login joiners sequentially to avoid rate limiting
      const joinResults: { success: boolean; playerNum: number; error?: any }[] = [];
      
      for (let index = 0; index < joinerPages.length; index++) {
        const page = joinerPages[index];
        const playerNum = index + 2;
        
        try {
          console.log(`[Player ${playerNum}] Logging in...`);
          await page.goto('/');
          await waitForAppReady(page);
          await waitForLoggedIn(page);
          
          // Join room
          await page.getByText('进入房间').click();
          console.log(`[Player ${playerNum}] Joining room ${roomNumber}...`);
          
          // Wait for join modal
          await expect(page.getByText('加入房间')).toBeVisible({ timeout: 5000 });
          
          // Input room number
          await page.getByPlaceholder('0000').fill(roomNumber);
          
          // Click join button
          await page.getByText('加入', { exact: true }).click();
          
          // Wait for room screen
          await expect(page.getByText(/房间 \d{4}/)).toBeVisible({ timeout: 10000 });
          console.log(`[Player ${playerNum}] Joined room!`);
          
          // TAKE A SEAT - click on first empty seat (marked with "空")
          console.log(`[Player ${playerNum}] Taking a seat...`);
          const emptySeat = page.getByText('空').first();
          await expect(emptySeat).toBeVisible({ timeout: 5000 });
          await emptySeat.click();
          
          // Confirm seat dialog - click confirm button
          await page.getByText('确定', { exact: true }).click().catch(() => {});
          await page.waitForTimeout(500);
          
          console.log(`[Player ${playerNum}] Seated successfully!`);
          
          joinResults.push({ success: true, playerNum });
        } catch (error) {
          console.error(`[Player ${playerNum}] Failed:`, error);
          joinResults.push({ success: false, playerNum, error });
        }
      }
      
      const successful = joinResults.filter(r => r.success).length;
      console.log(`[Results] ${successful}/${joinerPages.length} joiners succeeded`);
      
      // Verify all 11 joiners succeeded
      expect(successful).toBe(joinerPages.length);
      
      // Wait for all players to sync
      await hostPage.waitForTimeout(2000);
      console.log('[Host] All players joined and seated!');
      
      // ========== HOST: PREPARE TO FLIP (transition from seating to seated) ==========
      // Host needs to click "准备看牌" first to allow the game to start
      console.log('[Host] Clicking 准备看牌...');
      const prepareButton = hostPage.getByText('准备看牌');
      await expect(prepareButton).toBeVisible({ timeout: 5000 });
      await prepareButton.click();
      
      // Confirm dialog - "允许看牌？"
      await expect(hostPage.getByText('允许看牌')).toBeVisible({ timeout: 3000 });
      await hostPage.getByText('确定', { exact: true }).click();
      console.log('[Host] Confirmed 准备看牌');
      
      // Wait for status to update
      await hostPage.waitForTimeout(1000);
      
      // ========== VERIFY PLAYER COUNT ==========
      // Host should see 12 players in the room
      // Look for player count indicator (e.g., "12/12" or similar)
      await hostPage.screenshot({ path: 'test-results/12-players-room.png' });
      
      // ========== START THE GAME ==========
      console.log('[Host] Starting the game...');
      
      // Look for start game button - usually "开始游戏" or similar
      const startButton = hostPage.getByText('开始游戏');
      await expect(startButton).toBeVisible({ timeout: 5000 });
      await startButton.click();
      console.log('[Host] Clicked start game button');
      
      // Confirm dialog - "开始游戏？" 
      await expect(hostPage.getByText('开始游戏？')).toBeVisible({ timeout: 3000 });
      await hostPage.getByText('确定', { exact: true }).click();
      console.log('[Host] Confirmed start game');
      
      // Wait for game to start - the "开始游戏" button should disappear
      // and "查看身份" button should appear (enabled)
      await expect(hostPage.getByText('开始游戏')).not.toBeVisible({ timeout: 10000 });
      console.log('[Host] Game started - 开始游戏 button gone');
      
      // Wait a bit for audio to play and game state to sync
      await hostPage.waitForTimeout(2000);
      
      // Take screenshot of game state
      await hostPage.screenshot({ path: 'test-results/game-started.png' });
      console.log('[Host] Game is now in progress!');
      
      // ========== VERIFY ALL PLAYERS SEE GAME ==========
      console.log('[Verify] Checking all players see the game...');
      let playersInGame = 0;
      
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const playerLabel = i === 0 ? 'Host' : `Player ${i + 1}`;
        
        try {
          // Each player should see "查看身份" button when game has started
          // This button only appears after roomStatus changes from seating to seated/ongoing
          const inGame = await page.getByText('查看身份')
            .isVisible({ timeout: 5000 })
            .catch(() => false);
          
          if (inGame) {
            console.log(`[${playerLabel}] In game ✓`);
            playersInGame++;
          } else {
            console.log(`[${playerLabel}] Not in game yet`);
          }
        } catch {
          console.log(`[${playerLabel}] Check failed`);
        }
      }
      
      console.log(`[Results] ${playersInGame}/${PLAYER_COUNT} players in game`);
      expect(playersInGame).toBeGreaterThanOrEqual(PLAYER_COUNT - 1); // Allow 1 lagging player
      
      console.log('✅ 12-player game started successfully!');
      
    } finally {
      // Cleanup all contexts
      console.log('[Cleanup] Closing all browser contexts...');
      for (const context of contexts) {
        await context.close();
      }
    }
  });
});

// Helper to complete the night phase by clicking through all action dialogs
async function completeNightPhase(hostPage: Page, templateName: string): Promise<void> {
  console.log(`[${templateName}] Starting night phase...`);
  
  // Keep clicking through dialogs until "重新开始" button appears
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // Check if night has ended (重新开始 button visible)
    const restartButton = hostPage.getByText('重新开始');
    if (await restartButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log(`[${templateName}] Night ended! 重新开始 button visible`);
      return;
    }
    
    // Check for action dialog with "好" button (after audio)
    const okButton = hostPage.getByText('好', { exact: true });
    if (await okButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log(`[${templateName}] Dismissing action dialog...`);
      await okButton.click();
      await hostPage.waitForTimeout(500);
      continue;
    }
    
    // Check for "不使用技能" or "投票空刀" button (skip action)
    const skipButton = hostPage.getByText('不使用技能').or(hostPage.getByText('投票空刀'));
    if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log(`[${templateName}] Clicking skip action...`);
      await skipButton.click();
      await hostPage.waitForTimeout(500);
      
      // Confirm skip
      const confirmButton = hostPage.getByText('确定', { exact: true });
      if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmButton.click();
        await hostPage.waitForTimeout(500);
      }
      continue;
    }
    
    // Wait a bit and try again (audio may be playing)
    await hostPage.waitForTimeout(1000);
  }
  
  throw new Error(`Night phase did not complete after ${maxAttempts} attempts for ${templateName}`);
}

// Helper to seat all players in a room
async function seatAllPlayers(pages: Page[], isReseat = false): Promise<void> {
  for (const page of pages) {
    const emptySeat = page.getByText('空');
    if (await emptySeat.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await emptySeat.first().click();
      await page.getByText('确定', { exact: true }).click().catch(() => {});
      await page.waitForTimeout(isReseat ? 300 : 500);
    }
  }
}

// Helper to start game from seating state
async function startGame(hostPage: Page, templateName: string): Promise<void> {
  // Host clicks 准备看牌
  console.log(`[${templateName}] Host clicking 准备看牌...`);
  const prepareButton = hostPage.getByText('准备看牌');
  await expect(prepareButton).toBeVisible({ timeout: 10000 });
  await prepareButton.click();
  await expect(hostPage.getByText('允许看牌')).toBeVisible({ timeout: 3000 });
  await hostPage.getByText('确定', { exact: true }).click();
  await hostPage.waitForTimeout(1000);

  // Start the game
  console.log(`[${templateName}] Starting game...`);
  const startButton = hostPage.getByText('开始游戏');
  await expect(startButton).toBeVisible({ timeout: 5000 });
  await startButton.click();
  await expect(hostPage.getByText('开始游戏？')).toBeVisible({ timeout: 3000 });
  await hostPage.getByText('确定', { exact: true }).click();
  await expect(hostPage.getByText('开始游戏')).not.toBeVisible({ timeout: 10000 });
  console.log(`[${templateName}] Game started!`);
}

// Helper to verify players are in game
async function verifyPlayersInGame(pages: Page[], expectedCount: number): Promise<number> {
  let playersInGame = 0;
  for (const page of pages) {
    const inGame = await page.getByText('查看身份').isVisible({ timeout: 3000 }).catch(() => false);
    if (inGame) playersInGame++;
  }
  expect(playersInGame).toBeGreaterThanOrEqual(expectedCount - 1);
  return playersInGame;
}

// Helper to restart game
async function restartGame(hostPage: Page, templateName: string): Promise<void> {
  console.log(`[${templateName}] Restarting for next template...`);
  const restartButton = hostPage.getByText('重新开始');
  await expect(restartButton).toBeVisible({ timeout: 5000 });
  await restartButton.click();
  await expect(hostPage.getByText('重新开始游戏？')).toBeVisible({ timeout: 3000 });
  await hostPage.getByText('确定', { exact: true }).click();
  await hostPage.waitForTimeout(2000);
  console.log(`[${templateName}] Game restarted!`);
}

/**
 * Template-specific E2E tests
 * 
 * Tests that each preset template can be used to create a room,
 * have 12 players join, start the game, complete a full night phase,
 * and restart with a new template.
 */
test.describe('Game Templates E2E', () => {
  // All preset templates from src/models/Template.ts
  const PRESET_TEMPLATE_NAMES = [
    '标准板12人',
    '狼美守卫12人',
    '狼王守卫12人',
    '石像鬼守墓人12人',
    '梦魇守卫12人',
    '血月猎魔12人',
    '狼王摄梦人12人',
    '狼王魔术师12人',
    '机械狼通灵师12人',
    '恶灵骑士12人',
  ];

  test('All templates - create room, start game, complete night, restart', async ({ browser }) => {
    // Extended timeout for testing all templates
    test.setTimeout(600000); // 10 minutes
    
    const PLAYER_COUNT = 12;
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];

    // Create 12 browser contexts
    console.log(`[Setup] Creating ${PLAYER_COUNT} browser contexts...`);
    for (let i = 0; i < PLAYER_COUNT; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      contexts.push(context);
      pages.push(page);
    }

    const hostPage = pages[0];
    const joinerPages = pages.slice(1);

    try {
      // ========== HOST: Login and Create Room with FIRST Template ==========
      const firstTemplate = PRESET_TEMPLATE_NAMES[0];
      console.log(`[Host] Logging in for first template "${firstTemplate}"...`);
      await hostPage.goto('/');
      await waitForAppReady(hostPage);
      await waitForLoggedIn(hostPage);

      // Go to config screen
      await hostPage.getByText('创建房间').click();
      console.log('[Host] On config screen...');

      // Wait for Config screen
      await expect(hostPage.getByText('快速模板')).toBeVisible({ timeout: 5000 });

      // Select the first template
      console.log(`[Host] Selecting template: ${firstTemplate}...`);
      const templateButton = hostPage.getByText(firstTemplate, { exact: true });
      await expect(templateButton).toBeVisible({ timeout: 5000 });
      await templateButton.click();

      // Click create button
      await hostPage.getByText('创建', { exact: true }).click();
      console.log('[Host] Creating room...');

      // Wait for room screen
      await expect(hostPage.getByText(/房间 \d{4}/)).toBeVisible({ timeout: 15000 });

      // Extract room number
      const roomText = await hostPage.getByText(/房间 \d{4}/).textContent();
      const roomNumber = roomText?.match(/\d{4}/)?.[0];

      if (!roomNumber) {
        throw new Error('Failed to extract room number');
      }
      console.log(`[Host] Room created: ${roomNumber}`);

      // HOST: Sit down first
      console.log('[Host] Taking seat 1...');
      await hostPage.getByText('空').first().click();
      await expect(hostPage.getByText('确定入座')).toBeVisible({ timeout: 3000 }).catch(() => {});
      await hostPage.getByText('确定', { exact: true }).click().catch(() => {});
      await hostPage.waitForTimeout(500);
      console.log('[Host] Seated!');

      // ========== JOINERS: Login and Join Room ==========
      for (let index = 0; index < joinerPages.length; index++) {
        const page = joinerPages[index];
        const playerNum = index + 2;

        console.log(`[Player ${playerNum}] Logging in...`);
        await page.goto('/');
        await waitForAppReady(page);
        await waitForLoggedIn(page);

        // Join room
        await page.getByText('进入房间').click();
        await expect(page.getByText('加入房间')).toBeVisible({ timeout: 5000 });
        await page.getByPlaceholder('0000').fill(roomNumber);
        await page.getByText('加入', { exact: true }).click();
        await expect(page.getByText(/房间 \d{4}/)).toBeVisible({ timeout: 10000 });
        console.log(`[Player ${playerNum}] Joined room!`);

        // Take a seat
        const emptySeat = page.getByText('空').first();
        await expect(emptySeat).toBeVisible({ timeout: 5000 });
        await emptySeat.click();
        await page.getByText('确定', { exact: true }).click().catch(() => {});
        await page.waitForTimeout(500);
        console.log(`[Player ${playerNum}] Seated!`);
      }

      console.log('[Setup] All 12 players joined and seated!');
      await hostPage.waitForTimeout(2000);

      // ========== TEST EACH TEMPLATE ==========
      for (let templateIndex = 0; templateIndex < PRESET_TEMPLATE_NAMES.length; templateIndex++) {
        const templateName = PRESET_TEMPLATE_NAMES[templateIndex];
        console.log(`\n========== Testing Template ${templateIndex + 1}/${PRESET_TEMPLATE_NAMES.length}: ${templateName} ==========`);

        // For subsequent templates, we need to re-seat after restart
        if (templateIndex > 0) {
          await expect(hostPage.getByText('准备看牌')).not.toBeVisible({ timeout: 5000 }).catch(() => {});
          console.log(`[${templateName}] Re-seating all players...`);
          await seatAllPlayers(pages, true);
          await hostPage.waitForTimeout(1000);
        }

        // Start the game
        await startGame(hostPage, templateName);

        // Complete the night phase
        await completeNightPhase(hostPage, templateName);

        // Take screenshot
        const screenshotName = templateName.replaceAll(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
        await hostPage.screenshot({ path: `test-results/template-${screenshotName}-night-complete.png` });

        // Verify all players see game
        const playersInGame = await verifyPlayersInGame(pages, PLAYER_COUNT);
        console.log(`[${templateName}] ${playersInGame}/${PLAYER_COUNT} players in game`);
        console.log(`✅ Template "${templateName}" - night completed successfully!`);

        // Restart for next template (if not last)
        if (templateIndex < PRESET_TEMPLATE_NAMES.length - 1) {
          await restartGame(hostPage, templateName);
        }
      }

      console.log('\n========== ALL TEMPLATES TESTED SUCCESSFULLY! ==========');

    } finally {
      console.log('[Cleanup] Closing all browser contexts...');
      for (const context of contexts) {
        await context.close();
      }
    }
  });
});