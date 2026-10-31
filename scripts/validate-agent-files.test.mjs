import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { estimateTokens, parseFrontmatter, validate } from './validate-agent-files.mjs';

const VALIDATOR_PATH = fileURLToPath(new URL('./validate-agent-files.mjs', import.meta.url));

async function makeTree(t, files) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'validate-agent-files-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [rel, content] of Object.entries(files)) {
    const target = path.join(root, rel);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
  return root;
}

function skillBody(name, extra = '') {
  return `---\nname: ${name}\ndescription: A short description for ${name}.\n---\n\n# ${name}\n\nBody text.${extra}\n`;
}

function passingFiles() {
  return {
    'AGENTS.md': '# Root rules\n\nShort global rules.\n',
    'packages/game-engine/AGENTS.md': '# Engine rules\n\nShort engine rules.\n',
    'skills/example-skill/SKILL.md': skillBody('example-skill'),
  };
}

function runCli(root) {
  try {
    const stdout = execFileSync(process.execPath, [VALIDATOR_PATH, root], { encoding: 'utf8' });
    return { status: 0, stdout };
  } catch (error) {
    return { status: error.status, stdout: error.stdout?.toString() ?? '' };
  }
}

test('estimateTokens is deterministic and counts CJK characters individually', () => {
  assert.equal(estimateTokens('hello world'), 2);
  assert.equal(estimateTokens('hello world'), 2);
  assert.equal(estimateTokens('你好世界'), 4);
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('a-b'), 3);
});

test('parseFrontmatter requires byte-0 start and parses flat scalars', () => {
  const parsed = parseFrontmatter(skillBody('example-skill'));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.name, 'example-skill');
  assert.equal(parsed.body.trim(), '# example-skill\n\nBody text.');
  assert.equal(parseFrontmatter('\n---\nname: x\n---\n').ok, false);
  assert.equal(parseFrontmatter('---\nname: x\n').ok, false);
});

test('passing tree: no failures, no warnings, no duplicate headings', async (t) => {
  const root = await makeTree(t, passingFiles());
  const result = validate(root);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.duplicateHeadings, []);
  assert.equal(runCli(root).status, 0);
});

test('over-budget root AGENTS.md fails (151 lines)', async (t) => {
  const lines = Array.from({ length: 151 }, (_, i) => `line ${i + 1}`).join('\n') + '\n';
  const root = await makeTree(t, { ...passingFiles(), 'AGENTS.md': lines });
  const result = validate(root);
  assert.ok(result.failures.some((f) => f.check === 'budget' && f.file === 'AGENTS.md'));
  assert.equal(runCli(root).status, 1);
});

test('over-budget root AGENTS.md fails on bytes (>32768)', async (t) => {
  const content = `# Root\n\n${'x'.repeat(33000)}\n`;
  const root = await makeTree(t, { ...passingFiles(), 'AGENTS.md': content });
  const result = validate(root);
  assert.ok(result.failures.some((f) => f.message.includes('bytes')));
});

test('nested AGENTS.md over 100 lines fails', async (t) => {
  const lines = Array.from({ length: 101 }, (_, i) => `line ${i + 1}`).join('\n') + '\n';
  const root = await makeTree(t, {
    ...passingFiles(),
    'packages/api-worker/AGENTS.md': lines,
  });
  const result = validate(root);
  assert.ok(
    result.failures.some((f) => f.check === 'budget' && f.file === 'packages/api-worker/AGENTS.md'),
  );
});

test('bad frontmatter key fails', async (t) => {
  const bad =
    '---\nname: example-skill\ndescription: ok.\napplyTo: "**"\n---\n\n# example-skill\n\nBody.\n';
  const root = await makeTree(t, {
    ...passingFiles(),
    'skills/example-skill/SKILL.md': bad,
  });
  const result = validate(root);
  assert.ok(
    result.failures.some((f) => f.check === 'frontmatter' && f.message.includes('applyTo')),
  );
});

test('frontmatter name mismatch, bad name, and over-long description fail', async (t) => {
  const mismatch = skillBody('other-name');
  const root = await makeTree(t, {
    ...passingFiles(),
    'skills/example-skill/SKILL.md': mismatch,
  });
  assert.ok(validate(root).failures.some((f) => f.message.includes('does not equal folder name')));

  const badName = '---\nname: Bad_Name\ndescription: ok.\n---\n\n# Bad\n\nBody.\n';
  const root2 = await makeTree(t, {
    ...passingFiles(),
    'skills/example-skill/SKILL.md': badName,
  });
  assert.ok(validate(root2).failures.some((f) => f.message.includes('does not match')));

  const longDescription = `---\nname: example-skill\ndescription: ${'x'.repeat(1025)}\n---\n\n# example-skill\n\nBody.\n`;
  const root3 = await makeTree(t, {
    ...passingFiles(),
    'skills/example-skill/SKILL.md': longDescription,
  });
  assert.ok(validate(root3).failures.some((f) => f.message.includes('description is 1025 chars')));
});

test('frontmatter is not required on AGENTS.md files', async (t) => {
  const root = await makeTree(t, passingFiles());
  const result = validate(root);
  assert.deepEqual(result.failures, []);
});

test('SKILL.md over 500 lines fails; body at 5000 estimated tokens fails', async (t) => {
  const manyLines = `---\nname: example-skill\ndescription: ok.\n---\n\n` + 'line\n'.repeat(501);
  const root = await makeTree(t, { ...passingFiles(), 'skills/example-skill/SKILL.md': manyLines });
  assert.ok(validate(root).failures.some((f) => f.message.includes('lines')));

  const manyTokens = `---\nname: example-skill\ndescription: ok.\n---\n\n` + 'word '.repeat(5000);
  const root2 = await makeTree(t, {
    ...passingFiles(),
    'skills/example-skill/SKILL.md': manyTokens,
  });
  assert.ok(validate(root2).failures.some((f) => f.message.includes('tokens')));
});

test('forbidden file present fails', async (t) => {
  for (const forbidden of ['CLAUDE.md', 'GEMINI.md', 'MUSE.md', 'scripts/sync-agent-config.mjs']) {
    const root = await makeTree(t, { ...passingFiles(), [forbidden]: '# forbidden\n' });
    const result = validate(root);
    assert.ok(
      result.failures.some((f) => f.check === 'forbidden' && f.file === forbidden),
      `expected forbidden failure for ${forbidden}`,
    );
  }
  const root = await makeTree(t, {
    ...passingFiles(),
    '.github/instructions/old.instructions.md': '# old\n',
  });
  assert.ok(validate(root).failures.some((f) => f.check === 'forbidden'));
  assert.equal(runCli(root).status, 1);
});

test('forbidden files inside ignored directories are not flagged', async (t) => {
  const root = await makeTree(t, {
    ...passingFiles(),
    'node_modules/some-pkg/CLAUDE.md': '# vendored\n',
  });
  const result = validate(root);
  assert.deepEqual(result.failures, []);
});

test('extractPathCandidates skips hidden-directory tails (.agents/...)', async () => {
  const { extractPathCandidates } = await import('./validate-agent-files.mjs');
  assert.deepEqual(extractPathCandidates('See .agents/skills/example/SKILL.md for detail.'), []);
  assert.deepEqual(extractPathCandidates('See src/does/not/exist.ts for detail.'), [
    'src/does/not/exist.ts',
  ]);
});

test('dead-path mention is a warning only and does not fail validation', async (t) => {
  const withDeadPath = skillBody('example-skill', '\nSee src/does/not/exist.ts for detail.\n');
  const root = await makeTree(t, {
    ...passingFiles(),
    'skills/example-skill/SKILL.md': withDeadPath,
  });
  const result = validate(root);
  assert.deepEqual(result.failures, []);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].check, 'dead-reference');
  assert.ok(result.warnings[0].message.includes('src/does/not/exist.ts'));
  assert.equal(runCli(root).status, 0);
});

test('duplicate top-level headings are reported, not failed', async (t) => {
  const root = await makeTree(t, {
    'AGENTS.md': '# Shared heading\n\nRoot.\n',
    'packages/game-engine/AGENTS.md': '# Shared heading\n\nEngine.\n',
    'skills/example-skill/SKILL.md': skillBody('example-skill'),
  });
  const result = validate(root);
  assert.deepEqual(result.failures, []);
  assert.equal(result.duplicateHeadings.length, 1);
  assert.equal(result.duplicateHeadings[0].heading, 'Shared heading');
  assert.deepEqual(result.duplicateHeadings[0].files, [
    'AGENTS.md',
    'packages/game-engine/AGENTS.md',
  ]);
  assert.equal(runCli(root).status, 0);
});

test('missing root AGENTS.md fails', async (t) => {
  const root = await makeTree(t, {
    'packages/game-engine/AGENTS.md': '# Engine rules\n\nShort.\n',
  });
  const result = validate(root);
  assert.ok(result.failures.some((f) => f.file === 'AGENTS.md' && f.message.includes('missing')));
});
