#!/usr/bin/env node
/**
 * Supabase → Cloudflare 一次性用户 + 头像迁移脚本
 *
 * 使用本地 wrangler CLI（已登录）操作 D1 + R2，无需 Cloudflare API Token。
 *
 * 前置条件：
 *   - SUPABASE_URL              Supabase 项目 URL
 *   - SUPABASE_SERVICE_ROLE_KEY  Supabase service_role key（Admin API）
 *   - wrangler login 已完成
 *
 * 用法：
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/migrate-supabase-to-cf.mjs
 *
 * 幂等安全：可重复运行，已迁移的用户/头像会被跳过。
 */

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WRANGLER_CWD = join(__dirname, '..', 'packages', 'api-worker');
const CF_API_URL = process.env.CF_API_URL || 'https://werewolf-api.olveryu.workers.dev';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

function requireEnv(name) {
  const val = process.env[name];
  if (!val) {
    console.error(`❌ Missing required env: ${name}`);
    process.exit(1);
  }
  return val;
}

/** SQL literal escape — doubles single quotes, wraps in quotes. NULL for null/undefined. */
function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrangler D1 helpers
// ─────────────────────────────────────────────────────────────────────────────

function d1Execute(sql) {
  const out = execSync(
    `npx wrangler d1 execute werewolf-db --remote --json --command ${JSON.stringify(sql)}`,
    {
      cwd: WRANGLER_CWD,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  try {
    return JSON.parse(out);
  } catch {
    console.error('Failed to parse D1 output:', out.slice(0, 500));
    throw new Error('D1 JSON parse failed');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrangler R2 helpers
// ─────────────────────────────────────────────────────────────────────────────

function r2Upload(key, buffer, contentType) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'migrate-'));
  const tmpFile = join(tmpDir, 'avatar');
  writeFileSync(tmpFile, Buffer.from(buffer));
  try {
    execSync(
      `npx wrangler r2 object put "werewolf-avatars/${key}" --file "${tmpFile}" --content-type "${contentType}"`,
      {
        cwd: WRANGLER_CWD,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      /* ignore cleanup errors */
    }
  }
}

function r2ObjectExists(key) {
  try {
    execSync(`npx wrangler r2 object head "werewolf-avatars/${key}"`, {
      cwd: WRANGLER_CWD,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Admin API helpers
// ─────────────────────────────────────────────────────────────────────────────

async function supabaseAdminFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${path} failed (${res.status}): ${body}`);
  }
  return res.json();
}

/** 分页获取所有注册用户（非匿名） */
async function listRegisteredUsers() {
  const users = [];
  let page = 1;
  const perPage = 50;

  while (true) {
    const data = await supabaseAdminFetch(`/auth/v1/admin/users?page=${page}&per_page=${perPage}`);
    const pageUsers = data.users || data;
    if (!Array.isArray(pageUsers) || pageUsers.length === 0) break;

    for (const u of pageUsers) {
      if (u.is_anonymous || !u.email) continue;
      users.push(u);
    }
    if (pageUsers.length < perPage) break;
    page++;
  }
  return users;
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration: Users
// ─────────────────────────────────────────────────────────────────────────────

async function migrateUsers(users) {
  console.log(`\n📦 Migrating ${users.length} registered user(s) to D1...\n`);
  let migrated = 0;
  let skipped = 0;

  for (const u of users) {
    const result = d1Execute(`SELECT id FROM users WHERE email = ${esc(u.email)}`);
    if (result[0]?.results?.length > 0) {
      console.log(`  ⏭  ${u.email} — already exists, skipping`);
      skipped++;
      continue;
    }

    const meta = u.user_metadata || {};
    const passwordHash = u.encrypted_password || null;

    d1Execute(
      `INSERT INTO users (id, email, password_hash, display_name, avatar_url, custom_avatar_url, avatar_frame, is_anonymous)
       VALUES (${esc(u.id)}, ${esc(u.email)}, ${esc(passwordHash)}, ${esc(meta.display_name || u.email.split('@')[0])}, ${esc(meta.avatar_url || null)}, ${esc(meta.custom_avatar_url || null)}, ${esc(meta.avatar_frame || null)}, 0)`,
    );
    console.log(`  ✅ ${u.email} (${u.id})`);
    migrated++;
  }

  console.log(`\n  Users: ${migrated} migrated, ${skipped} skipped\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration: Avatars
// ─────────────────────────────────────────────────────────────────────────────

async function migrateAvatars(users) {
  const usersWithAvatars = users.filter((u) => {
    const url = u.user_metadata?.custom_avatar_url;
    return url && url.includes('supabase');
  });

  if (usersWithAvatars.length === 0) {
    console.log('📷 No custom avatars to migrate.\n');
    return;
  }

  console.log(`📷 Migrating ${usersWithAvatars.length} avatar(s) to R2...\n`);
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const u of usersWithAvatars) {
    const avatarUrl = u.user_metadata.custom_avatar_url;
    const match = avatarUrl.match(/\/avatars\/(.+)$/);
    if (!match) {
      console.log(`  ⚠️  ${u.email} — cannot parse avatar URL: ${avatarUrl}`);
      failed++;
      continue;
    }

    const r2Key = match[1];

    if (r2ObjectExists(r2Key)) {
      console.log(`  ⏭  ${u.email} — avatar already in R2, skipping`);
      skipped++;
      continue;
    }

    try {
      const res = await fetch(avatarUrl);
      if (!res.ok) {
        console.log(`  ⚠️  ${u.email} — download failed (${res.status})`);
        failed++;
        continue;
      }
      const buffer = await res.arrayBuffer();
      const contentType = res.headers.get('content-type') || 'image/jpeg';

      r2Upload(r2Key, buffer, contentType);

      const newUrl = `${CF_API_URL}/avatar/${r2Key}`;
      d1Execute(
        `UPDATE users SET avatar_url = ${esc(newUrl)}, custom_avatar_url = ${esc(newUrl)}, updated_at = datetime('now') WHERE id = ${esc(u.id)}`,
      );

      console.log(`  ✅ ${u.email} → ${r2Key}`);
      migrated++;
    } catch (err) {
      console.log(`  ⚠️  ${u.email} — error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n  Avatars: ${migrated} migrated, ${skipped} skipped, ${failed} failed\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔄 Supabase → Cloudflare Migration (via wrangler CLI)\n');
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log(`  D1 + R2:  via local wrangler (${WRANGLER_CWD})\n`);

  console.log('📋 Fetching registered users from Supabase Auth...');
  const users = await listRegisteredUsers();
  console.log(`  Found ${users.length} registered user(s)\n`);

  if (users.length === 0) {
    console.log('✨ No registered users to migrate. Done!');
    return;
  }

  await migrateUsers(users);
  await migrateAvatars(users);

  console.log('✨ Migration complete!');
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
