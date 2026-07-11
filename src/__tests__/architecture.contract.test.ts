/**
 * architecture.contract — Layer boundary guard
 *
 * Enforces the project's unidirectional dependency rules:
 *   UI → shared room or game-owned runtime → platform protocols
 *   UI → Application → Infrastructure (services/infra, services/transport)
 *
 * Forbidden directions:
 *   - services/ → screens/  (infra must not know about UI)
 *   - game-engine → @/ or src/ client code  (domain is leaf)
 *   - screens/ → services/ with runtime (non-type) imports, except allowed enums
 */

import fs from 'node:fs';
import path from 'node:path';

// ─── Shared file walker ─────────────────────────────────────────────────────

function getAllProductionFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['__tests__', '__mocks__', 'node_modules'].includes(entry.name)) continue;
      results.push(...getAllProductionFiles(fullPath));
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('.spec.') &&
      !entry.name.includes('.stories.')
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Paths ──────────────────────────────────────────────────────────────────

const screensDir = path.join(process.cwd(), 'src', 'screens');
const sharedRoomDir = path.join(process.cwd(), 'src', 'features', 'room');
const gamesDir = path.join(process.cwd(), 'src', 'games');
const werewolfClientDir = path.join(gamesDir, 'werewolf');
const servicesDir = path.join(process.cwd(), 'src', 'services');
const srcDir = path.join(process.cwd(), 'src');
const gameEngineDir = path.join(process.cwd(), 'packages', 'game-engine', 'src');

const screensFiles = getAllProductionFiles(screensDir);
const sharedRoomFiles = getAllProductionFiles(sharedRoomDir);
const werewolfClientFiles = getAllProductionFiles(werewolfClientDir);
const servicesFiles = getAllProductionFiles(servicesDir);
const srcFiles = getAllProductionFiles(srcDir);
const gameEngineFiles = getAllProductionFiles(gameEngineDir);

// ─── Rule 1: services/ must NOT import UI ownership roots ───────────────────

describe('Layer boundary: services → UI (forbidden)', () => {
  it('should find services files to check', () => {
    expect(servicesFiles.length).toBeGreaterThan(0);
  });

  const uiImportPatterns = [
    /^\s*import\b.*from\s+['"].*screens\//m,
    /^\s*import\b.*from\s+['"]@\/games\//m,
  ];

  it.each(servicesFiles)('%s must not import screens/ or games/', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const pattern of uiImportPatterns) {
      expect(content.match(pattern)).toBeNull();
    }
  });
});

// ─── Rule 2: game-engine must NOT import client code ─────────────────────────

describe('Layer boundary: game-engine → client (forbidden)', () => {
  it('should find game-engine files to check', () => {
    expect(gameEngineFiles.length).toBeGreaterThan(0);
  });

  // game-engine must not import from @/ alias or ../../../src/ relative paths
  // Only match actual import statements (not comments)
  const clientImportPatterns = [
    /^\s*import\b.*from\s+['"]@\//m,
    /^\s*import\b.*from\s+['"]\.\.\/(.*)\/src\/(screens|services|hooks|components|contexts|utils|config|navigation)\//m,
  ];

  it.each(gameEngineFiles)('%s must not import client code', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const pattern of clientImportPatterns) {
      const match = content.match(pattern);
      expect(match).toBeNull();
    }
  });
});

describe('Layer boundary: shared room → game-specific code (forbidden)', () => {
  it('should find shared room files to check', () => {
    expect(sharedRoomFiles.length).toBeGreaterThan(0);
  });

  const forbiddenImports = [
    /^\s*import\b.*from\s+['"]@\/games\//m,
    /^\s*import\b.*from\s+['"]@\/screens\/RoomScreen\//m,
    /^\s*import\b.*from\s+['"]@werewolf\/game-engine['"]/m,
    /^\s*import\b.*from\s+['"]@werewolf\/game-engine\/(?!(?:platform|growth)\/)/m,
  ];

  it.each(sharedRoomFiles)('%s must not import a game implementation', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const pattern of forbiddenImports) {
      expect(content.match(pattern)).toBeNull();
    }
  });

  const forbiddenGameSemanticIdentifiers =
    /\b(?:ActionResult|GameState|GameStatus|LocalGameState|RoleId|GameStore|campStats|roleRevealEffect|playerRoleRevealEffect|wolfVoteBadge|wolfRing|NightProgressIndicator|currentRoleName)\b/;

  it.each(sharedRoomFiles)('%s must use game-neutral room contracts', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content.match(forbiddenGameSemanticIdentifiers)).toBeNull();
  });
});

describe('Layer boundary: game modules are isolated', () => {
  it('should find Werewolf client files to check', () => {
    expect(werewolfClientFiles.length).toBeGreaterThan(0);
  });

  it.each(werewolfClientFiles)('%s must not import another game module', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content.match(/^\s*import\b.*from\s+['"]@\/games\/(?!werewolf(?:\/|['"]))/m)).toBeNull();
  });
});

describe('Client ownership: removed generic Werewolf paths stay removed', () => {
  const removedPaths = [
    'src/screens/RoomScreen',
    'src/hooks/useGameRoom.ts',
    'src/hooks/useGameActions.ts',
    'src/hooks/useDebugMode.ts',
    'src/hooks/useBgmControl.ts',
    'src/hooks/useLastActionToast.ts',
    'src/hooks/useNightDerived.ts',
    'src/hooks/useRoomLifecycle.ts',
    'src/hooks/useConnectionStatus.ts',
    'src/hooks/useSettleToast.ts',
    'src/hooks/usePendingAcks.ts',
    'src/hooks/useAckMutation.ts',
    'src/hooks/adapters/toLocalState.ts',
    'src/services/registry.ts',
    'src/services/facade',
    'src/services/types/IGameFacade.ts',
    'src/contexts/GameFacadeContext.tsx',
    'src/services/cloudflare/CFRoomService.ts',
    'src/services/types/IRoomService.ts',
    'src/features/room/services/RoomCommandDispatcher.ts',
    'src/features/room/services/RoomSession.ts',
    'src/features/room/services/roomCommandClient.ts',
    'src/features/room/services/roomSeatCommands.ts',
    'src/features/room/controllers/useRoomLifecycle.ts',
    'src/features/room/controllers/useRoomSessionStatus.ts',
    'src/features/room/controllers/useRoomConnection.ts',
    'src/games/werewolf/hooks/useWerewolfRoomLifecycle.ts',
    'src/games/werewolf/room/components/AuthGateOverlay.tsx',
    'src/games/werewolf/room/components/WxAuthFailedOverlay.tsx',
  ];

  it.each(removedPaths)('%s must not exist', (relativePath) => {
    expect(fs.existsSync(path.join(process.cwd(), relativePath))).toBe(false);
  });
});

describe('Client ownership: RoomSession has one implementation', () => {
  it('defines exactly one RoomSession class in production client code', () => {
    const implementations = srcFiles.filter((filePath) =>
      /\bclass\s+RoomSession\b/.test(fs.readFileSync(filePath, 'utf-8')),
    );

    expect(implementations.map((filePath) => path.relative(process.cwd(), filePath))).toEqual([
      'src/features/room/session/RoomSession.ts',
    ]);
  });
});

// ─── Rule 3: screens/ runtime imports from services/ are restricted ──────────

describe('Layer boundary: screens → services runtime imports (restricted)', () => {
  it('should find screens files to check', () => {
    expect(screensFiles.length).toBeGreaterThan(0);
  });

  // Allowed runtime imports from services/ (enums that must be runtime values)
  const allowedRuntimeImports = [
    'isAIChatReady',
    'BGM_TRACKS',
    'BGM_VOLUME',
    'fetchUserStats',
    'fetchUserProfile',
    'fetchUserUnlocks',
    'uploadShareImage',
    'submitFeedback',
    'getFeedbackHistory',
    'getUnreadFeedbackCount',
    'markFeedbackRead',
    'replyToFeedback',
    'resolveFeedback',
  ];

  it.each(screensFiles)('%s runtime imports from services/ must be in allow-list', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      // Skip type-only imports
      if (/import\s+type\b/.test(line)) continue;
      // Skip non-import lines
      if (!/from\s+['"]@\/services\//.test(line)) continue;

      // Extract imported symbols
      const symbolMatch = line.match(/import\s+\{([^}]+)\}/);
      if (!symbolMatch) continue;

      const symbols = symbolMatch[1]!
        .split(',')
        .map((s: string) => s.trim().replace(/\s+as\s+\w+/, ''));
      const disallowed = symbols.filter(
        (s: string) => s.length > 0 && !s.startsWith('type ') && !allowedRuntimeImports.includes(s),
      );

      expect(disallowed).toEqual([]);
    }
  });
});
