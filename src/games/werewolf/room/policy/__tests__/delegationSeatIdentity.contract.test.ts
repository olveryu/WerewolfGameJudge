/**
 * delegationSeatIdentity.contract.test.ts
 *
 * Contract test to prevent regression: bot takeover authority crosses the
 * client boundary only as controlledSeat. Action inputs never claim actor seat
 * or role; effective identity remains UI-only.
 *
 * Root cause: When Host takes over a bot, mySeat may be null (Host has no seat),
 * but effectiveSeat = controlledSeat (the bot's seat).
 *
 * This test ensures canonical inputs and controlledSeat remain separate.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const PROJECT_ROOT = process.cwd();

function readFileContent(relativePath: string): string {
  const absolutePath = path.join(PROJECT_ROOT, relativePath);
  return fs.readFileSync(absolutePath, 'utf-8');
}

// After refactoring, handleActionIntent logic moved to useActionOrchestrator,
// and dispatchInteraction logic moved to useInteractionDispatcher.
// C09 further extracted intent handlers into individual executor files.
const ORCHESTRATOR_PATH = 'src/games/werewolf/room/hooks/useActionOrchestrator.ts';
const DISPATCHER_PATH = 'src/games/werewolf/room/hooks/useInteractionDispatcher.ts';
const ACTION_SUBMIT_EXECUTOR_PATH = 'src/games/werewolf/room/executors/actionSubmitExecutor.ts';
const SKIP_EXECUTOR_PATH = 'src/games/werewolf/room/executors/skipExecutor.ts';
const WOLF_VOTE_EXECUTOR_PATH = 'src/games/werewolf/room/executors/wolfVoteExecutor.ts';
const PROMPT_EXECUTOR_PATH = 'src/games/werewolf/room/executors/promptExecutor.ts';
const WOLF_ROBOT_EXECUTOR_PATH = 'src/games/werewolf/room/executors/wolfRobotExecutor.ts';

describe('Delegation Seat Identity Contract', () => {
  describe('action executors must build canonical inputs without actor authority', () => {
    /**
     * P0 Contract: compound action (witch save/poison) must use effectiveSeat
     *
     * Bug prevented: When delegating (controlledSeat=3, mySeat=null),
     * compound action was checking mySeat === null and returning early,
     * causing witch actions to fail silently.
     */
    it('compound action builds witch input without actor seat', () => {
      const content = readFileContent(ACTION_SUBMIT_EXECUTOR_PATH);
      expect(content).toMatch(/buildWitchActionInput/);
      expect(content).not.toMatch(/targetToSubmit/);
      expect(content).not.toMatch(/proceedWithAction\(effectiveSeat/);
      expect(content).not.toMatch(/proceedWithAction\(mySeat/);
    });

    /**
     * P0 Contract: every schema uses the same skip input without actor authority.
     */
    it('skip uses one canonical input without schema-specific or actor fields', () => {
      const content = readFileContent(SKIP_EXECUTOR_PATH);
      expect(content).toMatch(/proceedWithAction\(\{\s*kind:\s*['"]skip['"]\s*\}\)/);
      expect(content).not.toMatch(/buildWitchActionInput/);
      expect(content).not.toMatch(/kind:\s*['"]target['"]\s*,\s*target:\s*null/);
      expect(content).not.toMatch(/confirmed:\s*false/);
      expect(content).not.toMatch(/skipSeat/);
      expect(content).not.toMatch(/effectiveSeat/);
      expect(content).not.toMatch(/mySeat/);
    });

    /**
     * P0 Contract: confirmTrigger (hunter/darkWolfKing) must use effectiveSeat
     */
    it('confirmTrigger submits confirm input without actor seat', () => {
      // confirmTrigger logic now lives in promptExecutor.ts
      const content = readFileContent(PROMPT_EXECUTOR_PATH);

      // Should check effectiveSeat === null, NOT mySeat === null
      expect(content).toMatch(/effectiveSeat\s*===\s*null/);
      expect(content).not.toMatch(/mySeat\s*===\s*null/);

      expect(content).toMatch(/proceedWithAction\(\{\s*kind:\s*['"]confirm['"]/);
      expect(content).not.toMatch(/proceedWithAction\(effectiveSeat/);
      expect(content).not.toMatch(/proceedWithAction\(mySeat/);
    });
  });

  describe('GameContext should use actor identity, not real identity', () => {
    /**
     * GameContext passed to useRoomActions must use actorSeatForUi (not mySeat)
     * for all action-related seat decisions.
     */
    it('GameContext.actorSeat should be actorSeatForUi', () => {
      const content = readFileContent(
        'src/games/werewolf/room/hooks/useWerewolfRoomScreenState.ts',
      );

      // Find gameContext definition
      const gameContextRegex = /const\s+gameContext\s*=\s*useMemo\s*\(/g;
      const match = gameContextRegex.exec(content);

      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        // Get next 500 chars
        const block = content.substring(startIndex, startIndex + 500);

        // actorSeat should be assigned actorSeatForUi
        expect(block).toMatch(/actorSeat:\s*actorSeatForUi/);

        // actorSeat should NOT be assigned mySeat
        expect(block).not.toMatch(/actorSeat:\s*mySeat/);
      }
    });

    /**
     * GameContext.actorRole should be actorRoleForUi (not myRole)
     */
    it('GameContext.actorRole should be actorRoleForUi', () => {
      const content = readFileContent(
        'src/games/werewolf/room/hooks/useWerewolfRoomScreenState.ts',
      );

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

  describe('useWerewolfRoom submit functions must isolate controlledSeat authority', () => {
    /**
     * submitAction must use effectiveSeat, not mySeat
     */
    it('submitAction passes typed input and controlledSeat only', () => {
      const content = readFileContent('src/games/werewolf/hooks/useWerewolfGameActions.ts');

      // Find submitAction definition
      const submitActionRegex = /const\s+submitAction\s*=\s*useCallback/g;
      const match = submitActionRegex.exec(content);

      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        const block = content.substring(startIndex, startIndex + 300);

        expect(block).toMatch(/facade\.submitAction\(input,\s*debug\.controlledSeat\)/);
        expect(block).not.toMatch(/facade\.submitAction\([^)]*effectiveRole/);
        expect(block).not.toMatch(/facade\.submitAction\([^)]*effectiveSeat/);
      }
    });

    /**
     * P0 Contract: sendWolfRobotHunterStatusViewed takes seat param directly
     * (caller must pass effectiveSeat). Verify JSDoc / comment signals this.
     */
    it('sendWolfRobotHunterStatusViewed derives controlledSeat from debug state', () => {
      const content = readFileContent('src/games/werewolf/hooks/useWerewolfGameActions.ts');

      // Find sendWolfRobotHunterStatusViewed definition
      const regex = /const\s+sendWolfRobotHunterStatusViewed\s*=\s*useCallback/g;
      const match = regex.exec(content);

      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        const block = content.substring(startIndex, startIndex + 300);

        expect(block).toMatch(/async\s*\(\s*\)/);
        expect(block).toMatch(/facade\.sendWolfRobotHunterStatusViewed\(debug\.controlledSeat\)/);
      }
    });
  });

  describe('wolfVote intent handler must not use findVotingWolfSeat as hard gate', () => {
    /**
     * P0 Contract: wolfVote branch should not use findVotingWolfSeat() for seat resolution
     *
     * Bug prevented: When delegating or when actor has already voted,
     * findVotingWolfSeat() returns null, causing wolfVote to silently return
     * instead of letting server reject via actionRejected.
     */
    it('wolfVote should use effectiveSeat as fallback, not findVotingWolfSeat', () => {
      // wolfVote logic now lives in wolfVoteExecutor.ts
      const content = readFileContent(WOLF_VOTE_EXECUTOR_PATH);

      // Should use effectiveSeat as fallback, NOT findVotingWolfSeat()
      expect(content).toMatch(/intent\.wolfSeat\s*\?\?\s*effectiveSeat/);
      expect(content).not.toMatch(/intent\.wolfSeat\s*\?\?\s*findVotingWolfSeat\(\)/);

      // Should check seat === null for gate (seat = effectiveSeat fallback), NOT mySeat
      expect(content).toMatch(/seat\s*===\s*null/);
      expect(content).not.toMatch(/mySeat\s*===\s*null/);
    });

    /**
     * wolfVote log should not reference myRole/mySeat
     */
    it('wolfVote should log effectiveSeat/effectiveRole, not myRole/mySeat', () => {
      // wolfVote logic now lives in wolfVoteExecutor.ts
      const content = readFileContent(WOLF_VOTE_EXECUTOR_PATH);

      // Log should include effectiveSeat/effectiveRole
      expect(content).toMatch(/effectiveSeat/);
      expect(content).toMatch(/effectiveRole/);

      // Log should NOT use myRole/mySeat in warn message
      const warnRegex = /roomScreenLog\.warn\([^)]+\)/;
      const warnMatch = warnRegex.exec(content);
      const warnBlock = warnMatch?.[0] ?? '';
      expect(warnBlock).not.toMatch(/myRole/);
      expect(warnBlock).not.toMatch(/mySeat/);
    });
  });

  describe('View Role Card must use effectiveSeat/effectiveRole', () => {
    /**
     * P0 Contract: View Role button visibility should use effectiveSeat
     *
     * Bug prevented: When Host has no seat (mySeat=null) but takes over a bot,
     * the View Role button was hidden because it checked mySeat !== null.
     *
     * After the declarative layout refactor, view role visibility is driven by
     * LayoutContext.effectiveSeat in bottomLayoutConfig.ts + resolveBottomLayout.ts.
     * WerewolfRoomScreen.tsx constructs LayoutContext from effectiveSeat.
     */
    it('View Role button should check effectiveSeat, not mySeat', () => {
      // 1. LayoutContext must declare effectiveSeat, not mySeat
      const configContent = readFileContent('src/games/werewolf/room/hooks/bottomLayoutConfig.ts');
      expect(configContent).toMatch(/effectiveSeat:\s*number\s*\|\s*null/);
      expect(configContent).not.toMatch(/mySeat/);

      // 2. resolveBottomLayout derives userRole from effectiveSeat
      const resolverContent = readFileContent(
        'src/games/werewolf/room/hooks/resolveBottomLayout.ts',
      );
      expect(resolverContent).toMatch(/ctx\.effectiveSeat\s*!==\s*null/);
      expect(resolverContent).not.toMatch(/mySeat/);

      // 3. WerewolfRoomScreen constructs LayoutContext with effectiveSeat
      const screenContent = readFileContent('src/games/werewolf/room/WerewolfRoomScreen.tsx');
      expect(screenContent).toMatch(/effectiveSeat/);
      // WerewolfRoomScreen should not pass mySeat into the layout context
      expect(screenContent).not.toMatch(/mySeat.*layoutCtx|layoutCtx.*mySeat/);
    });

    /**
     * P0 Contract: RoleCard should display effectiveRole, not myRole
     */
    it('RoleCard should use effectiveRole for display', () => {
      const content = readFileContent('src/games/werewolf/room/WerewolfRoomScreen.tsx');

      // Find the Role Card Modal section
      const roleCardRegex = /\{\/\*\s*Role Card Modal/g;
      const match = roleCardRegex.exec(content);

      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        // Get next 1500 chars to capture the modal rendering
        const block = content.substring(startIndex, startIndex + 1500);

        // Should check effectiveRole for render condition, NOT myRole
        expect(block).toMatch(/roleCardVisible.*&&\s*\n?\s*effectiveRole\s*&&/);
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

        // Should get player from effectiveSeat, NOT mySeat
        expect(block).toMatch(/effectiveSeat\s*===\s*null/);
        expect(block).toMatch(/gameState\?\.players\.get\(effectiveSeat\)/);
        expect(block).not.toMatch(/gameState\?\.players\.get\(mySeat\)/);
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
      const seatFields = ['actorSeatForUi', 'effectiveSeat', 'mySeat', 'controlledSeat'];
      const presentSeatFields = seatFields.filter((f) => keyArrayBlock.includes(f));

      expect(presentSeatFields.length).toBeGreaterThan(0);

      // If mySeat is used as the sole seat field, that's a bug
      // (mySeat is null for Host delegation → no differentiation)
      if (presentSeatFields.length === 1 && presentSeatFields[0] === 'mySeat') {
        throw new Error(
          'Idempotency key uses mySeat as sole seat field. ' +
            'This will cause cross-seat deduplication when Host delegates (mySeat=null). ' +
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
      const content = readFileContent('src/games/werewolf/room/hooks/useRoomActions.ts');

      // Find getSkipIntent definition
      const getSkipRegex = /const\s+getSkipIntent\s*=\s*useCallback/g;
      const match = getSkipRegex.exec(content);
      expect(match).toBeTruthy();

      if (match) {
        const startIndex = match.index;
        // Capture enough to include the isWolf assignment
        const block = content.substring(startIndex, startIndex + 600);

        // Must use doesRoleParticipateInWolfVote for wolf check (via effectiveActorRole)
        expect(block).toMatch(/doesRoleParticipateInWolfVote\(effectiveActorRole\)/);

        // Must NOT use isWolfRole for wolf check
        expect(block).not.toMatch(/isWolf\s*=\s*isWolfRole\(actorRole\)/);
      }
    });
  });

  describe('wolfRobot hunter gate with controlledSeat (debug takeover)', () => {
    /** The executor triggers an ack; useWerewolfGameActions owns controlledSeat routing. */
    it('wolfRobot executor does not pass an actor seat through the mutation', () => {
      const content = readFileContent(WOLF_ROBOT_EXECUTOR_PATH);

      expect(content).toMatch(/hunterStatusAckMutation/);
      expect(content).toMatch(/hunterStatusAckMutation\.mutate\(undefined/);
      expect(content).not.toMatch(/\.mutate\(effectiveSeat/);
      expect(content).not.toMatch(/\.mutate\(mySeat/);
    });

    /** The facade accepts only the explicit takeover discriminator. */
    it('WerewolfGameClient.sendWolfRobotHunterStatusViewed takes controlledSeat', () => {
      const content = readFileContent('src/games/werewolf/runtime/WerewolfGameClient.ts');

      const regex =
        /sendWolfRobotHunterStatusViewed\s*\(\s*controlledSeat\s*:\s*number\s*\|\s*null\s*\)/;
      expect(content).toMatch(regex);
    });
  });
});
