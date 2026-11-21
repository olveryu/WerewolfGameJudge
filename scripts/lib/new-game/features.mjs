export const FEATURE_VALUES = Object.freeze({
  identity: Object.freeze(['none', 'private']),
  night: Object.freeze(['none', 'narrated']),
  guidedNarration: Object.freeze(['none', 'narrated']),
  stageDeadline: Object.freeze(['none', 'enabled']),
  wordSupply: Object.freeze(['none', 'in-game', 'background', 'both']),
});

export const FEATURE_KEYS = Object.freeze(Object.keys(FEATURE_VALUES));

const ENGINE_TEST = 'packages/game-engine/src/games/__GAME_ID__/__tests__/engine.test.ts';
const GUIDANCE_TEST =
  'packages/web/src/games/__GAME_ID__/room/__tests__/__GAME_CAMEL__GuidanceMatrix.test.ts';
const AUDIO_ENGINE_TEST_CASES = Object.freeze([
  'lands a queued batch through the shared machine and clears it on host ack',
  'rejects ack from a non-host; stale and unknown batch ids never clear a later batch',
  'blocks restart while playback is running, then releases it after ack',
]);
const AUDIO_RUNTIME_TEST_CASES = Object.freeze([
  'does not play or acknowledge a pending narration batch for non-host viewers',
]);

export const BASE_TEST_REQUIREMENTS = Object.freeze([
  Object.freeze({
    template: ENGINE_TEST,
    testCases: Object.freeze([
      'resets to preparation only for the host and the intended game and phase',
      'returns an ended game to preparation without another settlement',
    ]),
  }),
  Object.freeze({
    template: 'packages/api-worker/src/games/__GAME_ID__/__tests__/schemas.test.ts',
    testCases: Object.freeze(['rejects stale restart command forms and invalid restart payloads']),
  }),
  Object.freeze({
    template: GUIDANCE_TEST,
    testCases: Object.freeze([
      'offers fill-bots only for an open lobby and runs each setup action through its capability',
      'marks the lobby host task as pending even when seats are missing',
      'submits in-game restart only after confirmation',
    ]),
  }),
]);

export const FEATURE_TEST_REQUIREMENTS = Object.freeze({
  identity: Object.freeze([
    Object.freeze({
      template:
        'packages/game-engine/src/games/__GAME_ID__/__tests__/identityViewingProtocol.contract.test.ts',
      testCases: Object.freeze([
        'can deal and begin with every seat filled by a bot; reward eligibility is separate',
        'still confirms an already-viewed seat after play began',
      ]),
    }),
    Object.freeze({
      template: ENGINE_TEST,
      testCases: Object.freeze([
        'holds begin until every seat — bots included — has viewed',
        'tracks terminal review for eligible users without blocking restart',
      ]),
    }),
    Object.freeze({
      template: GUIDANCE_TEST,
      testCases: Object.freeze([
        'enables begin only after every human and bot identity has been viewed',
        'marks start pending only after the host has viewed their own identity',
        'opens the actual role-viewing flow and confirms for the controlled bot seat',
        'is pending and opens the identity card for a seated player in viewing',
        'tracks the effective seat, including a bot controlled by the host',
        'hides identity in the lobby and from spectators, and locks it while submitting',
        'wires bulk viewing and removes its remedy after all bots are marked',
        'marks terminal review pending without blocking confirmed restart',
      ]),
    }),
  ]),
  night: Object.freeze([
    Object.freeze({ template: ENGINE_TEST, testCases: AUDIO_ENGINE_TEST_CASES }),
    Object.freeze({
      template:
        'packages/web/src/games/__GAME_ID__/audio/__tests__/__GAME_CAMEL__AudioRuntime.test.ts',
      testCases: AUDIO_RUNTIME_TEST_CASES,
    }),
  ]),
  guidedNarration: Object.freeze([
    Object.freeze({ template: ENGINE_TEST, testCases: AUDIO_ENGINE_TEST_CASES }),
    Object.freeze({
      template:
        'packages/web/src/games/__GAME_ID__/audio/__tests__/__GAME_CAMEL__AudioRuntime.test.ts',
      testCases: AUDIO_RUNTIME_TEST_CASES,
    }),
  ]),
  stageDeadline: Object.freeze([
    Object.freeze({
      template:
        'packages/game-engine/src/games/__GAME_ID__/__tests__/phaseDeadlineProtocol.contract.test.ts',
      testCases: Object.freeze([
        'rejects the host before the deadline',
        'rejects a non-host after the deadline',
        'rejects a host acting through a takeover seat',
        'settles the phase for the host after the deadline',
      ]),
    }),
    Object.freeze({
      template: ENGINE_TEST,
      testCases: Object.freeze([
        'opens the playing stage with an armed deadline and a settle.due effect',
        'rejects settle before the deadline, then settles exactly once at the deadline',
      ]),
    }),
  ]),
});

export const DERIVED_CAPABILITY_KEYS = Object.freeze([
  'nightPhase',
  'identityViewing',
  'botBulkViewing',
  'stageDeadline',
  'audioOrchestration',
  'wordLibrary',
]);

const ENGINE_CAPABILITY_KEYS = Object.freeze([
  'nightPhase',
  'botsAndTakeover',
  'identityViewing',
  'revealAnimation',
  'stageDeadline',
  'audioOrchestration',
  'wordLibrary',
  'gallery',
  'hostConfig',
  'botBulkViewing',
]);

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeFeatureProfile(profile) {
  if (!isRecord(profile)) {
    throw new Error('A complete game feature profile is required.');
  }

  const providedKeys = Object.keys(profile);
  const missingKeys = FEATURE_KEYS.filter((key) => !Object.hasOwn(profile, key));
  const unknownKeys = providedKeys.filter((key) => !Object.hasOwn(FEATURE_VALUES, key));
  if (missingKeys.length > 0 || unknownKeys.length > 0) {
    throw new Error(
      `Feature profile must declare exactly ${FEATURE_KEYS.join(', ')}; missing: ${missingKeys.join(', ') || 'none'}; unknown: ${unknownKeys.join(', ') || 'none'}.`,
    );
  }

  for (const key of FEATURE_KEYS) {
    if (!FEATURE_VALUES[key].includes(profile[key])) {
      throw new Error(
        `Invalid feature "${key}=${String(profile[key])}": expected one of ${FEATURE_VALUES[key].join(', ')}.`,
      );
    }
  }

  return Object.freeze(Object.fromEntries(FEATURE_KEYS.map((key) => [key, profile[key]])));
}

export function resolveFeatureTestRequirements(profile, { gameId, gameName }) {
  const features = normalizeFeatureProfile(profile);
  const requirements = [...BASE_TEST_REQUIREMENTS];
  for (const feature of FEATURE_KEYS) {
    if (features[feature] !== 'none') {
      requirements.push(...(FEATURE_TEST_REQUIREMENTS[feature] ?? []));
    }
  }
  return requirements.map(({ template, testCases }) =>
    Object.freeze({
      file: template.replaceAll('__GAME_ID__', gameId).replaceAll('__GAME_CAMEL__', gameName),
      testCases,
    }),
  );
}

export function parseFeatureDeclarations(declarations) {
  if (!Array.isArray(declarations)) {
    throw new Error('Feature declarations must be an array of key=value entries.');
  }

  const profile = {};
  for (const declaration of declarations) {
    if (typeof declaration !== 'string') {
      throw new Error(`Invalid feature declaration "${String(declaration)}".`);
    }
    const separator = declaration.indexOf('=');
    if (separator <= 0 || separator === declaration.length - 1) {
      throw new Error(`Invalid feature declaration "${declaration}": expected <feature>=<value>.`);
    }
    const key = declaration.slice(0, separator);
    const value = declaration.slice(separator + 1);
    if (!Object.hasOwn(FEATURE_VALUES, key)) {
      throw new Error(`Unknown feature "${key}": expected one of ${FEATURE_KEYS.join(', ')}.`);
    }
    if (Object.hasOwn(profile, key)) {
      throw new Error(`Feature "${key}" was declared more than once.`);
    }
    profile[key] = value;
  }

  return normalizeFeatureProfile(profile);
}

export function deriveCapabilities(profile) {
  const features = normalizeFeatureProfile(profile);
  const capabilities = Object.fromEntries(ENGINE_CAPABILITY_KEYS.map((key) => [key, false]));
  capabilities.botsAndTakeover = true;
  capabilities.hostConfig = true;
  capabilities.nightPhase = features.night === 'narrated';
  capabilities.identityViewing = features.identity === 'private';
  capabilities.botBulkViewing = features.identity === 'private';
  capabilities.revealAnimation = capabilities.identityViewing;
  capabilities.audioOrchestration =
    features.night === 'narrated' || features.guidedNarration === 'narrated';
  capabilities.stageDeadline = features.stageDeadline === 'enabled';
  capabilities.wordLibrary = features.wordSupply !== 'none';
  return Object.freeze(capabilities);
}

export function formatFeatureDeclarations(profile) {
  const features = normalizeFeatureProfile(profile);
  return FEATURE_KEYS.map((key) => ` --feature ${key}=${features[key]}`).join('');
}

export function formatFeatureSummary(profile) {
  const features = normalizeFeatureProfile(profile);
  return FEATURE_KEYS.map((key) => `${key}=${features[key]}`).join('、');
}

export function formatFeatureValue(value) {
  if (value === 'none') return '无';
  return value;
}
