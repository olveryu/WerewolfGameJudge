#!/usr/bin/env node
/**
 * Install project skills into local agent hosts via `gh skill install`.
 * Source: .agents/skills/  Requires GitHub CLI >= 2.90.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, '.agents', 'skills');

const DEFAULT_AGENTS = ['github-copilot', 'claude-code', 'cursor'];

function parseArgs(argv) {
  const agents = [];
  let scope = 'project';
  let force = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--agent' && argv[i + 1]) {
      agents.push(argv[++i]);
    } else if (a === '--scope' && argv[i + 1]) {
      scope = argv[++i];
    } else if (a === '--force' || a === '-f') {
      force = true;
    } else if (a === '--help' || a === '-h') {
      return { help: true, agents, scope, force };
    }
  }
  return { help: false, agents: agents.length ? agents : DEFAULT_AGENTS, scope, force };
}

function run(cmd, args) {
  return spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
}

function ghAvailable() {
  return run('gh', ['--version']).status === 0;
}

function ghSkillAvailable() {
  return run('gh', ['skill', '--help']).status === 0;
}

function parseGhVersion(stdout) {
  const m = stdout.match(/gh version (\d+)\.(\d+)/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]) };
}

function ghVersionOk(stdout) {
  const v = parseGhVersion(stdout);
  if (!v) return false;
  return v.major > 2 || (v.major === 2 && v.minor >= 90);
}

function listSkillNames() {
  return fs
    .readdirSync(SOURCE, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(SOURCE, e.name, 'SKILL.md')))
    .map((e) => e.name);
}

function installSkill(agent, skillName, { scope, force }) {
  const args = [
    'skill',
    'install',
    '.',
    skillName,
    '--from-local',
    '--agent',
    agent,
    '--scope',
    scope,
  ];
  if (force) args.push('--force');
  return run('gh', args);
}

function printHelp() {
  console.log(`Usage: node scripts/gh-skill-install.mjs [options]

Install skills from .agents/skills/ into local agent directories.

Options:
  --agent <name>     Repeatable. Default: ${DEFAULT_AGENTS.join(', ')}
  --scope project|user
  --force, -f

Prerequisites: GitHub CLI >= 2.90, pnpm run sync:agents
`);
}

function main() {
  const { help, agents, scope, force } = parseArgs(process.argv);
  if (help) {
    printHelp();
    return;
  }

  if (!fs.existsSync(SOURCE)) {
    console.error(`Missing ${SOURCE}`);
    process.exit(1);
  }

  if (!ghAvailable()) {
    console.error(
      'GitHub CLI (gh) not found. Install >= 2.90: https://cli.github.com/\n  Windows: winget install GitHub.cli',
    );
    process.exit(1);
  }

  const ver = run('gh', ['--version']);
  if (!ghSkillAvailable()) {
    console.error('Upgrade gh to >= 2.90 for `gh skill`.');
    process.exit(1);
  }

  if (!ghVersionOk(ver.stdout || '')) {
    console.warn(`Warning: gh may be < 2.90 (${(ver.stdout || '').trim()})`);
  }

  const skillsDir = path.join(ROOT, 'skills');
  if (!fs.existsSync(skillsDir)) {
    console.log('Running sync:agents first…');
    const sync = run(process.execPath, [path.join(ROOT, 'scripts', 'sync-agent-config.mjs')]);
    if (sync.status !== 0) process.exit(sync.status ?? 1);
  }

  const skillNames = listSkillNames();
  if (!skillNames.length) {
    console.error('No SKILL.md under .agents/skills/');
    process.exit(1);
  }

  let failures = 0;
  for (const agent of agents) {
    console.log(`\n=== ${agent} (${scope}) ===`);
    for (const name of skillNames) {
      process.stdout.write(`  ${name} … `);
      const r = installSkill(agent, name, { scope, force });
      if (r.status === 0) console.log('ok');
      else {
        failures++;
        console.log('failed');
        if (r.stderr) console.error(r.stderr.trim());
      }
    }
  }

  if (failures) process.exit(1);
  console.log('\nDone:', agents.join(', '));
}

main();
