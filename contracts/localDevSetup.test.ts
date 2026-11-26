import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseEnv } from 'node:util';

import { beforeAll, expect, it } from 'vitest';
import { z } from 'zod';

const repositoryRoot = process.cwd();
const devEmail = 'dev@test.local';

function createFixture() {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'game-judge-local-dev-')));
  mkdirSync(path.join(root, 'scripts'));
  mkdirSync(path.join(root, 'packages/api-worker'), { recursive: true });
  mkdirSync(path.join(root, 'bin'));
  return root;
}

function createDevFixture() {
  const root = createFixture();
  for (const script of ['setup-local-dev.mjs', 'dev.mjs']) {
    copyFileSync(path.join(repositoryRoot, 'scripts', script), path.join(root, 'scripts', script));
  }
  symlinkSync(path.join(repositoryRoot, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  writeFileSync(
    path.join(root, 'bin/pnpm'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const command = args[0] === 'run' ? args[1] : args.includes('@game-judge/api-worker') ? 'worker' : 'web';
fs.appendFileSync(process.env.CALL_LOG, JSON.stringify({
  command, cwd: process.cwd(), args, apiUrl: process.env.VITE_CF_API_URL ?? '', pid: process.pid
}) + '\\n');
if (command === process.env.FAILING_SCRIPT) process.exit(7);
if (args[0] !== 'run') {
  process.on('SIGTERM', () => process.exit(0));
  if (process.env.FAILING_SERVER) {
    setInterval(() => {
      const calls = fs.readFileSync(process.env.CALL_LOG, 'utf8').trim().split('\\n').map(JSON.parse);
      if (command === process.env.FAILING_SERVER &&
          calls.some(call => call.command === 'worker') && calls.some(call => call.command === 'web')) {
        process.exit(7);
      }
    }, 20);
  } else {
    setTimeout(() => process.exit(0), 500);
  }
}
`,
    { mode: 0o755 },
  );
  return root;
}

function runDevFixture(root: string, environment: Record<string, string> = {}) {
  const packageJson = z
    .object({ scripts: z.object({ dev: z.string() }) })
    .parse(JSON.parse(readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8')));
  const logPath = path.join(root, 'calls.jsonl');
  writeFileSync(logPath, '');
  const result = spawnSync('sh', ['-c', packageJson.scripts.dev], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
    env: {
      ...process.env,
      JWT_SECRET: undefined,
      FAILING_SCRIPT: '',
      FAILING_SERVER: '',
      PATH: `${path.join(root, 'bin')}${path.delimiter}${process.env.PATH ?? ''}`,
      CALL_LOG: logPath,
      ...environment,
    },
  });
  const calls = readFileSync(logPath, 'utf8')
    .trim()
    .split('\n')
    .map((line) =>
      z
        .strictObject({
          command: z.string(),
          cwd: z.string(),
          args: z.array(z.string()),
          apiUrl: z.string(),
          pid: z.number(),
        })
        .parse(JSON.parse(line)),
    );
  return { result, calls };
}

it.each(['', 'db:migrate:local', 'db:seed:local'])(
  'runs migrations, seed and servers in order, stopping at failure "%s"',
  (failingScript) => {
    const root = createDevFixture();
    try {
      const { result, calls } = runDevFixture(root, { FAILING_SCRIPT: failingScript });
      const expected = ['db:migrate:local', 'db:seed:local'];
      const failureIndex = expected.indexOf(failingScript);
      expect(calls.slice(0, 2).map((call) => call.command)).toEqual(
        failingScript ? expected.slice(0, failureIndex + 1) : expected,
      );
      expect(
        calls
          .slice(2)
          .map((call) => call.command)
          .sort(),
      ).toEqual(failingScript ? [] : ['web', 'worker']);
      for (const call of calls.filter((call) => call.command.startsWith('db:'))) {
        expect(call.cwd).toBe(path.join(root, 'packages/api-worker'));
      }
      expect(result.status).toBe(failingScript ? 1 : 0);
      if (failingScript) {
        expect(result.stderr).toContain(`failed at ${failingScript}; servers were not started`);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

async function occupyPortUnlessAlreadyInUse(port: number, host: string) {
  const server = createServer();
  return new Promise<ReturnType<typeof createServer> | undefined>((resolve, reject) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') resolve(undefined);
      else reject(error);
    });
    server.listen(port, host, () => resolve(server));
  });
}

it('skips occupied ports, matches the Vite API URL and reuses the generated auth key', async () => {
  const listeners = await Promise.all([
    occupyPortUnlessAlreadyInUse(8787, '127.0.0.1'),
    occupyPortUnlessAlreadyInUse(5173, '::1'),
    occupyPortUnlessAlreadyInUse(5174, '::1'),
    occupyPortUnlessAlreadyInUse(9229, '127.0.0.1'),
  ]);
  const root = createDevFixture();
  try {
    const { result, calls } = runDevFixture(root);
    expect(result.status).toBe(0);
    const worker = calls.find((call) => call.command === 'worker');
    const web = calls.find((call) => call.command === 'web');
    if (!worker || !web) throw new Error('Both development servers must have started');
    const workerPort = Number(worker.args[worker.args.indexOf('--port') + 1]);
    const webPort = Number(web.args[web.args.indexOf('--port') + 1]);
    const inspectorPort = Number(worker.args[worker.args.indexOf('--inspector-port') + 1]);
    expect(workerPort).toBeGreaterThan(0);
    expect(workerPort).not.toBe(8787);
    expect(worker.args[worker.args.indexOf('--ip') + 1]).toBe('127.0.0.1');
    expect(webPort).toBeGreaterThan(5174);
    expect(inspectorPort).toBeGreaterThan(9229);
    expect(web.apiUrl).toBe(`http://127.0.0.1:${workerPort}`);
    expect(web.args).toContain('--strictPort');
    const envPath = path.join(root, 'packages/api-worker/.env.local');
    const firstEnvironment = readFileSync(envPath, 'utf8');
    const key = parseEnv(firstEnvironment).JWT_SECRET;
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(result.stdout).not.toContain(key);
    expect(runDevFixture(root).result.status).toBe(0);
    expect(readFileSync(envPath, 'utf8')).toBe(firstEnvironment);
  } finally {
    for (const server of listeners) {
      if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    rmSync(root, { recursive: true, force: true });
  }
});

it.each(['.dev.vars', '.env', '.env.local', 'process'])(
  'preserves an existing auth key from %s without creating a replacement',
  (source) => {
    const root = createDevFixture();
    try {
      const content = '# Keep this configuration\nJWT_SECRET=existing-local-test-key\n';
      const filePath = path.join(root, 'packages/api-worker', source);
      if (source !== 'process') writeFileSync(filePath, content);
      const environment: Record<string, string> =
        source === 'process' ? { JWT_SECRET: 'existing-local-test-key' } : {};
      expect(runDevFixture(root, environment).result.status).toBe(0);
      if (source !== 'process') expect(readFileSync(filePath, 'utf8')).toBe(content);
      if (source !== '.env.local') {
        expect(() => readFileSync(path.join(root, 'packages/api-worker/.env.local'))).toThrow();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

it('adds a missing key to .dev.vars without overwriting other settings or using an ignored process key', () => {
  const root = createDevFixture();
  try {
    const filePath = path.join(root, 'packages/api-worker/.dev.vars');
    const content = '# Preserved settings\nADMIN_PASSWORD=local-test-password\n';
    writeFileSync(filePath, content);
    expect(runDevFixture(root, { JWT_SECRET: 'ignored-process-key' }).result.status).toBe(0);
    const updated = readFileSync(filePath, 'utf8');
    expect(updated.startsWith(content)).toBe(true);
    expect(parseEnv(updated).JWT_SECRET).toMatch(/^[a-f0-9]{64}$/);
    expect(runDevFixture(root).result.status).toBe(0);
    expect(readFileSync(filePath, 'utf8')).toBe(updated);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('rejects an explicitly empty auth key before either server starts', () => {
  const root = createDevFixture();
  try {
    const { result, calls } = runDevFixture(root, { JWT_SECRET: '' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Local JWT_SECRET is empty');
    expect(calls.map((call) => call.command)).toEqual(['db:migrate:local', 'db:seed:local']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it.each(['worker', 'web'])(
  'stops both servers when %s fails and returns failure',
  (failingServer) => {
    const root = createDevFixture();
    try {
      const { result, calls } = runDevFixture(root, { FAILING_SERVER: failingServer });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Development servers stopped because a process failed');
      for (const call of calls.filter(
        (call) => call.command === 'worker' || call.command === 'web',
      )) {
        expect(() => process.kill(call.pid, 0)).toThrow(/ESRCH/);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

let seedSql: string;

beforeAll(() => {
  const root = createFixture();
  try {
    copyFileSync(
      path.join(repositoryRoot, 'scripts/seed-local.mjs'),
      path.join(root, 'scripts/seed-local.mjs'),
    );
    const catalogDir = path.join(root, 'packages/game-engine/src/product/rewards');
    mkdirSync(catalogDir, { recursive: true });
    copyFileSync(
      path.join(repositoryRoot, 'packages/game-engine/src/product/rewards/catalog.ts'),
      path.join(catalogDir, 'catalog.ts'),
    );
    symlinkSync(path.join(repositoryRoot, 'node_modules'), path.join(root, 'node_modules'), 'dir');
    const capture = path.join(root, 'seed.sql');
    const invocation = path.join(root, 'invocation.json');
    writeFileSync(
      path.join(root, 'bin/pnpm'),
      `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const sqlPath = args.find(arg => arg.startsWith('--file=')).slice('--file='.length);
fs.copyFileSync(sqlPath, process.env.SQL_CAPTURE);
fs.writeFileSync(process.env.INVOCATION_CAPTURE, JSON.stringify({ args, sqlPath, cwd: process.cwd() }));
`,
      { mode: 0o755 },
    );
    execFileSync(process.execPath, [path.join(root, 'scripts/seed-local.mjs')], {
      stdio: 'pipe',
      env: {
        ...process.env,
        PATH: `${path.join(root, 'bin')}${path.delimiter}${process.env.PATH ?? ''}`,
        SQL_CAPTURE: capture,
        INVOCATION_CAPTURE: invocation,
      },
    });
    seedSql = readFileSync(capture, 'utf8');
    const call = z
      .strictObject({ args: z.array(z.string()), sqlPath: z.string(), cwd: z.string() })
      .parse(JSON.parse(readFileSync(invocation, 'utf8')));
    expect(call.cwd).toBe(path.join(root, 'packages/api-worker'));
    expect(call.args.slice(0, -1)).toEqual([
      'exec',
      'wrangler',
      'd1',
      'execute',
      'werewolf-db',
      '--local',
      '--config=wrangler.toml',
    ]);
    expect(() => readFileSync(call.sqlPath)).toThrow();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function withMigratedDatabase(run: (database: DatabaseSync) => void) {
  const database = new DatabaseSync(':memory:');
  try {
    const migrationDir = path.join(repositoryRoot, 'packages/api-worker/migrations');
    for (const file of readdirSync(migrationDir)
      .filter((name) => name.endsWith('.sql'))
      .sort()) {
      database.exec(readFileSync(path.join(migrationDir, file), 'utf8'));
    }
    database.exec('PRAGMA foreign_keys = ON');
    run(database);
  } finally {
    database.close();
  }
}

it('seeds an empty migrated database and preserves changed accounts, progress and words on rerun', () => {
  withMigratedDatabase((database) => {
    database.exec(seedSql);
    expect(database.prepare('SELECT email FROM users').all()).toEqual([{ email: devEmail }]);
    expect(database.prepare('SELECT level, normal_draws FROM user_stats').get()).toEqual({
      level: 99,
      normal_draws: 50,
    });
    database.exec(`
      UPDATE users SET display_name = 'Keep me', password_hash = 'changed', updated_at = 'preserved';
      UPDATE user_stats SET xp = 42, level = 2, games_played = 3, unlocked_items = '[]',
        normal_draws = 1, golden_draws = 0, version = 7,
        last_login_reward_at = '2026-11-25T12:00:00.000Z';
      UPDATE fib_words SET usage_note = 'Edited locally';
      UPDATE undercover_word_pairs SET status = 'disabled';
      UPDATE drawguess_words SET status = 'disabled', disabled_at = 'preserved';
      UPDATE decrypto_words SET status = 'disabled';
      CREATE TABLE seed_child (user_id TEXT REFERENCES users(id) ON DELETE CASCADE);
      INSERT INTO seed_child SELECT id FROM users;
    `);
    const tables = [
      'users',
      'user_stats',
      'fib_word_sequence',
      'fib_words',
      'undercover_word_pairs',
      'drawguess_words',
      'decrypto_words',
      'seed_child',
    ];
    const before = tables.map((table) => database.prepare(`SELECT * FROM ${table}`).all());
    database.exec(seedSql);
    expect(tables.map((table) => database.prepare(`SELECT * FROM ${table}`).all())).toEqual(before);
  });
});

it('preserves an existing Undercover pair when its seeded pair conflicts under another ID', () => {
  withMigratedDatabase((database) => {
    database.exec(`
      INSERT INTO undercover_word_pairs
        (id, word_a, word_b, category, status, created_at, reviewed_at, review_json)
      VALUES
        ('custom-apple-pair', '苹果', '香蕉', 'food', 'disabled', 'preserved', 'preserved', '{}');
    `);

    expect(() => database.exec(seedSql)).not.toThrow();
    expect(
      database
        .prepare(
          "SELECT id, category, status, created_at FROM undercover_word_pairs WHERE word_a = '苹果' AND word_b = '香蕉'",
        )
        .all(),
    ).toEqual([
      {
        id: 'custom-apple-pair',
        category: 'food',
        status: 'disabled',
        created_at: 'preserved',
      },
    ]);
  });
});

it('preserves an existing DrawGuess word when its seeded word conflicts under another ID', () => {
  withMigratedDatabase((database) => {
    database.exec(`
      INSERT INTO drawguess_words
        (id, word, pinyin_initials, category, difficulty, status, created_at, disabled_at)
      VALUES
        ('custom-panda-word', '大熊猫', 'dxm', 'custom', 'easy', 'disabled', 'preserved', 'preserved');
    `);

    expect(() => database.exec(seedSql)).not.toThrow();
    expect(
      database
        .prepare(
          "SELECT id, category, status, created_at, disabled_at FROM drawguess_words WHERE word = '大熊猫'",
        )
        .all(),
    ).toEqual([
      {
        id: 'custom-panda-word',
        category: 'custom',
        status: 'disabled',
        created_at: 'preserved',
        disabled_at: 'preserved',
      },
    ]);
  });
});

it('recovers an interrupted seed without resetting rows already written', () => {
  withMigratedDatabase((database) => {
    database.exec(seedSql.split(';').slice(0, 3).join(';') + ';');
    database.exec("UPDATE user_stats SET xp = 123; UPDATE users SET display_name = 'Preserved'");
    database.exec(seedSql);
    expect(database.prepare('SELECT xp FROM user_stats').get()).toEqual({ xp: 123 });
    expect(database.prepare('SELECT display_name FROM users').get()).toEqual({
      display_name: 'Preserved',
    });
    for (const [table, count] of [
      ['fib_word_sequence', 10],
      ['fib_words', 10],
      ['undercover_word_pairs', 12],
      ['drawguess_words', 12],
      ['decrypto_words', 56],
    ]) {
      expect(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()).toEqual({ count });
    }
  });
});

it('provides eight selectable local Decrypto keywords without replacing an existing word identity', () => {
  withMigratedDatabase((database) => {
    database.exec(
      "INSERT INTO decrypto_words (id, word, category, status, created_at) VALUES ('keep-apple', '苹果', 'ingredients', 'disabled', 'preserved')",
    );
    database.exec(seedSql);
    expect(
      database
        .prepare("SELECT id, status, created_at FROM decrypto_words WHERE word = '苹果'")
        .get(),
    ).toEqual({ id: 'keep-apple', status: 'disabled', created_at: 'preserved' });
    const words = database
      .prepare(
        "SELECT word FROM decrypto_words WHERE id LIKE 'decrypto-local-%' AND status = 'active' ORDER BY random() LIMIT 8",
      )
      .all();
    expect(words).toHaveLength(8);
    expect(new Set(words.map((row) => row.word)).size).toBe(8);
  });
});

it('uses an existing development account UUID when restoring missing stats', () => {
  withMigratedDatabase((database) => {
    database.exec(seedSql.split(';')[0] + ';');
    database.exec("UPDATE users SET id = 'existing-dev-id', password_hash = 'preserved'");
    database.exec(seedSql);
    expect(database.prepare('SELECT id, password_hash FROM users').get()).toEqual({
      id: 'existing-dev-id',
      password_hash: 'preserved',
    });
    expect(database.prepare('SELECT user_id FROM user_stats').get()).toEqual({
      user_id: 'existing-dev-id',
    });
  });
});

it('fails explicitly rather than replacing an unrelated account using the reserved UUID', () => {
  withMigratedDatabase((database) => {
    database.exec(seedSql.split(';')[0] + ';');
    database.exec("UPDATE users SET email = 'other@test.local'");
    expect(() => database.exec(seedSql)).toThrow(/UNIQUE constraint failed: users.id/);
    expect(database.prepare('SELECT email FROM users').get()).toEqual({
      email: 'other@test.local',
    });
    expect(database.prepare('SELECT * FROM user_stats').all()).toEqual([]);
  });
});
