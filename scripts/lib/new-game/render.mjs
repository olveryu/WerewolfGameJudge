/**
 * Placeholder rendering for the new-game generator.
 *
 * Templates are plain text files carrying `__GAME_*__` tokens and, for
 * files shared between capability packs, capability-conditional line
 * blocks marked with `//#cap <capabilityKey>` ... `//#end` lines: a
 * block's lines survive rendering only when the pack's capability
 * record enables that key. A negated marker `//#cap !<capabilityKey>`
 * keeps its lines only when the record does NOT enable the key, so a
 * pair of sibling blocks (positive + negated) expresses an either/or
 * whose two forms are both written out in the template. Rendering is
 * pure: same input, same output, no filesystem access.
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

const BLOCK_START = /^\/\/#cap (!?)([A-Za-z]+)\s*$/;
const BLOCK_END = /^\/\/#end\s*$/;

/** Strip capability-conditional blocks the active pack does not select. */
export function applyCapabilityBlocks(text, capabilities) {
  const lines = text.split('\n');
  const kept = [];
  let activeBlock = null;
  for (const line of lines) {
    const start = BLOCK_START.exec(line.trim());
    if (start !== null) {
      const marker = `${start[1]}${start[2]}`;
      if (activeBlock !== null) {
        throw new Error(`Nested capability block "${marker}" inside "${activeBlock.marker}".`);
      }
      if (!Object.hasOwn(capabilities, start[2])) {
        throw new Error(`Unknown capability block "${marker}".`);
      }
      activeBlock = { key: start[2], negated: start[1] === '!', marker };
      continue;
    }
    if (BLOCK_END.test(line.trim())) {
      if (activeBlock === null) throw new Error('Capability block end without a start marker.');
      activeBlock = null;
      continue;
    }
    if (
      activeBlock === null ||
      (activeBlock.negated
        ? capabilities[activeBlock.key] !== true
        : capabilities[activeBlock.key] === true)
    ) {
      kept.push(line);
    }
  }
  if (activeBlock !== null)
    throw new Error(`Unterminated capability block "${activeBlock.marker}".`);
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

/** Render one template file body for one capability pack. */
export function renderTemplateFile(text, { names, capabilities, extraTokens }) {
  return renderTemplate(applyCapabilityBlocks(text, capabilities), names, extraTokens);
}
