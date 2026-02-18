import fs from 'node:fs';
import path from 'node:path';

// Hard gates: fail-fast tests that enforce repo invariants.
// These are intentionally simple text-level scans to prevent architecture drift.

type Match = {
  file: string;
  line: number;
  text: string;
};

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function scanFileForNeedle(file: string, needle: string): Match[] {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  const matches: Match[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i];
    if (text.includes(needle)) {
      matches.push({ file, line: i + 1, text: text.trim() });
    }
  }
  return matches;
}

function scanDirForNeedle(dir: string, needle: string): Match[] {
  const allFiles = walk(dir).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
  return allFiles.flatMap((f) => scanFileForNeedle(f, needle));
}

describe('hard gates (contract)', () => {
  const repoRoot = path.resolve(__dirname, '../../..');
  const facadeRoot = path.join(repoRoot, 'src/services/facade');
  const engineRoot = path.join(repoRoot, 'packages/game-engine/src/engine');

  it('forbids dynamic require() in game-engine/engine/** (non-tests)', () => {
    const matches = scanDirForNeedle(engineRoot, 'require(').filter(
      (m) => !m.file.includes(`${path.sep}__tests__${path.sep}`),
    );

    expect(matches).toEqual([]);
  });

  it('forbids Facade-level progression evaluators (no evaluateAndExecuteProgression)', () => {
    const matches = scanDirForNeedle(facadeRoot, 'evaluateAndExecuteProgression');
    expect(matches).toEqual([]);
  });

  it('forbids progression-controller symbols in facade (tracker/controller must be in handlers)', () => {
    const forbiddenNeedles = ['progressionTracker', 'tryAdvanceNight'];

    const matches = forbiddenNeedles.flatMap((needle) =>
      scanDirForNeedle(facadeRoot, needle).filter(
        (m) => !m.file.includes(`${path.sep}__tests__${path.sep}`),
      ),
    );

    expect(matches).toEqual([]);
  });

  it('forbids facade from implementing chained/conditional advance/end-night orchestration', () => {
    // Hard gate: facade must not implement auto-advance logic (even under different names).
    // Allow facade to expose simple methods that forward to hostActions, but disallow
    // any conditional/recursive orchestration around those calls.
    const forbiddenNeedles = [
      'if (decision.action',
      "decision.action === 'advance'",
      "decision.action === 'end_night'",
      'await advanceNight(',
      'await endNight(',
      'return tryAdvanceNight',
      // facade is allowed to *call* handleNightProgression once as a pure forwarder,
      // but is not allowed to use its return value to orchestrate additional progress.
      // We can't reliably enforce "only once" with simple string scans, so we enforce
      // the known dangerous orchestration patterns above.
    ];

    const matches = forbiddenNeedles.flatMap((needle) =>
      scanDirForNeedle(facadeRoot, needle).filter(
        (m) => !m.file.includes(`${path.sep}__tests__${path.sep}`),
      ),
    );

    expect(matches).toEqual([]);
  });
});
