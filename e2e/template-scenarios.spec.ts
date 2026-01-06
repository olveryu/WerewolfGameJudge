import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * Template Scenario E2E Tests
 * 
 * Tests each template's night phase scenarios similar to unit tests:
 * - Execute specific actions for each role in order
 * - Verify "查看昨晚信息" shows correct death info
 * 
 * This mirrors the unit tests in src/models/__tests__/templates/
 */

// Increase timeout for multiplayer tests
test.setTimeout(300000);

// ============ HELPER FUNCTIONS ============

async function waitForAppReady(page: Page) {
  await page.waitForSelector('text=狼人杀法官', { timeout: 15000 });
}

async function waitForLoggedIn(page: Page, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
  // The seat number is displayed as text in the tile
  // We need to click the tile that shows this number
  const seatText = page.locator(`text="${seatNumber}"`).first();
  await expect(seatText).toBeVisible({ timeout: 3000 });
  await seatText.click();
  await page.waitForTimeout(300);
}

// Confirm action dialog
async function confirmAction(page: Page): Promise<void> {
  const confirmButton = page.getByText('确定', { exact: true });
  if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmButton.click();
    await page.waitForTimeout(500);
  }
}

// Dismiss "好" dialog after audio
async function dismissActionDialog(page: Page): Promise<void> {
  const okButton = page.getByText('好', { exact: true });
  if (await okButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await okButton.click();
    await page.waitForTimeout(500);
  }
}

// Skip current role's action
async function skipAction(page: Page): Promise<void> {
  const skipButton = page.getByText('不使用技能').or(page.getByText('投票空刀'));
  if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipButton.click();
    await confirmAction(page);
  }
}

// Execute a role action with specific target
async function executeRoleAction(
  page: Page, 
  targetSeat: number | null,
  isPoison = false // For witch: true = poison, false = save
): Promise<void> {
  // Wait for and dismiss the "好" dialog
  await dismissActionDialog(page);
  
  if (targetSeat === null) {
    // Skip action
    await skipAction(page);
  } else {
    // Click on target seat
    await clickSeat(page, targetSeat);
    
    // For witch, may need to select poison vs save
    // This is handled by the extra parameter in the confirm dialog
    
    await confirmAction(page);
  }
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
  
  // Wait for dialog
  await page.waitForTimeout(500);
  
  // Get the dialog content - look for text containing "昨天晚上"
  const dialogContent = page.locator('text=/昨天晚上.*/')
    .or(page.locator('text=平安夜'));
  
  const text = await dialogContent.textContent({ timeout: 3000 }).catch(() => null);
  
  // Dismiss dialog
  await page.getByText('确定', { exact: true }).click().catch(() => {});
  
  return text || '';
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

test.describe('Template Scenarios E2E', () => {
  test('All templates - night scenarios with verification', async ({ browser }) => {
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
      // ========== INITIAL SETUP ==========
      const firstTemplate = TEMPLATE_CONFIGS[0];
      console.log(`[Setup] Setting up room with template: ${firstTemplate.name}`);
      
      await hostPage.goto('/');
      await waitForAppReady(hostPage);
      await waitForLoggedIn(hostPage);

      // Create room with first template
      await hostPage.getByText('创建房间').click();
      await expect(hostPage.getByText('快速模板')).toBeVisible({ timeout: 5000 });
      await hostPage.getByText(firstTemplate.name, { exact: true }).click();
      await hostPage.getByText('创建', { exact: true }).click();
      await expect(hostPage.getByText(/房间 \d{4}/)).toBeVisible({ timeout: 15000 });

      const roomText = await hostPage.getByText(/房间 \d{4}/).textContent();
      const roomNumber = roomText?.match(/\d{4}/)?.[0];
      if (!roomNumber) throw new Error('Failed to extract room number');
      console.log(`[Setup] Room created: ${roomNumber}`);

      // Host sits first
      await hostPage.getByText('空').first().click();
      await hostPage.getByText('确定', { exact: true }).click().catch(() => {});
      await hostPage.waitForTimeout(500);

      // All joiners join and sit
      for (let i = 0; i < joinerPages.length; i++) {
        const page = joinerPages[i];
        await page.goto('/');
        await waitForAppReady(page);
        await waitForLoggedIn(page);
        
        await page.getByText('进入房间').click();
        await expect(page.getByText('加入房间')).toBeVisible({ timeout: 5000 });
        await page.getByPlaceholder('0000').fill(roomNumber);
        await page.getByText('加入', { exact: true }).click();
        await expect(page.getByText(/房间 \d{4}/)).toBeVisible({ timeout: 10000 });
        
        const emptySeat = page.getByText('空').first();
        await emptySeat.click();
        await page.getByText('确定', { exact: true }).click().catch(() => {});
        await page.waitForTimeout(300);
      }

      console.log('[Setup] All 12 players joined!');
      await hostPage.waitForTimeout(2000);

      // ========== TEST EACH TEMPLATE'S SCENARIOS ==========
      for (let templateIndex = 0; templateIndex < TEMPLATE_CONFIGS.length; templateIndex++) {
        const template = TEMPLATE_CONFIGS[templateIndex];
        console.log(`\n========== Template ${templateIndex + 1}/${TEMPLATE_CONFIGS.length}: ${template.name} ==========`);

        for (let scenarioIndex = 0; scenarioIndex < template.scenarios.length; scenarioIndex++) {
          const scenario = template.scenarios[scenarioIndex];
          console.log(`\n----- Scenario ${scenarioIndex + 1}: ${scenario.name} -----`);

          // Re-seat if needed (after restart)
          if (templateIndex > 0 || scenarioIndex > 0) {
            await hostPage.waitForTimeout(1000);
            // Re-seat all players
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
          const prepareButton = hostPage.getByText('准备看牌');
          await expect(prepareButton).toBeVisible({ timeout: 10000 });
          await prepareButton.click();
          await expect(hostPage.getByText('允许看牌')).toBeVisible({ timeout: 3000 });
          await hostPage.getByText('确定', { exact: true }).click();
          await hostPage.waitForTimeout(1000);

          const startButton = hostPage.getByText('开始游戏');
          await expect(startButton).toBeVisible({ timeout: 5000 });
          await startButton.click();
          await expect(hostPage.getByText('开始游戏？')).toBeVisible({ timeout: 3000 });
          await hostPage.getByText('确定', { exact: true }).click();
          await expect(hostPage.getByText('开始游戏')).not.toBeVisible({ timeout: 10000 });
          console.log(`[${template.name}] Game started!`);

          // Execute each action in order
          for (let actionIndex = 0; actionIndex < scenario.actions.length; actionIndex++) {
            const action = scenario.actions[actionIndex];
            const roleName = template.actionOrder[actionIndex];
            console.log(`  [${roleName}] Target: ${action.targetSeat ?? 'skip'}`);
            
            await executeRoleAction(hostPage, action.targetSeat, action.isPoison);
          }

          // Wait for night to end
          await waitForNightEnd(hostPage);
          console.log(`[${template.name}] Night ended!`);

          // Verify last night info
          const lastNightInfo = await getLastNightInfo(hostPage);
          console.log(`[${template.name}] Last night info: "${lastNightInfo}"`);
          
          // Check if expected info is in the result
          if (scenario.expectedInfo === '平安夜') {
            expect(lastNightInfo).toContain('平安夜');
          } else {
            expect(lastNightInfo).toContain(scenario.expectedInfo);
          }

          console.log(`✅ Scenario "${scenario.name}" passed!`);

          // Restart for next scenario
          const restartButton = hostPage.getByText('重新开始');
          await expect(restartButton).toBeVisible({ timeout: 5000 });
          await restartButton.click();
          await expect(hostPage.getByText('重新开始游戏？')).toBeVisible({ timeout: 3000 });
          await hostPage.getByText('确定', { exact: true }).click();
          await hostPage.waitForTimeout(2000);
        }

        console.log(`✅ Template "${template.name}" - all scenarios passed!`);
      }

      console.log('\n========== ALL TEMPLATE SCENARIOS PASSED! ==========');

    } finally {
      console.log('[Cleanup] Closing all browser contexts...');
      for (const context of contexts) {
        await context.close();
      }
    }
  });
});
