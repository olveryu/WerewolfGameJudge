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
  const activeBlocks = [];
  for (const line of lines) {
    const start = BLOCK_START.exec(line.trim());
    if (start !== null) {
      const marker = `${start[1]}${start[2]}`;
      if (!Object.hasOwn(capabilities, start[2])) {
        throw new Error(`Unknown capability block "${marker}".`);
      }
      const selected =
        start[1] === '!' ? capabilities[start[2]] !== true : capabilities[start[2]] === true;
      activeBlocks.push({
        marker,
        selected: selected && activeBlocks.every((block) => block.selected),
      });
      continue;
    }
    if (BLOCK_END.test(line.trim())) {
      if (activeBlocks.length === 0)
        throw new Error('Capability block end without a start marker.');
      activeBlocks.pop();
      continue;
    }
    if (activeBlocks.length === 0 || activeBlocks.at(-1).selected) {
      kept.push(line);
    }
  }
  const activeBlock = activeBlocks.at(-1);
  if (activeBlock !== undefined)
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

/** Render one template file body for the selected capability set. */
export function renderTemplateFile(text, { names, capabilities, extraTokens }) {
  let rendered = renderTemplate(applyCapabilityBlocks(text, capabilities), names, extraTokens);
  const declaration = /(capabilities:\s*\{)([\s\S]*?)(\n\s*\})/.exec(rendered);
  if (declaration !== null) {
    const body = declaration[2].replace(
      /^(\s*)([A-Za-z]+): (true|false),$/gm,
      (line, indent, key) =>
        Object.hasOwn(capabilities, key) ? `${indent}${key}: ${capabilities[key]},` : line,
    );
    rendered = rendered.replace(declaration[0], `${declaration[1]}${body}${declaration[3]}`);
  }
  return rendered;
}
