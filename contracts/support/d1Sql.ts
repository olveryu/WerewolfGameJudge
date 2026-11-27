/**
 * The one SQL lexer for the repository's contracts, and the D1 LIKE/GLOB pattern rule built on it.
 * Migration rules (`d1MigrationRules.contract.test.ts`) and the worker runtime SQL rule
 * (`architecture.contract.test.ts`) both read SQL through these functions.
 */

export interface SqlToken {
  readonly kind: 'space' | 'comment' | 'string' | 'quoted' | 'word' | 'other';
  readonly text: string;
}

/**
 * Every character of `sql`, in order, as SQLite lexes it: a `--` or `/* *\/` inside a string is
 * data, and a quoted identifier ("x", `x`, [x]) is never a keyword. The only SQL lexer in
 * the repository: migration rules and the worker runtime SQL rule both read SQL through it.
 */
const SQL_LEXEME =
  /(\s+)|(--[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|('(?:[^']|'')*'?)|("(?:[^"]|"")*"?|\x60(?:[^\x60]|\x60\x60)*\x60?|\[[^\]]*\]?)|([A-Za-z_][A-Za-z0-9_$]*)|([\s\S])/g;

export function sqlTokens(sql: string): SqlToken[] {
  return Array.from(sql.matchAll(SQL_LEXEME), (match): SqlToken => {
    const text = match[0];
    if (match[1] !== undefined) return { kind: 'space', text };
    if (match[2] !== undefined) return { kind: 'comment', text };
    if (match[3] !== undefined) return { kind: 'string', text };
    if (match[4] !== undefined) return { kind: 'quoted', text };
    if (match[5] !== undefined) return { kind: 'word', text };
    return { kind: 'other', text };
  });
}

export interface SqlStatement {
  /** Code tokens only: no whitespace or comments. */
  readonly tokens: readonly SqlToken[];
  /** The statement's source with each comment replaced by a space, without the `;`. */
  readonly text: string;
}

/** The statements of `sql`, split at each `;` outside strings, identifiers and comments. */
export function sqlStatements(sql: string): SqlStatement[] {
  const statements: SqlStatement[] = [];
  let tokens: SqlToken[] = [];
  let text = '';
  for (const token of sqlTokens(sql)) {
    if (token.text === ';') {
      statements.push({ tokens, text });
      tokens = [];
      text = '';
      continue;
    }
    text += token.kind === 'comment' ? ' ' : token.text;
    if (token.kind !== 'space' && token.kind !== 'comment') tokens.push(token);
  }
  statements.push({ tokens, text });
  return statements.filter((statement) => statement.tokens.length > 0);
}

/** A bare or quoted identifier token's name, lower-cased; any other token has none. */
export function identifierName(token: SqlToken | undefined): string | undefined {
  if (token?.kind === 'word') return token.text.toLowerCase();
  if (token?.kind === 'quoted') return token.text.slice(1, -1).toLowerCase();
  return undefined;
}

/**
 * D1 caps a LIKE or GLOB pattern at 50 bytes (Cloudflare D1 limits page); node:sqlite's default is
 * 50,000, so neither the contracts nor the generator's trial run can see it at run time. A pattern
 * built at run time cannot be measured here, so every pattern must be a literal.
 */
const D1_PATTERN_MAX_BYTES = 50;
const PATTERN_KEYWORDS = new Set(['GLOB', 'LIKE']);

/**
 * Judges the token after every unquoted GLOB/LIKE keyword: `glob(…)`, `like(…)` and `GLOB (…)`
 * hide their pattern, an operand other than one string literal is computed, and a literal must fit.
 */
export function patternProblems(sql: string): string[] {
  const tokens = sqlTokens(sql).filter(
    (token) => token.kind !== 'space' && token.kind !== 'comment',
  );
  const problems: string[] = [];
  tokens.forEach((token, index) => {
    if (token.kind !== 'word' || !PATTERN_KEYWORDS.has(token.text.toUpperCase())) return;
    const operand = tokens[index + 1];
    if (operand === undefined) {
      problems.push(`${token.text} has no pattern`);
      return;
    }
    if (operand.text === '(') {
      problems.push(`${token.text}(…) hides its pattern; write x ${token.text} '<literal>'`);
      return;
    }
    const concatenated = tokens[index + 2]?.text === '|' && tokens[index + 3]?.text === '|';
    if (operand.kind !== 'string' || concatenated) {
      problems.push(
        `${token.text} ${operand.text}${concatenated ? ' || …' : ''} is not a literal pattern`,
      );
      return;
    }
    const bytes = Buffer.byteLength(operand.text.slice(1, -1).replaceAll("''", "'"), 'utf8');
    if (bytes > D1_PATTERN_MAX_BYTES) {
      problems.push(`${token.text} pattern of ${bytes} bytes exceeds D1's ${D1_PATTERN_MAX_BYTES}`);
    }
  });
  return problems;
}
