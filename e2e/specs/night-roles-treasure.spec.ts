import { expect, test } from '@playwright/test';

import {
  clickBottomButton,
  dismissAlert,
  findAllRolePageIndices,
  findRolePageIndex,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { withSetup } from '../helpers/night-setup';

/**
 * Night Roles E2E — TreasureMaster (盗宝大师)
 *
 * Verifies the treasureMaster bottom-card selection flow and subsequent
 * unchosen-bottom-card step auto-skip. Uses a 4-player template:
 *
 *   wolf(2) + villager(2) + seer + poisoner + treasureMaster = 7 roles
 *   → 4 players + 3 bottom cards
 *
 * Bottom card constraints guarantee TM and at least 1 wolf are always players.
 * Night step order: treasureMasterChoose → wolfKill → poisonerPoison → seerCheck.
 */

test.setTimeout(180_000);

// ============================================================================
// Tests
// ============================================================================

test.describe('Night Roles — TreasureMaster', () => {
  // --------------------------------------------------------------------------
  // TreasureMaster picks a card → night completes
  // --------------------------------------------------------------------------
  test('treasureMaster picks bottom card → night completes', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 2,
            villagers: 2,
            goodRoles: ['seer', 'poisoner'],
            specialRoles: ['treasureMaster'],
          }),
      },
      async ({ pages, roleMap }) => {
        const tmIdx = findRolePageIndex(roleMap, '盗宝大师');
        const wolfIndices = findAllRolePageIndices(roleMap, '狼人');
        const seerIdx = findRolePageIndex(roleMap, '预言家');
        const poisonerIdx = findRolePageIndex(roleMap, '毒师');

        // TM and wolf are guaranteed to be players (bottom card constraints)
        expect(tmIdx, 'treasureMaster must be a player').not.toBe(-1);
        expect(wolfIndices.length, 'wolf must be a player').toBeGreaterThan(0);

        // === Step 1: TreasureMaster's turn — pick a bottom card ===
        const tmTurn = await waitForRoleTurn(pages[tmIdx], ['选择', '底牌'], pages, 120);
        expect(tmTurn, 'TreasureMaster turn should be detected').toBe(true);

        // Dismiss the "盗宝大师行动" info alert
        await dismissAlert(pages[tmIdx]);

        // Click "选择底牌" button in bottom action panel
        const chooseBtn = pages[tmIdx]
          .locator('[data-testid="bottom-action-panel"]')
          .getByText('选择底牌', { exact: true })
          .first();
        await chooseBtn.waitFor({ state: 'visible', timeout: 5000 });
        await chooseBtn.click({ force: true });

        // Wait for the bottom card modal (subtitle "你的阵营：...")
        await pages[tmIdx]
          .getByText('你的阵营', { exact: false })
          .first()
          .waitFor({ state: 'visible', timeout: 5000 });

        // Pick the first non-wolf card visible in the modal.
        // Wolf cards are disabled; good/villager cards are clickable.
        const CANDIDATE_NAMES = ['平民', '预言家', '毒师'];
        let clicked = false;
        for (const name of CANDIDATE_NAMES) {
          const card = pages[tmIdx].getByText(name, { exact: true }).first();
          if (await card.isVisible().catch(() => false)) {
            await card.click({ force: true });
            clicked = true;
            break;
          }
        }
        expect(clicked, 'Should find a non-wolf bottom card to click').toBe(true);

        // Confirm selection in the "确认选择" alert
        await dismissAlert(pages[tmIdx]);

        // === Step 2: Wolf's turn — forced empty kill (poisoner in template) ===
        // All wolf players must confirm the empty kill.
        const wolfTurn = await waitForRoleTurn(pages[wolfIndices[0]], ['袭击', '放弃'], pages, 120);
        expect(wolfTurn, 'Wolf turn should be detected').toBe(true);

        for (const wIdx of wolfIndices) {
          await dismissAlert(pages[wIdx]);
          const emptyKillBtn = pages[wIdx]
            .locator('[data-testid="bottom-action-panel"]')
            .getByText('放弃袭击', { exact: false })
            .first();
          await emptyKillBtn.waitFor({ state: 'visible', timeout: 5000 });
          await emptyKillBtn.click({ force: true });
          await dismissAlert(pages[wIdx]);
        }

        // === Step 3: Poisoner & Seer (if they are players, not bottom cards) ===
        if (poisonerIdx !== -1) {
          const turn = await waitForRoleTurn(pages[poisonerIdx], ['毒杀', '选择'], pages, 60);
          if (turn) {
            await clickBottomButton(pages[poisonerIdx], '不用技能');
            await dismissAlert(pages[poisonerIdx]);
          }
        }
        if (seerIdx !== -1) {
          const turn = await waitForRoleTurn(pages[seerIdx], ['查验', '选择'], pages, 60);
          if (turn) {
            await clickBottomButton(pages[seerIdx], '不用技能');
            await dismissAlert(pages[seerIdx]);
          }
        }

        // === Step 4: Night should end ===
        const ended = await waitForNightEnd(pages, 120);
        expect(ended, 'Night should complete with treasureMaster').toBe(true);
      },
    );
  });
});
