/**
 * Anchored insertions into the shared registration files.
 *
 * Every edit is a pure function from file content to file content. Each
 * one fails loudly when its anchor is missing or ambiguous, so a future
 * refactor of a shared file breaks the generator instead of silently
 * producing a half-registered game. The generator verifies every edit
 * before writing anything.
 */

function fail(file, detail) {
  throw new Error(`new-game edit failed for ${file}: ${detail}`);
}

/**
 * Insert single-line import statements into a file's import region at
 * the position simple-import-sort would put them: among the existing
 * statements whose module specifier matches `specifierPattern`, ordered
 * by specifier. Existing statements may span several lines.
 */
function insertImportsSorted(file, content, candidateLines, specifierPattern) {
  const lines = content.split('\n');
  const statements = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^import /.test(lines[index])) continue;
    let end = index;
    while (!lines[end].endsWith(';')) end += 1;
    const text = lines.slice(index, end + 1).join('\n');
    const specifier = /from '([^']+)'/.exec(text)?.[1] ?? '';
    statements.push({ start: index, end, specifier });
    index = end;
  }
  const considered = statements.filter((statement) => specifierPattern.test(statement.specifier));
  if (considered.length === 0) fail(file, 'no matching import statements to sort against.');
  let result = lines;
  for (const candidate of candidateLines) {
    const specifier = /from '([^']+)'/.exec(candidate)?.[1] ?? '';
    const before = considered.find((statement) => statement.specifier > specifier);
    const insertAt =
      before !== undefined ? before.start : considered[considered.length - 1].end + 1;
    result = [...result.slice(0, insertAt), candidate, ...result.slice(insertAt)];
    for (const statement of considered) {
      if (statement.start >= insertAt) {
        statement.start += 1;
        statement.end += 1;
      }
    }
    considered.push({ start: insertAt, end: insertAt, specifier });
    considered.sort((a, b) => a.start - b.start);
  }
  return result.join('\n');
}

function replaceOnce(file, content, pattern, replacement) {
  const matches = content.match(
    new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`),
  );
  if (matches === null || matches.length !== 1) {
    fail(
      file,
      `anchor ${pattern} matched ${matches === null ? 0 : matches.length} times, expected exactly 1.`,
    );
  }
  return content.replace(pattern, replacement);
}

/** Append the game id to the canonical GAME_TYPES list (order is welded to the registry). */
export function editGameTypes(content, { gameId }) {
  const file = 'gameTypes.ts';
  if (content.includes(`'${gameId}'`)) fail(file, `'${gameId}' is already registered.`);
  return replaceOnce(
    file,
    content,
    /(export const GAME_TYPES = \[[\s\S]*?)(\] as const;)/,
    (_match, head, tail) => `${head}  '${gameId}',\n${tail}`,
  );
}

/** Append the registration metadata entry (flat rewards, in production, no workflows/routes yet). */
export function editRegistry(content, { gameId, rewards }) {
  const file = 'games/registry.ts';
  if (content.includes(`gameType: '${gameId}'`)) fail(file, `'${gameId}' is already registered.`);
  const entry = [
    `  ${gameId}: {`,
    `    gameType: '${gameId}',`,
    `    enginePublicExport: './games/${gameId}/public',`,
    `    clientModulePath: 'src/games/${gameId}/module.ts',`,
    `    isProduction: true,`,
    `    // TODO(new-game): confirm the completion reward amounts for ${gameId}.`,
    `    rewards: { policy: 'flat', xpEarned: ${rewards.xpEarned}, normalDrawsEarned: ${rewards.normalDrawsEarned}, dailyCompletionTarget: ${rewards.dailyCompletionTarget} },`,
    `    workerWorkflows: [],`,
    `    httpRoutes: [],`,
    `  },`,
    '',
  ].join('\n');
  return replaceOnce(
    file,
    content,
    /(\n\} as const satisfies \{ readonly \[TGameType in GameType\]: GameRegistration<TGameType> \};)/,
    (_match, tail) => `\n${entry}${tail.trimStart()}`,
  );
}

/** Add the flat completion-reward parameter row welded to the registry entry. */
export function editCompletionRewards(content, { gameId, rewards }) {
  const file = 'product/rewards/earnings.ts';
  if (new RegExp(`^  ${gameId}:`, 'm').test(content))
    fail(file, `'${gameId}' already has a reward row.`);
  return replaceOnce(
    file,
    content,
    /(export const GAME_COMPLETION_REWARDS = \{[\s\S]*?)(\n\} as const;)/,
    (_match, head, tail) =>
      `${head}\n  // TODO(new-game): confirm the completion reward amounts for ${gameId}.\n  ${gameId}: { xpEarned: ${rewards.xpEarned}, normalDrawsEarned: ${rewards.normalDrawsEarned}, dailyCompletionTarget: ${rewards.dailyCompletionTarget} },${tail}`,
  );
}

/** Add the `./games/<id>/public` subpath export to the engine package.json. */
export function editEnginePackageJson(content, { gameId }) {
  const file = 'game-engine/package.json';
  if (content.includes(`"./games/${gameId}/public"`))
    fail(file, `export for '${gameId}' already exists.`);
  const blockPattern = /\n( +)"\.\/games\/[a-z0-9]+\/public": \{\n(?:.*\n)*?\1\},/g;
  const matches = [...content.matchAll(blockPattern)];
  if (matches.length === 0) fail(file, 'no existing ./games/*/public export block found.');
  const last = matches[matches.length - 1];
  const indent = last[1];
  const block = [
    '',
    `${indent}"./games/${gameId}/public": {`,
    `${indent}  "types": "./src/games/${gameId}/public.ts",`,
    `${indent}  "default": "./dist/games/${gameId}/public.js"`,
    `${indent}},`,
  ].join('\n');
  const insertAt = last.index + last[0].length;
  return `${content.slice(0, insertAt)}${block}${content.slice(insertAt)}`;
}

/** Insert the export path into EXPECTED_PACKAGE_EXPORTS after the last game public export. */
export function editExpectedPackageExports(content, { gameId }) {
  const file = 'platform/__tests__/architecture.contract.test.ts';
  const entry = `'./games/${gameId}/public'`;
  if (content.includes(entry)) fail(file, `${entry} is already expected.`);
  const linePattern = /\n( +)'\.\/games\/[a-z0-9]+\/public',/g;
  const matches = [...content.matchAll(linePattern)];
  if (matches.length === 0) fail(file, 'no existing game public export line found.');
  const last = matches[matches.length - 1];
  const insertAt = last.index + last[0].length;
  return `${content.slice(0, insertAt)}\n${last[1]}${entry},${content.slice(insertAt)}`;
}

/** Insert the game directory into the skeleton contract's sorted catalog list. */
export function editEngineSkeletonContract(content, { gameId }) {
  const file = 'platform/__tests__/engineSkeleton.contract.test.ts';
  const blockPattern = /(expect\(gameTypes\)\.toEqual\(\[)([\s\S]*?)(\]\);)/g;
  const blocks = [...content.matchAll(blockPattern)];
  if (blocks.length !== 1)
    fail(file, `gameTypes expectation block matched ${blocks.length} times, expected exactly 1.`);
  const block = blocks[0];
  if (block[2].includes(`'${gameId}'`)) fail(file, `'${gameId}' is already listed.`);
  const lines = block[2].split('\n').filter((line) => line.trim().length > 0);
  for (const line of lines) {
    if (!/^\s*'[a-z0-9]+',$/.test(line))
      fail(file, `unexpected line inside the gameTypes expectation block: ${line.trim()}`);
  }
  lines.push(`      '${gameId}',`);
  lines.sort((a, b) => a.trim().localeCompare(b.trim()));
  return content.replace(
    /(expect\(gameTypes\)\.toEqual\(\[)([\s\S]*?)(\]\);)/,
    (_m, head, _body, tail) => `${head}\n${lines.join('\n')}\n    ${tail}`,
  );
}

/** Append the verified capability row for the new game to EXPECTED_CAPABILITIES. */
export function editExpectedCapabilities(content, { gameId, capabilities }) {
  const file = 'platform/engine/__tests__/capabilities.contract.test.ts';
  if (new RegExp(`^  ${gameId}: \\{`, 'm').test(content))
    fail(file, `'${gameId}' already has a capability row.`);
  const keys = [
    'nightPhase',
    'botsAndTakeover',
    'identityViewing',
    'revealAnimation',
    'stageDeadline',
    'audioOrchestration',
    'wordLibrary',
    'gallery',
    'hostConfig',
    'botTestScaffold',
  ];
  const row = [
    `  ${gameId}: {`,
    ...keys.map((key) => `    ${key}: ${capabilities[key]},`),
    `  },`,
    '',
  ].join('\n');
  const tablePattern =
    /(const EXPECTED_CAPABILITIES: Readonly<Record<GameType, GameEngineCapabilities>> = \{[\s\S]*?)(\n\};)/;
  return replaceOnce(
    file,
    content,
    tablePattern,
    (_m, head, tail) => `${head}\n${row}${tail.trimStart()}`,
  );
}

/**
 * Extend the platform engine contracts test: its hand-written catalog
 * literals are exhaustive over GameType, so the new engine joins the
 * import block (path-sorted) and every complete literal (after the
 * avalon entry). The intentionally incomplete negative-case literal
 * keeps lacking keys — its @ts-expect-error semantics are unchanged.
 */
export function editEngineContractsTest(content, { gameId, camel }) {
  const file = 'platform/engine/__tests__/contracts.test.ts';
  if (content.includes(`games/${gameId}/engine'`)) fail(file, `'${gameId}' is already covered.`);
  const importLine = `import { ${camel}Engine } from '../../../games/${gameId}/engine';`;
  const blockPattern =
    /(?:^import \{ \w+Engine \} from '\.\.\/\.\.\/\.\.\/games\/[a-z0-9]+\/engine';\n)+/m;
  const block = blockPattern.exec(content);
  if (block === null) fail(file, 'no game engine import block found.');
  const lines = block[0].trimEnd().split('\n');
  lines.push(importLine);
  // Sort by module specifier, not by line text: several shipped engines
  // bind names that differ from their paths (drawGuessEngine lives at
  // ./drawguess, fibEngine at ./fibking), and simple-import-sort orders
  // by specifier.
  const specifierOf = (line) => /from '([^']+)'/.exec(line)?.[1] ?? line;
  lines.sort((a, b) => specifierOf(a).localeCompare(specifierOf(b)));
  const withImport = content.replace(blockPattern, `${lines.join('\n')}\n`);
  const entryPattern = /^(\s*)avalon: avalonEngine,$/gm;
  const entries = [...withImport.matchAll(entryPattern)];
  if (entries.length < 4)
    fail(file, `expected at least 4 complete catalog literals, found ${entries.length}.`);
  return withImport.replace(
    entryPattern,
    (match, indent) => `${match}\n${indent}${gameId}: ${camel}Engine,`,
  );
}

/** Register the engine in the exhaustive engine catalog (key order is welded to the registry). */
export function editEngineCatalog(content, { gameId, camel, pascal }) {
  const file = 'games/catalog.ts';
  if (content.includes(`'./${gameId}/engine'`))
    fail(file, `'${gameId}' is already in the engine catalog.`);
  const withImport = insertImportsSorted(
    file,
    content,
    [`import { ${camel}Engine } from './${gameId}/engine';`],
    /^\.\/[a-z0-9]+\/engine$/,
  );
  return replaceOnce(
    file,
    withImport,
    /(export const GAME_ENGINE_CATALOG = defineGameEngineCatalog\(\{[\s\S]*?)(\}\);)/,
    (_m, head, tail) => `${head}  ${gameId}: ${camel}Engine,\n${tail}`,
  );
}

/** Register the Worker module in the exhaustive Worker catalog. */
export function editWorkerCatalog(content, { gameId, camel }) {
  const file = 'api-worker games/catalog.ts';
  if (content.includes(`'./${gameId}/module'`))
    fail(file, `'${gameId}' is already in the worker catalog.`);
  const withImport = insertImportsSorted(
    file,
    content,
    [`import { ${camel}WorkerModule } from './${gameId}/module';`],
    /^\.\/[a-z0-9]+\/module$/,
  );
  return replaceOnce(
    file,
    withImport,
    /(export const WORKER_GAME_CATALOG = defineWorkerGameCatalog\(GAME_ENGINE_CATALOG, \{[\s\S]*?)(\}\);)/,
    (_m, head, tail) =>
      `${head}  ${gameId}: registerWorkerGameModule(${camel}WorkerModule),\n${tail}`,
  );
}

/** Register the client plugin in the client catalog (plugin entry + catalog factory entry). */
export function editClientCatalog(content, { gameId, camel, pascal }) {
  const file = 'src/games/catalog.ts';
  if (content.includes(`'@/games/${gameId}/module'`))
    fail(file, `'${gameId}' is already in the client catalog.`);
  const withImports = insertImportsSorted(
    file,
    content,
    [
      `import { create${pascal}UiModule } from '@/games/${gameId}/module';`,
      `import { ${camel}GameNavigation } from '@/games/${gameId}/navigation/${camel}GameNavigation';`,
    ],
    /^@\/games\//,
  );
  const withPlugin = replaceOnce(
    file,
    withImports,
    /(\} satisfies ClientGamePluginCatalogShape;)/,
    (match) =>
      `  ${gameId}: {\n    gameType: '${gameId}',\n    navigation: ${camel}GameNavigation,\n    createModule: ({ sessionFactory }) => create${pascal}UiModule({ sessionFactory }),\n  },\n${match}`,
  );
  return replaceOnce(
    file,
    withPlugin,
    /(    \w+: registerClientGameModule\(CLIENT_GAME_PLUGIN_CATALOG\.\w+\.createModule\(dependencies\)\),\n)(?![\s\S]*registerClientGameModule\(CLIENT_GAME_PLUGIN_CATALOG)/,
    (match) =>
      `${match}    ${gameId}: registerClientGameModule(CLIENT_GAME_PLUGIN_CATALOG.${gameId}.createModule(dependencies)),\n`,
  );
}

/**
 * Register the client's dispatch funnel in the bot dispatch discipline
 * contract (#149): DISPATCH_SITES is exhaustive over GameType and the
 * generated room-state hook follows the parameterized-submit form
 * (control defaults to null; seat actions pass the seat explicitly).
 */
export function editDispatchDiscipline(content, { gameId, pascal }) {
  const file = 'botDispatchDiscipline.contract.test.ts';
  if (content.includes(`games/${gameId}/room/hooks/`))
    fail(file, `'${gameId}' is already registered.`);
  const entry =
    `  ${gameId}: [\n` +
    `    { file: 'games/${gameId}/room/hooks/use${pascal}RoomState.ts', form: 'parameterized-submit' },\n` +
    `  ],\n`;
  // Anchor on the record close alone: the previous entry's closing shape is
  // not stable across generations (the formatting pass collapses a short
  // generated entry onto one line), so keying on it would make the second
  // generation into the same repository fail to find its anchor.
  return replaceOnce(
    file,
    content,
    /(\n)(\};\n\nfunction expectParameterizedSubmit)/,
    (match, newline, head) => `${newline}${entry}${head}`,
  );
}

/** Append the test-fixture entry for the new game to the test client catalog. */
export function editTestClientCatalog(content, { gameId, camel, home }) {
  const file = 'src/test-utils/clientGameCatalog.tsx';
  if (content.includes(`gameType: '${gameId}'`))
    fail(file, `'${gameId}' already has a test catalog entry.`);
  const entry = [
    `    ${gameId}: {`,
    `      gameType: '${gameId}',`,
    `      home: {`,
    `        mode: {`,
    `          displayName: '${home.displayName}',`,
    `          subtitle: '${home.subtitle}',`,
    `          iconName: '${home.iconName}',`,
    `          tier: '${home.tier}',`,
    `        },`,
    `        spotlight: null,`,
    `        announcementTabs: [],`,
    `      },`,
    `      navigation: bindGameNavigation(CLIENT_GAME_PLUGIN_CATALOG.${gameId}.navigation, {`,
    `        config: EmptyScreen,`,
    `        guide: EmptyScreen,`,
    `      }),`,
    `      roomScreen: EmptyRoomScreen,`,
    `      roomAccount: createIdleRoomAccount('${gameId}'),`,
    `      productUi: {`,
    `        getAvatarDisplayName: () => null,`,
    `        getRevealEffectPresentation: () => null,`,
    `      },`,
    `      audioPreview: null,`,
    `      accountStatsSection: EmptyAccountStatsSection,`,
    `      appOverlay: null,`,
    `    },`,
    '',
  ].join('\n');
  return replaceOnce(file, content, /(\n  \};\n\}\s*)$/, (match) => `\n${entry}  };\n}\n`);
}
