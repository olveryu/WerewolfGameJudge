/**
 * delegationSeatIdentity.contract.test.ts
 *
 * Contract test to prevent regression: in delegation mode (bot takeover),
 * action submission must use effectiveSeat, NOT mySeatNumber.
 *
 * Root cause: When Host takes over a bot, mySeatNumber may be null (Host has no seat),
 * but effectiveSeat = controlledSeat (the bot's seat).
 *
 * This test ensures:
 * 1. handleActionIntent compound/skip/confirmTrigger paths use effectiveSeat
 * 2. No action submission path uses mySeatNumber directly
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '../../../../../');

function readFileContent(relativePath: string): string {
  const absolutePath = path.join(PROJECT_ROOT, relativePath);
  return fs.readFileSync(absolutePath, 'utf-8');
}

// After refactoring, handleActionIntent logic moved to useActionOrchestrator,
// and dispatchInteraction logic moved to useInteractionDispatcher.
const ORCHESTRATOR_PATH = 'src/screens/RoomScreen/hooks/useActionOrchestrator.ts';
const DISPATCHER_PATH = 'src/screens/RoomScreen/hooks/useInteractionDispatcher.ts';

describe('Delegation Seat Identity Contract', () => {
  describe('handleActionIntent must use effectiveSeat for action submission', () => {
    /**
     * P0 Contract: compound action (witch save/poison) must use effectiveSeat
     *
     * Bug prevented: When delegating (controlledSeat=3, mySeatNumber=null),
     * compound action was checking mySeatNumber === null and returning early,
     * causing witch actions to fail silently.
     */
    it('compound action (witch) should use effectiveSeat, not mySeatNumber', () => {
      const content = readFileContent(ORCHESTRATOR_PATH);

      // Find the compound action block
      const compoundBlockRegex = /if\s*\(\s*currentSchema\?\.kind\s*===\s*['"]compound['"]\s*\)/g;
      const matches = [...content.matchAll(compoundBlockRegex)];

      expect(matches.length).toBeGreaterThan(0);

      // For each compound block, verify it uses effectiveSeat
      for (const match of matches) {
        const startIndex = match.index;
        // Get next 500 chars to capture the block
        const block = content.substring(startIndex, startIndex + 500);

        // Should check effectiveSeat === null, NOT mySeatNumber === null
        if (block.includes('null')) {
          expect(block).toMatch(/effectiveSeat\s*===\s*null/);
          expect(block).not.toMatch(/mySeatNumber\s*===\s*null/);
        }

        // Should assign targetToSubmit = effectiveSeat, NOT mySeatNumber
        if (block.includes('targetToSubmit')) {
          expect(block).toMatch(/targetToSubmit\s*=\s*effectiveSeat/);
          expect(block).not.toMatch(/targetToSubmit\s*=\s*mySeatNumber/);
        }
      }
    });

    /**
     * P0 Contract: skip action (compound) must use effectiveSeat
     */
    it('skip action (compound) should use effectiveSeat, not mySeatNumber', () => {
      const content = readFileContent(ORCHESTRATOR_PATH);

      // Find the skip compound block - look for the compound/skipAll handling specifically
      const skipCompoundRegex =
        /if\s*\(\s*intent\.stepKey\s*===\s*['"]skipAll['"]\s*\|\|\s*currentSchema\?\.kind\s*===\s*['"]compound['"]\s*\)/g;
      const match = skipCompoundRegex.exec(content);

      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        // Get next 800 chars to capture the compound skip block including skipSeat assignment
        const block = content.substring(startIndex, startIndex + 800);

        // Should check effectiveSeat === null, NOT mySeatNumber === null
        expect(block).toMatch(/effectiveSeat\s*===\s*null/);
        expect(block).not.toMatch(/mySeatNumber\s*===\s*null/);

        // Should assign skipSeat = effectiveSeat, NOT mySeatNumber
        expect(block).toMatch(/skipSeat\s*=\s*effectiveSeat/);
        expect(block).not.toMatch(/skipSeat\s*=\s*mySeatNumber/);
      }
    });

    /**
     * P0 Contract: confirmTrigger (hunter/darkWolfKing) must use effectiveSeat
     */
    it('confirmTrigger should use effectiveSeat, not mySeatNumber', () => {
      const content = readFileContent(ORCHESTRATOR_PATH);

      // Find the confirmTrigger block - look for the effectiveSeat check specifically
      // We need to find the section after the canShoot determination
      const confirmTriggerRegex = /case\s*['"]confirmTrigger['"]:\s*\{/g;
      const match = confirmTriggerRegex.exec(content);

      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        // Get next 2500 chars to capture the entire block including the effectiveSeat check
        const block = content.substring(startIndex, startIndex + 2500);

        // Should check effectiveSeat === null, NOT mySeatNumber === null
        expect(block).toMatch(/effectiveSeat\s*===\s*null/);
        expect(block).not.toMatch(/mySeatNumber\s*===\s*null/);

        // Should use effectiveSeat in proceedWithActionTyped, NOT mySeatNumber
        expect(block).toMatch(/proceedWithActionTyped\s*\(\s*effectiveSeat/);
        expect(block).not.toMatch(/proceedWithActionTyped\s*\(\s*mySeatNumber/);
      }
    });
  });

  describe('GameContext should use actor identity, not real identity', () => {
    /**
     * GameContext passed to useRoomActions must use actorSeatForUi (not mySeatNumber)
     * for all action-related seat decisions.
     */
    it('GameContext.actorSeatNumber should be actorSeatForUi', () => {
      const content = readFileContent('src/screens/RoomScreen/RoomScreen.tsx');

      // Find gameContext definition
      const gameContextRegex = /const\s+gameContext\s*=\s*useMemo\s*\(/g;
      const match = gameContextRegex.exec(content);

      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        // Get next 500 chars
        const block = content.substring(startIndex, startIndex + 500);

        // actorSeatNumber should be assigned actorSeatForUi
        expect(block).toMatch(/actorSeatNumber:\s*actorSeatForUi/);

        // actorSeatNumber should NOT be assigned mySeatNumber
        expect(block).not.toMatch(/actorSeatNumber:\s*mySeatNumber/);
      }
    });

    /**
     * GameContext.actorRole should be actorRoleForUi (not myRole)
     */
    it('GameContext.actorRole should be actorRoleForUi', () => {
      const content = readFileContent('src/screens/RoomScreen/RoomScreen.tsx');

      const gameContextRegex = /const\s+gameContext\s*=\s*useMemo\s*\(/g;
      const match = gameContextRegex.exec(content);

      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        const block = content.substring(startIndex, startIndex + 500);

        expect(block).toMatch(/actorRole:\s*actorRoleForUi/);
        expect(block).not.toMatch(/actorRole:\s*myRole/);
      }
    });
  });

  describe('useGameRoom submit functions should use effectiveSeat', () => {
    /**
     * submitAction must use effectiveSeat, not mySeatNumber
     */
    it('submitAction should use effectiveSeat', () => {
      const content = readFileContent('src/hooks/useGameRoom.ts');

      // Find submitAction definition
      const submitActionRegex = /const\s+submitAction\s*=\s*useCallback/g;
      const match = submitActionRegex.exec(content);

      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        const block = content.substring(startIndex, startIndex + 300);

        // Should use effectiveSeat (may be prefixed with debug. after sub-hook extraction)
        expect(block).toMatch(/seat\s*=\s*(debug\.)?effectiveSeat/);
        expect(block).not.toMatch(/seat\s*=\s*mySeatNumber/);
      }
    });

    /**
     * submitWolfVote must use effectiveSeat, not mySeatNumber
     */
    it('submitWolfVote should use effectiveSeat', () => {
      const content = readFileContent('src/hooks/useGameRoom.ts');

      // Find submitWolfVote definition
      const submitWolfVoteRegex = /const\s+submitWolfVote\s*=\s*useCallback/g;
      const match = submitWolfVoteRegex.exec(content);

      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        const block = content.substring(startIndex, startIndex + 200);

        // Should use effectiveSeat (may be prefixed with debug. after sub-hook extraction)
        expect(block).toMatch(/seat\s*=\s*(debug\.)?effectiveSeat/);
        expect(block).not.toMatch(/seat\s*=\s*mySeatNumber/);
      }
    });

    /**
     * P0 Contract: sendWolfRobotHunterStatusViewed takes seat param directly
     * (caller must pass effectiveSeat). Verify JSDoc / comment signals this.
     */
    it('sendWolfRobotHunterStatusViewed must accept seat param (caller passes effectiveSeat)', () => {
      const content = readFileContent('src/hooks/useGameRoom.ts');

      // Find sendWolfRobotHunterStatusViewed definition
      const regex = /const\s+sendWolfRobotHunterStatusViewed\s*=\s*useCallback/g;
      const match = regex.exec(content);

      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        const block = content.substring(startIndex, startIndex + 300);

        // Must take seat as a parameter (not derive it internally from mySeatNumber)
        expect(block).toMatch(/async\s*\(\s*seat:\s*number\s*\)/);
        // Must delegate seat to facade
        expect(block).toMatch(/facade\.sendWolfRobotHunterStatusViewed\(seat\)/);
      }
    });
  });

  describe('HUNTER_STATUS_VIEWED case must use effectiveSeat', () => {
    /**
     * P0 Contract: RoomScreen HUNTER_STATUS_VIEWED case must pass effectiveSeat
     * to sendWolfRobotHunterStatusViewed, NOT mySeatNumber.
     *
     * Bug prevented: When Host takes over wolfRobot (controlledSeat=X, mySeatNumber=null),
     * using mySeatNumber would send null and fail silently.
     */
    it('HUNTER_STATUS_VIEWED should pass effectiveSeat to sendWolfRobotHunterStatusViewed', () => {
      const content = readFileContent(DISPATCHER_PATH);

      // Find the HUNTER_STATUS_VIEWED case block
      const regex = /case\s*['"]HUNTER_STATUS_VIEWED['"]:/g;
      const match = regex.exec(content);

      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        const block = content.substring(startIndex, startIndex + 700);

        // Must call sendWolfRobotHunterStatusViewed(effectiveSeat)
        expect(block).toMatch(/sendWolfRobotHunterStatusViewed\(effectiveSeat\)/);
        // Must NOT call sendWolfRobotHunterStatusViewed(mySeatNumber)
        expect(block).not.toMatch(/sendWolfRobotHunterStatusViewed\(mySeatNumber\)/);
      }
    });
  });

  describe('wolfVote intent handler must not use findVotingWolfSeat as hard gate', () => {
    /**
     * P0 Contract: wolfVote branch should not use findVotingWolfSeat() for seat resolution
     *
     * Bug prevented: When delegating or when actor has already voted,
     * findVotingWolfSeat() returns null, causing wolfVote to silently return
     * instead of letting Host reject via actionRejected.
     */
    it('wolfVote should use effectiveSeat as fallback, not findVotingWolfSeat', () => {
      const content = readFileContent(ORCHESTRATOR_PATH);

      // Find the wolfVote case block
      const wolfVoteRegex = /case\s*['"]wolfVote['"]:\s*\{/g;
      const match = wolfVoteRegex.exec(content);

      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        // Get next 800 chars to capture the block
        const block = content.substring(startIndex, startIndex + 800);

        // Should use effectiveSeat as fallback, NOT findVotingWolfSeat()
        expect(block).toMatch(/intent\.wolfSeat\s*\?\?\s*effectiveSeat/);
        expect(block).not.toMatch(/intent\.wolfSeat\s*\?\?\s*findVotingWolfSeat\(\)/);

        // Should check seat === null for gate (seat = effectiveSeat fallback), NOT mySeatNumber
        expect(block).toMatch(/seat\s*===\s*null/);
        expect(block).not.toMatch(/mySeatNumber\s*===\s*null/);
      }
    });

    /**
     * wolfVote log should not reference myRole/mySeatNumber
     */
    it('wolfVote should log effectiveSeat/effectiveRole, not myRole/mySeatNumber', () => {
      const content = readFileContent(ORCHESTRATOR_PATH);

      const wolfVoteRegex = /case\s*['"]wolfVote['"]:\s*\{/g;
      const match = wolfVoteRegex.exec(content);

      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        const block = content.substring(startIndex, startIndex + 1000);

        // Log should include effectiveSeat/effectiveRole
        expect(block).toMatch(/effectiveSeat/);
        expect(block).toMatch(/effectiveRole/);

        // Log should NOT use myRole/mySeatNumber in warn message
        // (they should not appear as gate conditions or logged as the primary identity)
        const warnRegex = /roomScreenLog\.warn\([^)]+\)/;
        const warnMatch = warnRegex.exec(block);
        const warnBlock = warnMatch?.[0] ?? '';
        expect(warnBlock).not.toMatch(/myRole/);
        expect(warnBlock).not.toMatch(/mySeatNumber/);
      }
    });
  });

  describe('View Role Card must use effectiveSeat/effectiveRole', () => {
    /**
     * P0 Contract: View Role button visibility should use effectiveSeat
     *
     * Bug prevented: When Host has no seat (mySeatNumber=null) but takes over a bot,
     * the View Role button was hidden because it checked mySeatNumber !== null.
     */
    it('View Role button should check effectiveSeat, not mySeatNumber', () => {
      const content = readFileContent('src/screens/RoomScreen/RoomScreen.tsx');

      // Find the View Role Card button section
      const viewRoleRegex = /\{\/\*\s*View Role Card\s*\*\/\}/g;
      const match = viewRoleRegex.exec(content);

      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        // Get next 500 chars to capture the button condition
        const block = content.substring(startIndex, startIndex + 500);

        // Should check effectiveSeat !== null, NOT mySeatNumber !== null
        expect(block).toMatch(/effectiveSeat\s*!==\s*null/);
        expect(block).not.toMatch(/mySeatNumber\s*!==\s*null/);
      }
    });

    /**
     * P0 Contract: RoleCard should display effectiveRole, not myRole
     */
    it('RoleCard should use effectiveRole for display', () => {
      const content = readFileContent('src/screens/RoomScreen/RoomScreen.tsx');

      // Find the Role Card Modal section
      const roleCardRegex = /\{\/\*\s*Role Card Modal/g;
      const match = roleCardRegex.exec(content);

      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        // Get next 1500 chars to capture the modal rendering
        const block = content.substring(startIndex, startIndex + 1500);

        // Should check effectiveRole for render condition, NOT myRole
        expect(block).toMatch(/roleCardVisible\s*&&\s*\n?\s*effectiveRole\s*&&/);
        expect(block).not.toMatch(/roleCardVisible\s*&&\s*\n?\s*myRole\s*&&/);

        // RoleCardSimple should use effectiveRole
        expect(block).toMatch(/roleId=\{effectiveRole\}/);
        expect(block).not.toMatch(/roleId=\{myRole\}/);
      }
    });

    /**
     * P0 Contract: hasViewedRole check should use effectiveSeat
     */
    it('roleCard hasViewedRole check should use effectiveSeat', () => {
      const content = readFileContent(DISPATCHER_PATH);

      // Find the roleCard case in dispatchInteraction
      const roleCardCaseRegex = /case\s*['"]roleCard['"]:\s*\{/g;
      const match = roleCardCaseRegex.exec(content);

      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        // Get next 600 chars
        const block = content.substring(startIndex, startIndex + 600);

        // Should get player from effectiveSeat, NOT mySeatNumber
        expect(block).toMatch(/effectiveSeat\s*===\s*null/);
        expect(block).toMatch(/gameState\?\.players\.get\(effectiveSeat\)/);
        expect(block).not.toMatch(/gameState\?\.players\.get\(mySeatNumber\)/);
      }
    });
  });

  describe('Auto-trigger idempotency key must include actor seat dimension', () => {
    /**
     * P0 Contract: auto-trigger idempotency key must include actor seat
     *
     * Bug prevented: When Host switches controlledSeat from wolf A to wolf B
     * within the same wolfVote step, the idempotency key was identical
     * (same step, same role, same intent type) → prompt was skipped for wolf B.
     *
     * The key MUST include an actor-seat-level field (actorSeatForUi or effectiveSeat)
     * so that switching seats produces a different key and re-triggers the prompt.
     */
    it('idempotency key must contain actorSeatForUi (preferred) or effectiveSeat', () => {
      const content = readFileContent(ORCHESTRATOR_PATH);

      // Find the idempotency key construction block
      // We need the one inside the auto-trigger useEffect, not any other key.
      // The auto-trigger key is preceded by a comment about "Auto-trigger"
      const idempotencySection = content.indexOf('Auto-trigger intent');
      expect(idempotencySection).toBeGreaterThan(-1);

      // Find the key = [...] within the region after that comment
      const searchRegion = content.substring(idempotencySection, idempotencySection + 1500);
      const keyStart = searchRegion.indexOf('const key = [');
      expect(keyStart).toBeGreaterThan(-1);

      // Extract the key array (up to '].join')
      const keyRegion = searchRegion.substring(keyStart);
      const joinIndex = keyRegion.indexOf('].join');
      expect(joinIndex).toBeGreaterThan(-1);

      const keyArrayBlock = keyRegion.substring(0, joinIndex);

      // MUST include actor seat dimension: actorSeatForUi (preferred) or effectiveSeat
      const hasActorSeat = keyArrayBlock.includes('actorSeatForUi');
      const hasEffectiveSeat = keyArrayBlock.includes('effectiveSeat');
      expect(hasActorSeat || hasEffectiveSeat).toBe(true);
    });

    /**
     * Contract: key must NOT be solely composed of step/role-level fields
     * (which are identical across different wolf seats in the same step).
     *
     * A key without any seat-level field would cause cross-seat deduplication.
     */
    it('idempotency key must not be missing all seat-level fields', () => {
      const content = readFileContent(ORCHESTRATOR_PATH);

      const idempotencySection = content.indexOf('Auto-trigger intent');
      expect(idempotencySection).toBeGreaterThan(-1);

      const searchRegion = content.substring(idempotencySection, idempotencySection + 1500);
      const keyStart = searchRegion.indexOf('const key = [');
      expect(keyStart).toBeGreaterThan(-1);

      const keyRegion = searchRegion.substring(keyStart);
      const joinIndex = keyRegion.indexOf('].join');
      expect(joinIndex).toBeGreaterThan(-1);

      const keyArrayBlock = keyRegion.substring(0, joinIndex);

      // At least one of these seat-level fields must be present
      const seatFields = ['actorSeatForUi', 'effectiveSeat', 'mySeatNumber', 'controlledSeat'];
      const presentSeatFields = seatFields.filter((f) => keyArrayBlock.includes(f));

      expect(presentSeatFields.length).toBeGreaterThan(0);

      // If mySeatNumber is used as the sole seat field, that's a bug
      // (mySeatNumber is null for Host delegation → no differentiation)
      if (presentSeatFields.length === 1 && presentSeatFields[0] === 'mySeatNumber') {
        throw new Error(
          'Idempotency key uses mySeatNumber as sole seat field. ' +
            'This will cause cross-seat deduplication when Host delegates (mySeatNumber=null). ' +
            'Use actorSeatForUi or effectiveSeat instead.',
        );
      }
    });

    /**
     * Contract: useEffect deps must include the seat field used in key
     */
    it('useEffect dependency array must include the seat field used in key', () => {
      const content = readFileContent(ORCHESTRATOR_PATH);

      const idempotencySection = content.indexOf('Auto-trigger intent');
      expect(idempotencySection).toBeGreaterThan(-1);

      // Find the deps array: starts with '}, [' after handleActionIntent call
      const afterSection = content.substring(idempotencySection, idempotencySection + 2000);

      // Find which seat field is in the key
      const keyStart = afterSection.indexOf('const key = [');
      const keyRegion = afterSection.substring(keyStart);
      const joinIndex = keyRegion.indexOf('].join');
      const keyArrayBlock = keyRegion.substring(0, joinIndex);

      const usesActorSeat = keyArrayBlock.includes('actorSeatForUi');
      const usesEffectiveSeat = keyArrayBlock.includes('effectiveSeat');

      // Find the deps array (the }, [ ... ]); block at the end of useEffect)
      const depsRegex = /\},\s*\[([\s\S]*?)\]\);/g;
      const depsMatch = depsRegex.exec(afterSection);
      expect(depsMatch).toBeTruthy();
      const depsBlock = depsMatch![1];

      // The seat field used in the key must appear in deps
      if (usesActorSeat) {
        expect(depsBlock).toContain('actorSeatForUi');
      }
      if (usesEffectiveSeat) {
        expect(depsBlock).toContain('effectiveSeat');
      }
    });
  });

  describe('Wolf participation check consistency (getActionIntent vs getSkipIntent)', () => {
    /**
     * P3 Contract: getSkipIntent and getActionIntent must use the same wolf
     * participation check — doesRoleParticipateInWolfVote (NOT isWolfRole).
     *
     * isWolfRole checks team==='wolf' which includes non-voting wolves
     * (wolfRobot, gargoyle) that must NOT generate wolfVote skip intents.
     *
     * Bug prevented: If getSkipIntent uses isWolfRole while getActionIntent uses
     * doesRoleParticipateInWolfVote, a non-voting wolf could theoretically generate
     * a wolfVote skip intent but not a wolfVote seat-tap intent — logic drift.
     */
    it('getSkipIntent must use doesRoleParticipateInWolfVote, not isWolfRole', () => {
      const content = readFileContent('src/screens/RoomScreen/hooks/useRoomActions.ts');

      // Find getSkipIntent definition
      const getSkipRegex = /const\s+getSkipIntent\s*=\s*useCallback/g;
      const match = getSkipRegex.exec(content);
      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        // Capture enough to include the isWolf assignment
        const block = content.substring(startIndex, startIndex + 500);

        // Must use doesRoleParticipateInWolfVote for wolf check
        expect(block).toMatch(/isWolf\s*=\s*doesRoleParticipateInWolfVote\(actorRole\)/);

        // Must NOT use isWolfRole for wolf check
        expect(block).not.toMatch(/isWolf\s*=\s*isWolfRole\(actorRole\)/);
      }
    });
  });

  describe('wolfRobot hunter gate with controlledSeat (debug takeover)', () => {
    /**
     * P0 Contract: Orchestrator's wolfRobotViewHunterStatus case must:
     * 1. Gate on pendingHunterStatusViewed (idempotent, prevent duplicate submission)
     * 2. Call sendWolfRobotHunterStatusViewed(effectiveSeat) — not mySeatNumber
     */
    it('orchestrator wolfRobotViewHunterStatus uses pendingHunterStatusViewed gate + effectiveSeat', () => {
      const content = readFileContent(ORCHESTRATOR_PATH);

      // Find the wolfRobotViewHunterStatus case block
      const regex = /case\s*['"]wolfRobotViewHunterStatus['"]:\s*\{/g;
      const match = regex.exec(content);

      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        const block = content.substring(startIndex, startIndex + 2000);

        // Must gate on pendingHunterStatusViewed (prevent duplicate submission)
        expect(block).toMatch(/pendingHunterStatusViewed/);

        // Must call sendWolfRobotHunterStatusViewed(effectiveSeat)
        expect(block).toMatch(/sendWolfRobotHunterStatusViewed\(effectiveSeat\)/);

        // Must NOT call sendWolfRobotHunterStatusViewed(mySeatNumber)
        expect(block).not.toMatch(/sendWolfRobotHunterStatusViewed\(mySeatNumber\)/);

        // Must set pendingHunterStatusViewed(true) before the async call
        expect(block).toMatch(/setPendingHunterStatusViewed\(true\)/);

        // Must reset pendingHunterStatusViewed(false) in finally/catch
        expect(block).toMatch(/setPendingHunterStatusViewed\(false\)/);
      }
    });

    /**
     * P0 Contract: Dispatcher's HUNTER_STATUS_VIEWED case must:
     * 1. Gate on pendingHunterStatusViewed (prevent duplicate submission)
     * 2. Call sendWolfRobotHunterStatusViewed(effectiveSeat) — not mySeatNumber
     */
    it('dispatcher HUNTER_STATUS_VIEWED gates on pendingHunterStatusViewed + uses effectiveSeat', () => {
      const content = readFileContent(DISPATCHER_PATH);

      // Find the HUNTER_STATUS_VIEWED case block
      const regex = /case\s*['"]HUNTER_STATUS_VIEWED['"]:/g;
      const match = regex.exec(content);

      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        const block = content.substring(startIndex, startIndex + 700);

        // Must gate on pendingHunterStatusViewed (prevent duplicate submission)
        expect(block).toMatch(/pendingHunterStatusViewed/);

        // Must call sendWolfRobotHunterStatusViewed(effectiveSeat)
        expect(block).toMatch(/sendWolfRobotHunterStatusViewed\(effectiveSeat\)/);

        // Must NOT call sendWolfRobotHunterStatusViewed(mySeatNumber)
        expect(block).not.toMatch(/sendWolfRobotHunterStatusViewed\(mySeatNumber\)/);
      }
    });

    /**
     * Contract: IGameFacade.sendWolfRobotHunterStatusViewed must accept seat as param
     * (not derive it internally) — this is the API contract for debug takeover support.
     */
    it('IGameFacade.sendWolfRobotHunterStatusViewed takes seat parameter', () => {
      const content = readFileContent('src/services/types/IGameFacade.ts');

      // Find the method signature
      const regex = /sendWolfRobotHunterStatusViewed\s*\(\s*seat\s*:\s*number\s*\)/;
      expect(content).toMatch(regex);
    });
  });
});
