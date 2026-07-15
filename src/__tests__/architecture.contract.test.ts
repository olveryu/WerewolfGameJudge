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
const homeScreenDir = path.join(screensDir, 'HomeScreen');
const productComponentsDir = path.join(process.cwd(), 'src', 'components');
const sharedRoomDir = path.join(process.cwd(), 'src', 'features', 'room');
const gamesDir = path.join(process.cwd(), 'src', 'games');
const werewolfClientDir = path.join(gamesDir, 'werewolf');
const servicesDir = path.join(process.cwd(), 'src', 'services');
const srcDir = path.join(process.cwd(), 'src');
const gameEngineDir = path.join(process.cwd(), 'packages', 'game-engine', 'src');

const screensFiles = getAllProductionFiles(screensDir);
const productComponentFiles = getAllProductionFiles(productComponentsDir);
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

describe('Layer boundary: product components → game-specific code (forbidden)', () => {
  it('should find product component files to check', () => {
    expect(productComponentFiles.length).toBeGreaterThan(0);
  });

  const forbiddenImports = [
    /^\s*import\b.*from\s+['"]@\/games\//m,
    /^\s*import\b.*from\s+['"]@werewolf\/game-engine['"]/m,
    /^\s*import\b.*from\s+['"]@werewolf\/game-engine\/(?!(?:platform|growth)\/)/m,
  ];

  it.each(productComponentFiles)('%s must not import a game implementation', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const pattern of forbiddenImports) {
      expect(content.match(pattern)).toBeNull();
    }
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
    'src/features/room/model/GameUiModule.ts',
    'src/games/model/GameProductUi.ts',
    'src/services/infra/audio/audioRegistry.ts',
    'src/utils/roleBadges.ts',
    'src/utils/roleBadges.web.ts',
    'src/games/werewolf/hooks/useWerewolfRoomLifecycle.ts',
    'src/games/werewolf/room/components/AuthGateOverlay.tsx',
    'src/games/werewolf/room/components/WxAuthFailedOverlay.tsx',
    'src/screens/BoardPickerScreen',
    'src/screens/ConfigScreen',
    'src/screens/EncyclopediaScreen',
    'src/screens/GameRulesScreen',
    'src/screens/NotepadScreen',
    'src/components/AIChatBubble',
    'src/components/BoardStrategy',
    'src/components/FactionChip.tsx',
    'src/components/FactionRoleList.tsx',
    'src/components/NotepadPanel.tsx',
    'src/components/RoleCardSimple.tsx',
    'src/components/RoleDescriptionView.tsx',
    'src/components/RoleRevealEffects',
    'src/components/SettingsSheet',
    'src/components/SkiaShaderWarmup.tsx',
    'src/components/roleDisplayUtils.ts',
    'src/hooks/useNotepad.ts',
    'src/services/feature/AIChatService.ts',
    'src/types/GameStateTypes.ts',
    'src/utils/aiChatBridge.ts',
    'src/screens/HomeScreen/components/RandomRoleCard.tsx',
  ];

  it.each(removedPaths)('%s must not exist', (relativePath) => {
    expect(fs.existsSync(path.join(process.cwd(), relativePath))).toBe(false);
  });
});

describe('Client ownership: Home and root navigation stay game-neutral', () => {
  const sharedHomeFiles = getAllProductionFiles(path.join(srcDir, 'features', 'home'));
  const sharedNavigationFiles = getAllProductionFiles(path.join(srcDir, 'features', 'navigation'));
  const genericHostFiles = [
    ...getAllProductionFiles(homeScreenDir),
    ...sharedHomeFiles,
    ...sharedNavigationFiles,
    path.join(srcDir, 'games', 'home.ts'),
    path.join(srcDir, 'games', 'model', 'ClientGameCatalog.ts'),
    path.join(srcDir, 'games', 'ClientGameCatalogContext.tsx'),
    path.join(srcDir, 'navigation', 'AppNavigator.tsx'),
    path.join(srcDir, 'navigation', 'GameHostRoutes.tsx'),
    path.join(srcDir, 'navigation', 'types.ts'),
  ];

  it.each(genericHostFiles)('%s must not import a concrete game implementation', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toMatch(/@\/games\/werewolf/);
    expect(content).not.toMatch(/@werewolf\/game-engine\/(?:games\/werewolf|models)\//);
  });

  it.each(genericHostFiles)('%s must not branch on a literal game type', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toMatch(/['"]werewolf['"]/);
  });

  it('keeps concrete config sub-routes out of the root stack', () => {
    const rootTypes = fs.readFileSync(path.join(srcDir, 'navigation', 'types.ts'), 'utf-8');
    const appNavigator = fs.readFileSync(
      path.join(srcDir, 'navigation', 'AppNavigator.tsx'),
      'utf-8',
    );
    const removedRootRoutes = ['BoardPicker', 'Config', 'GameRules', 'Encyclopedia', 'Notepad'];

    for (const routeName of removedRootRoutes) {
      expect(rootTypes).not.toMatch(new RegExp(`^\\s*${routeName}:`, 'm'));
      expect(appNavigator).not.toContain(`name="${routeName}"`);
    }
  });

  it('selects root game hosts from the catalog without a literal game type', () => {
    const gameHostRoutes = fs.readFileSync(
      path.join(srcDir, 'navigation', 'GameHostRoutes.tsx'),
      'utf-8',
    );
    expect(gameHostRoutes).not.toMatch(/['"]werewolf['"]/);
    expect(gameHostRoutes).not.toMatch(/['"]nominate['"]/);
    expect(gameHostRoutes).not.toMatch(/useClientGameModule\s*\(\s*['"]/);
  });

  it('loads the concrete client catalog only from the application composition root', () => {
    const consumers = srcFiles.filter((filePath) =>
      /^\s*import\b.*from\s+['"]@\/games\/catalog['"]/m.test(fs.readFileSync(filePath, 'utf-8')),
    );

    expect(consumers.map((filePath) => path.relative(process.cwd(), filePath))).toEqual([
      'src/app/createAppServices.ts',
    ]);
  });
});

describe('Test boundary: real navigation is opt-in', () => {
  it('does not load the full navigation module from the global Jest mock', () => {
    const jestSetup = fs.readFileSync(path.join(process.cwd(), 'jest.setup.ts'), 'utf-8');

    expect(jestSetup).not.toMatch(/jest\.requireActual[\s\S]{0,200}@react-navigation\/native/);
  });
});

describe('Client ownership: generic audio and avatar utilities stay game-neutral', () => {
  it('keeps Werewolf narration out of the platform AudioService', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'src', 'services', 'infra', 'AudioService.ts'),
      'utf-8',
    );

    expect(content).not.toMatch(/\bRoleId\b|playRole|playNight|preloadForRoles|AUDIO_REGISTRY/);
    expect(content).not.toMatch(/@werewolf\/game-engine\/(?:models|games\/werewolf)/);
  });

  it('keeps role projection out of the product avatar registry', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'src', 'utils', 'avatar.ts'), 'utf-8');

    expect(content).not.toMatch(/\bRoleId\b|\bgetRoleAvatar\b/);
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

  it('is instantiated only by the production game-session factory', () => {
    const constructors = srcFiles.filter((filePath) =>
      /\bnew\s+RoomSession\s*</.test(fs.readFileSync(filePath, 'utf-8')),
    );

    expect(constructors.map((filePath) => path.relative(process.cwd(), filePath))).toEqual([
      'src/app/CloudflareGameSessionFactory.ts',
    ]);
  });
});

describe('Client composition: one game-neutral catalog provider', () => {
  const compositionRootFiles = [
    path.join(process.cwd(), 'App.tsx'),
    path.join(srcDir, 'app'),
  ].flatMap((entry) => (fs.statSync(entry).isDirectory() ? getAllProductionFiles(entry) : [entry]));

  it.each(compositionRootFiles)('%s must not import a concrete game module', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(
      content.match(
        /^\s*import\b.*from\s+['"]@\/games\/(?!catalog|ClientGameCatalogContext|model\/)/m,
      ),
    ).toBeNull();
  });

  it('does not define a provider or React context inside a concrete game slice', () => {
    const concreteGameFiles = getAllProductionFiles(gamesDir).filter((filePath) => {
      const relativePath = path.relative(gamesDir, filePath);
      return relativePath.split(path.sep).length > 1;
    });
    const offenders = concreteGameFiles.filter((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      return /\bcreateContext\s*[<(]|\b[A-Z]\w*GameProvider\b/.test(content);
    });

    expect(offenders.map((filePath) => path.relative(process.cwd(), filePath))).toEqual([]);
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
    'getBgmTrack',
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
