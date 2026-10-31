#!/usr/bin/env node
/**
 * validate-agent-files.mjs — VALIDATE-ONLY checker for the generic
 * agent-file set. It never generates files and never edits anything.
 *
 * It checks, by walking the filesystem (node:fs only; no shell-out, no
 * network, no git):
 *   (a) budgets: root AGENTS.md <= 150 lines and <= 32768 bytes;
 *       each nested AGENTS.md <= 100 lines; each SKILL.md <= 500 lines
 *       and body < 5000 tokens (see estimateTokens); description
 *       <= 1024 characters;
 *   (b) skill frontmatter: YAML at byte 0, only the six allowed keys,
 *       name == folder name, name charset/length, description non-empty;
 *       nested files are plain markdown — frontmatter is NOT required
 *       on AGENTS.md files;
 *   (c) forbidden tool-specific files/directories are absent;
 *   (d) dead-reference scan (warnings only): in markdown files only,
 *       substrings matching one of three forms are checked for
 *       existence and reported as WARNINGS only (never failures):
 *       (i) paths rooted at src/, packages/, scripts/, e2e/, docs/,
 *       or agents/; (ii) paths rooted at .agents/; (iii)
 *       references/... paths, resolved against the mentioning
 *       file's skill root (the nearest ancestor directory holding
 *       a SKILL.md, or, under .agents/skills/, the skill directory
 *       itself) and checked only when such a skill root exists.
 *       Because the match is a substring, a longer mention
 *       containing a form as a suffix is checked as the matched
 *       suffix only. The patterns match only path characters, so
 *       mentions with placeholders (<...>), braces ({...}), or
 *       globs (*) never yield a candidate; a matched candidate
 *       containing a '..' segment is skipped. Also skipped: bare
 *       filenames with no directory; a rooted-path match preceded
 *       by '.' (the tail of a dotted path); a .agents/ match
 *       preceded by a word character, '.', '/', or '-'; and a
 *       references/... match preceded by a word character, '.',
 *       '/', or '-'. Any other path form is never matched, hence
 *       never checked, including references/... mentions in files
 *       with no skill root.
 *   (e) duplicate-heading report: identical top-level headings across
 *       files are reported, never failed.
 *
 * Exit code is 0 only when (a), (b), and (c) all pass. Warnings and
 * the duplicate-heading report do not change the exit code.
 *
 * Usage: node validate-agent-files.mjs [root]
 *   root defaults to the current working directory.
 *
 * The pure functions are exported for scripts/validate-agent-files.test.mjs.
 * This file follows the pattern of scripts/e2e-failure-digest.mjs:
 * exported pure functions, node:test coverage, explicit caps.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_AGENTS_MAX_LINES = 150;
export const ROOT_AGENTS_MAX_BYTES = 32768;
export const NESTED_AGENTS_MAX_LINES = 100;
export const SKILL_MAX_LINES = 500;
export const SKILL_BODY_MAX_TOKENS = 5000;
export const DESCRIPTION_MAX_CHARS = 1024;
export const SKILL_NAME_MAX_CHARS = 64;

export const ALLOWED_FRONTMATTER_KEYS = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
]);

export const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const IGNORED_DIR_NAMES = new Set(['node_modules', '.git', 'worktrees']);

const FORBIDDEN_BASENAMES = new Set(['CLAUDE.md', 'GEMINI.md', 'MUSE.md']);
const FORBIDDEN_DIR_PREFIXES = [
  '.claude/',
  '.cursor/rules/',
  '.github/instructions/',
  'agents/path-rules/',
];
const FORBIDDEN_FILES = new Set(['scripts/sync-agent-config.mjs']);

/**
 * Deterministic token estimate. The estimator
 * is deliberately conservative (it over-counts rather than under-counts):
 *  - each CJK / kana character counts as 1 token;
 *  - each run of letters, digits, or underscores counts as 1 token;
 *  - each remaining non-whitespace character counts as 1 token;
 *  - whitespace counts as 0.
 * The estimate is a budget guard, not a model tokenizer. The same
 * function is used by the tests.
 */
export function estimateTokens(text) {
  if (!text) return 0;
  const matches = text.match(
    /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu,
  );
  return matches === null ? 0 : matches.length;
}

/** wc -l equivalent: number of newline-terminated lines. */
export function countLines(text) {
  if (text === '') return 0;
  const lines = text.split('\n');
  return text.endsWith('\n') ? lines.length - 1 : lines.length;
}

export function countBytes(text) {
  return Buffer.byteLength(text, 'utf8');
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Parse YAML frontmatter at byte 0. Only flat `key: scalar` lines are
 * supported, which is the only shape the generic skills use. Returns
 * { ok, data, body, error }. `body` is the text after the closing
 * fence (or the whole text when parsing fails, so budget checks still
 * have something deterministic to measure).
 */
export function parseFrontmatter(text) {
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) {
    return {
      ok: false,
      data: null,
      body: text,
      error: 'frontmatter must start at byte 0 with ---',
    };
  }
  const lines = text.split('\n');
  let closeIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trimEnd() === '---') {
      closeIndex = i;
      break;
    }
  }
  if (closeIndex === -1) {
    return { ok: false, data: null, body: text, error: 'frontmatter has no closing ---' };
  }
  const data = {};
  for (let i = 1; i < closeIndex; i += 1) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const match = /^([A-Za-z][A-Za-z0-9_-]*):[ \t]*(.*)$/.exec(line);
    if (match === null) {
      return {
        ok: false,
        data: null,
        body: text,
        error: `frontmatter line ${i + 1} is not a flat key: value pair`,
      };
    }
    const key = match[1];
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      return { ok: false, data: null, body: text, error: `duplicate frontmatter key: ${key}` };
    }
    data[key] = stripQuotes(match[2].trim());
  }
  const body = lines.slice(closeIndex + 1).join('\n');
  return { ok: true, data, body, error: null };
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

/**
 * Walk `root`, returning { files, dirs } with POSIX relative paths.
 * Skips node_modules, .git, and worktrees directories at any depth.
 * Symlinks are not followed (statSync on a symlink entry is not
 * descended into; entries are classified by readdir file types).
 */
export function walkTree(root) {
  const files = [];
  const dirs = [];
  const visit = (dir, rel) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_DIR_NAMES.has(entry.name)) continue;
        const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`;
        dirs.push(childRel);
        visit(path.join(dir, entry.name), childRel);
      } else if (entry.isFile()) {
        const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`;
        files.push(childRel);
      }
    }
  };
  visit(root, '');
  return { files, dirs };
}

function readText(root, rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

function isMarkdown(rel) {
  return rel.endsWith('.md');
}

function checkBudgets(root, files, failures) {
  const counts = { agents: 0, skills: 0 };
  for (const rel of files) {
    const base = path.posix.basename(rel);
    if (base !== 'AGENTS.md' && base !== 'SKILL.md') continue;
    const text = readText(root, rel);
    const lines = countLines(text);
    if (base === 'AGENTS.md') {
      counts.agents += 1;
      if (rel === 'AGENTS.md') {
        if (lines > ROOT_AGENTS_MAX_LINES) {
          failures.push({
            check: 'budget',
            file: rel,
            message: `root AGENTS.md has ${lines} lines, max ${ROOT_AGENTS_MAX_LINES}`,
          });
        }
        const bytes = countBytes(text);
        if (bytes > ROOT_AGENTS_MAX_BYTES) {
          failures.push({
            check: 'budget',
            file: rel,
            message: `root AGENTS.md has ${bytes} bytes, max ${ROOT_AGENTS_MAX_BYTES}`,
          });
        }
      } else if (lines > NESTED_AGENTS_MAX_LINES) {
        failures.push({
          check: 'budget',
          file: rel,
          message: `nested AGENTS.md has ${lines} lines, max ${NESTED_AGENTS_MAX_LINES}`,
        });
      }
    } else {
      counts.skills += 1;
      if (lines > SKILL_MAX_LINES) {
        failures.push({
          check: 'budget',
          file: rel,
          message: `SKILL.md has ${lines} lines, max ${SKILL_MAX_LINES}`,
        });
      }
      const parsed = parseFrontmatter(text);
      const body = parsed.ok ? parsed.body : text;
      const tokens = estimateTokens(body);
      if (tokens >= SKILL_BODY_MAX_TOKENS) {
        failures.push({
          check: 'budget',
          file: rel,
          message: `SKILL.md body has an estimated ${tokens} tokens, must be under ${SKILL_BODY_MAX_TOKENS}`,
        });
      }
    }
  }
  return counts;
}

function checkSkillFrontmatter(root, files, failures) {
  for (const rel of files) {
    if (path.posix.basename(rel) !== 'SKILL.md') continue;
    const text = readText(root, rel);
    const parsed = parseFrontmatter(text);
    if (!parsed.ok) {
      failures.push({ check: 'frontmatter', file: rel, message: parsed.error });
      continue;
    }
    const { data } = parsed;
    for (const key of Object.keys(data)) {
      if (!ALLOWED_FRONTMATTER_KEYS.has(key)) {
        failures.push({
          check: 'frontmatter',
          file: rel,
          message: `disallowed frontmatter key: ${key} (allowed: ${[...ALLOWED_FRONTMATTER_KEYS].join(', ')})`,
        });
      }
    }
    const folder = path.posix.basename(path.posix.dirname(rel));
    if (typeof data.name !== 'string' || data.name === '') {
      failures.push({
        check: 'frontmatter',
        file: rel,
        message: 'frontmatter name is required and non-empty',
      });
    } else {
      if (data.name !== folder) {
        failures.push({
          check: 'frontmatter',
          file: rel,
          message: `frontmatter name "${data.name}" does not equal folder name "${folder}"`,
        });
      }
      if (!SKILL_NAME_PATTERN.test(data.name)) {
        failures.push({
          check: 'frontmatter',
          file: rel,
          message: `frontmatter name "${data.name}" does not match ${SKILL_NAME_PATTERN}`,
        });
      }
      if (data.name.length > SKILL_NAME_MAX_CHARS) {
        failures.push({
          check: 'frontmatter',
          file: rel,
          message: `frontmatter name is ${data.name.length} chars, max ${SKILL_NAME_MAX_CHARS}`,
        });
      }
    }
    if (typeof data.description !== 'string' || data.description === '') {
      failures.push({
        check: 'frontmatter',
        file: rel,
        message: 'frontmatter description is required and non-empty',
      });
    } else if (data.description.length > DESCRIPTION_MAX_CHARS) {
      failures.push({
        check: 'frontmatter',
        file: rel,
        message: `frontmatter description is ${data.description.length} chars, max ${DESCRIPTION_MAX_CHARS}`,
      });
    }
  }
}

function checkForbiddenFiles(files, dirs, failures) {
  for (const rel of files) {
    const base = path.posix.basename(rel);
    if (FORBIDDEN_BASENAMES.has(base)) {
      failures.push({
        check: 'forbidden',
        file: rel,
        message: `forbidden tool-specific file present: ${base}`,
      });
    }
    if (FORBIDDEN_FILES.has(rel)) {
      failures.push({
        check: 'forbidden',
        file: rel,
        message: `forbidden tool-specific file present: ${rel}`,
      });
    }
    for (const prefix of FORBIDDEN_DIR_PREFIXES) {
      if (rel.startsWith(prefix)) {
        failures.push({
          check: 'forbidden',
          file: rel,
          message: `file inside forbidden tool-specific directory: ${prefix}`,
        });
        break;
      }
    }
  }
  for (const dir of dirs) {
    for (const prefix of FORBIDDEN_DIR_PREFIXES) {
      if (dir === prefix.slice(0, -1) || dir.startsWith(prefix)) {
        failures.push({
          check: 'forbidden',
          file: dir,
          message: `forbidden tool-specific directory present: ${prefix}`,
        });
        break;
      }
    }
  }
}

// Path-like patterns for the dead-reference scan (warnings only).
// PATH_LIKE_PATTERN matches substrings rooted at a known top-level
// directory, containing only path characters, and ending in a path
// segment. DOT_AGENTS_PATTERN matches substrings rooted at .agents/.
// SKILL_RELATIVE_PATTERN matches bare references/... mentions, which
// extractPathCandidates resolves against the mentioning file's skill
// root (passed as skillRoot) and ignores when no skill root is given.
// Placeholders (<...>), braces ({...}), and globs (*) contain
// characters outside the patterns, so they never match; candidates
// with a '..' segment, bare filenames, and the guarded suffix forms
// described in extractPathCandidates are skipped. See the script
// header for the exact scan scope.
const PATH_LIKE_PATTERN =
  /\b(?:src|packages|scripts|e2e|docs|agents)\/[A-Za-z0-9_.\/-]*[A-Za-z0-9_]/g;
const DOT_AGENTS_PATTERN = /\.agents\/[A-Za-z0-9_.\/-]*[A-Za-z0-9_]/g;
const SKILL_RELATIVE_PATTERN = /\breferences\/[A-Za-z0-9_.\/-]*[A-Za-z0-9_]/g;

function cleanCandidate(raw) {
  let candidate = raw.replace(/[.,;:!?)"'\]]+$/, '');
  candidate = candidate.replace(/\/+$/, '');
  if (candidate === '') return null;
  if (candidate.includes('<') || candidate.includes('{') || candidate.includes('*')) return null;
  if (candidate.split('/').includes('..')) return null;
  return candidate;
}

export function extractPathCandidates(line, skillRoot = null) {
  const candidates = [];
  for (const match of line.matchAll(PATH_LIKE_PATTERN)) {
    // A match immediately preceded by '.' is the tail of a hidden
    // directory path (e.g. `.agents/skills/...`); the scan is
    // root-relative and the leading dot is part of the real path.
    if (match.index > 0 && line[match.index - 1] === '.') continue;
    const candidate = cleanCandidate(match[0]);
    if (candidate !== null) candidates.push(candidate);
  }
  for (const match of line.matchAll(DOT_AGENTS_PATTERN)) {
    // Only a root-relative .agents/ mention counts: a match preceded
    // by a word character, '.', '/', or '-' is a suffix of a longer
    // path (e.g. `foo.agents/...`), not a root-relative path. The
    // rooted-pattern loop above already skipped the `agents/...`
    // tail of a `.agents/...` mention, so a valid mention yields
    // exactly one candidate here.
    if (match.index > 0 && /[A-Za-z0-9_./-]/.test(line[match.index - 1])) continue;
    const candidate = cleanCandidate(match[0]);
    if (candidate !== null) candidates.push(candidate);
  }
  if (skillRoot !== null) {
    for (const match of line.matchAll(SKILL_RELATIVE_PATTERN)) {
      // A bare references/... mention is relative to the skill root,
      // not to the mentioning file's own directory: a reference file
      // in references/ means its sibling by the same form. A match
      // preceded by a word character, '.', '/', or '-' is a suffix
      // of a longer path, not a bare skill-relative mention.
      if (match.index > 0 && /[A-Za-z0-9_./-]/.test(line[match.index - 1])) continue;
      const cleaned = cleanCandidate(match[0]);
      if (cleaned === null) continue;
      candidates.push(skillRoot === '' ? cleaned : `${skillRoot}/${cleaned}`);
    }
  }
  return candidates;
}

function skillRootForFile(rel, skillRoots) {
  const dir = path.posix.dirname(rel);
  let best = null;
  for (const root of skillRoots) {
    if (dir === root || dir.startsWith(`${root}/`)) {
      if (best === null || root.length > best.length) best = root;
    }
  }
  if (best !== null) return best === '.' ? '' : best;
  const agentsMatch = /^\.agents\/skills\/[^/]+/.exec(rel);
  return agentsMatch === null ? null : agentsMatch[0];
}

function scanDeadReferences(root, files, warnings) {
  const skillRoots = new Set(
    files
      .filter((rel) => path.posix.basename(rel) === 'SKILL.md')
      .map((rel) => path.posix.dirname(rel)),
  );
  for (const rel of files) {
    if (!isMarkdown(rel)) continue;
    const text = readText(root, rel);
    const skillRoot = skillRootForFile(rel, skillRoots);
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      for (const candidate of extractPathCandidates(line, skillRoot)) {
        let exists = false;
        try {
          statSync(path.join(root, candidate));
          exists = true;
        } catch {
          exists = false;
        }
        if (!exists) {
          warnings.push({
            check: 'dead-reference',
            file: rel,
            line: index + 1,
            message: `mentioned path does not exist: ${candidate}`,
          });
        }
      }
    });
  }
}

function findDuplicateHeadings(root, files) {
  const byHeading = new Map();
  for (const rel of files) {
    if (!isMarkdown(rel)) continue;
    const text = readText(root, rel);
    for (const line of text.split('\n')) {
      const match = /^# ([^#].*)$/.exec(line);
      if (match === null) continue;
      const heading = match[1].trim().replace(/\s+/g, ' ');
      const key = heading.toLowerCase();
      if (!byHeading.has(key)) byHeading.set(key, { heading, files: new Set() });
      byHeading.get(key).files.add(rel);
    }
  }
  const report = [];
  for (const { heading, files: seen } of byHeading.values()) {
    if (seen.size >= 2) {
      report.push({ heading, files: [...seen].sort() });
    }
  }
  report.sort((a, b) => a.heading.localeCompare(b.heading));
  return report;
}

/**
 * Validate the tree at `root`. Returns { failures, warnings,
 * duplicateHeadings, counts }. Failures come only from the budget,
 * frontmatter, and forbidden-file checks. A missing root AGENTS.md is
 * a budget-check failure: the generic set requires a root global file.
 */
export function validate(root) {
  const failures = [];
  const warnings = [];
  const { files, dirs } = walkTree(root);
  if (!files.includes('AGENTS.md')) {
    failures.push({ check: 'budget', file: 'AGENTS.md', message: 'root AGENTS.md is missing' });
  }
  const counts = checkBudgets(root, files, failures);
  checkSkillFrontmatter(root, files, failures);
  checkForbiddenFiles(files, dirs, failures);
  scanDeadReferences(root, files, warnings);
  const duplicateHeadings = findDuplicateHeadings(root, files);
  return {
    failures,
    warnings,
    duplicateHeadings,
    counts: { ...counts, files: files.length, markdownFiles: files.filter(isMarkdown).length },
  };
}

function printSection(title, entries, format) {
  console.log(`\n${title}`);
  if (entries.length === 0) {
    console.log('  (none)');
    return;
  }
  for (const entry of entries) console.log(`  ${format(entry)}`);
}

function main() {
  const rootArg = process.argv[2];
  const root = path.resolve(rootArg ?? process.cwd());
  const result = validate(root);
  printSection(
    'FAILURES (budget / frontmatter / forbidden files):',
    result.failures,
    (f) => `${f.check}: ${f.file}: ${f.message}`,
  );
  printSection(
    'WARNINGS (dead references; do not change the exit code):',
    result.warnings,
    (w) => `${w.file}:${w.line}: ${w.message}`,
  );
  printSection(
    'DUPLICATE TOP-LEVEL HEADINGS (report only; exit code unchanged):',
    result.duplicateHeadings,
    (d) => `"${d.heading}" in ${d.files.join(', ')}`,
  );
  console.log(
    `\nChecked ${result.counts.files} files (${result.counts.markdownFiles} markdown, ${result.counts.agents} AGENTS.md, ${result.counts.skills} SKILL.md): ` +
      `${result.failures.length} failure(s), ${result.warnings.length} warning(s), ` +
      `${result.duplicateHeadings.length} duplicate-heading group(s).`,
  );
  if (result.failures.length > 0) {
    console.log('RESULT: FAIL');
    process.exitCode = 1;
  } else {
    console.log('RESULT: PASS');
  }
}

const invokedPath = process.argv[1] === undefined ? '' : path.resolve(process.argv[1]);
const modulePath = fileURLToPath(import.meta.url);
if (invokedPath === modulePath) main();
