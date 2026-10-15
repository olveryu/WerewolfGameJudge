#!/usr/bin/env node
/**
 * `pnpm new-game <gameId> --preset identity|stage` — scaffold a new game.
 *
 * Produces the full skeleton (engine, Worker module, client module,
 * design doc, registration migration) from the templates under
 * scripts/lib/new-game/templates and wires the game into the registry,
 * the reward parameter table, the three catalogs, and the contract
 * expectation lists. Prints an integration report at the repo root
 * listing what was written and the manual steps that remain.
 */

import path from 'node:path';

import { DEFAULT_REWARDS, generateNewGame } from './lib/new-game/generate.mjs';

const USAGE = `Usage: pnpm new-game <gameId> --preset identity|stage [options]

Options:
  --preset <identity|stage>  Skeleton archetype (required).
  --name <text>              Home display name (default: the game id).
  --subtitle <text>          Home subtitle (default: a TODO placeholder).
  --icon <ionicon-name>      Home icon (default: game-controller-outline).
  --tier <main|mini>         Home tier (default: mini).
  --xp <n>                   Completion reward XP (default: ${DEFAULT_REWARDS.xpEarned}).
  --draws <n>                Completion reward normal draws (default: ${DEFAULT_REWARDS.normalDrawsEarned}).
  --daily-target <n>         Daily completion target (default: ${DEFAULT_REWARDS.dailyCompletionTarget}).
`;

/** Reward values must be plain non-negative integers — no partial parses. */
function parseRewardValue(option, raw) {
  if (!/^\d+$/.test(raw))
    throw new Error(`${option} expects a non-negative integer, got "${raw}".`);
  return Number.parseInt(raw, 10);
}

function parseArgs(argv) {
  const options = { rewards: { ...DEFAULT_REWARDS } };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Option ${arg} needs a value.`);
      return argv[index];
    };
    switch (arg) {
      case '--preset':
        options.preset = next();
        break;
      case '--name':
        options.displayName = next();
        break;
      case '--subtitle':
        options.subtitle = next();
        break;
      case '--icon':
        options.iconName = next();
        break;
      case '--tier':
        options.tier = next();
        break;
      case '--xp':
        options.rewards.xpEarned = parseRewardValue('--xp', next());
        break;
      case '--draws':
        options.rewards.normalDrawsEarned = parseRewardValue('--draws', next());
        break;
      case '--daily-target':
        options.rewards.dailyCompletionTarget = parseRewardValue('--daily-target', next());
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
        positional.push(arg);
    }
  }
  if (positional.length > 1)
    throw new Error(`Expected exactly one game id, got: ${positional.join(', ')}`);
  options.gameId = positional[0];
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help === true || options.gameId === undefined) {
    process.stdout.write(USAGE);
    if (options.gameId === undefined && options.help !== true) process.exitCode = 1;
    return;
  }
  if (options.tier !== undefined && options.tier !== 'main' && options.tier !== 'mini') {
    throw new Error(`Invalid --tier "${options.tier}": expected "main" or "mini".`);
  }
  for (const [key, value] of Object.entries(options.rewards)) {
    if (!Number.isInteger(value) || value < 0)
      throw new Error(`Reward ${key} must be a non-negative integer.`);
  }
  const summary = generateNewGame({ rootDir: process.cwd(), ...options });
  process.stdout.write(
    [
      `Created ${summary.createdFiles.length} files and updated ${summary.editedFiles.length} shared files for "${options.gameId}" (${options.preset}).`,
      `Registration migration: packages/api-worker/migrations/${summary.migrationName}`,
      summary.formatted
        ? 'Generated files were formatted with the repository prettier.'
        : 'Warning: prettier was not found; run pnpm format:write before committing.',
      summary.linted
        ? 'Generated files passed the repository eslint (autofix, then a zero-warning check).'
        : 'Warning: eslint was not found; run pnpm lint before committing.',
      `Integration report: ${path.join(process.cwd(), summary.reportPath)}`,
      'Next: read the report, fill every TODO(gameplay), and run the quality gates before opening a PR.',
      '',
    ].join('\n'),
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`new-game: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
