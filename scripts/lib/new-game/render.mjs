/**
 * Placeholder rendering for the new-game generator.
 *
 * Templates are plain text files carrying `__GAME_*__` tokens and, for
 * files shared between presets, preset-conditional line blocks marked
 * with `//#identity` / `//#stage` ... `//#end` lines. Rendering is pure:
 * same input, same output, no filesystem access.
 */

const GAME_ID_PATTERN = /^[a-z][a-z0-9]*$/;

/** Validate a game id against the canonical shape used by GAME_TYPES. */
export function assertValidGameId(gameId) {
  if (typeof gameId !== 'string' || !GAME_ID_PATTERN.test(gameId)) {
    throw new Error(
      `Invalid game id "${String(gameId)}": expected lowercase letters/digits starting with a letter (e.g. "demoproto").`,
    );
  }
}

/** Derive the naming forms every template needs from one game id. */
export function deriveGameNames(gameId) {
  assertValidGameId(gameId);
  const pascal = gameId.charAt(0).toUpperCase() + gameId.slice(1);
  return {
    gameId,
    pascal,
    camel: gameId,
    upper: gameId.toUpperCase(),
  };
}

const BLOCK_START = /^\/\/#(identity|stage)\s*$/;
const BLOCK_END = /^\/\/#end\s*$/;

/** Strip preset-conditional blocks that do not match the active preset. */
export function applyPresetBlocks(text, preset) {
  const lines = text.split('\n');
  const kept = [];
  let activeBlock = null;
  for (const line of lines) {
    const start = BLOCK_START.exec(line.trim());
    if (start !== null) {
      if (activeBlock !== null) {
        throw new Error(`Nested preset block "${start[1]}" inside "${activeBlock}".`);
      }
      activeBlock = start[1];
      continue;
    }
    if (BLOCK_END.test(line.trim())) {
      if (activeBlock === null) throw new Error('Preset block end without a start marker.');
      activeBlock = null;
      continue;
    }
    if (activeBlock === null || activeBlock === preset) kept.push(line);
  }
  if (activeBlock !== null) throw new Error(`Unterminated preset block "${activeBlock}".`);
  return kept.join('\n');
}

/** Replace every `__GAME_*__` token; fail if a token survives rendering. */
export function renderTemplate(text, names, extraTokens = {}) {
  const tokens = {
    __GAME_ID__: names.gameId,
    __GAME_PASCAL__: names.pascal,
    __GAME_CAMEL__: names.camel,
    __GAME_UPPER__: names.upper,
    ...extraTokens,
  };
  let rendered = text;
  for (const [token, value] of Object.entries(tokens)) {
    rendered = rendered.split(token).join(value);
  }
  const surviving = rendered.match(/__[A-Z][A-Z0-9_]*__/);
  if (surviving !== null) {
    throw new Error(`Template token ${surviving[0]} survived rendering.`);
  }
  return rendered;
}

/** Render one template file body for one preset. */
export function renderTemplateFile(text, { names, preset, extraTokens }) {
  return renderTemplate(applyPresetBlocks(text, preset), names, extraTokens);
}
