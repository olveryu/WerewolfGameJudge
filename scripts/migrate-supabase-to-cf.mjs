#!/usr/bin/env node
/**
 * Supabase → Cloudflare 一次性用户 + 头像迁移脚本
 *
 * 功能：
 *   1. 从 Supabase Auth 导出注册用户（非匿名），连同 bcrypt hash
 *   2. 写入 CF D1 users 表（幂等：email 已存在则 skip）
 *   3. 从 Supabase Storage 下载自定义头像 → 上传到 CF R2
 *   4. 更新 D1 users 表的 avatar URL 指向 R2
 *
 * 前置条件：
 *   - SUPABASE_URL             Supabase 项目 URL
 *   - SUPABASE_SERVICE_ROLE_KEY Supabase service_role key（Admin API）
 *   - CF_API_URL               CF Worker URL（如 https://werewolf-api.xxx.workers.dev）
 *   - CF_D1_DATABASE_ID        D1 database ID
 *   - CF_ACCOUNT_ID            Cloudflare Account ID
 *   - CF_API_TOKEN             Cloudflare API Token（D1 + R2 权限）
 *   - CF_R2_BUCKET             R2 bucket name（默认 werewolf-avatars）
 *
 * 用法：
 *   node scripts/migrate-supabase-to-cf.mjs
 *
 * 幂等安全：可重复运行，已迁移的用户/头像会被跳过。
 */

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const CF_ACCOUNT_ID = requireEnv('CF_ACCOUNT_ID');
const CF_API_TOKEN = requireEnv('CF_API_TOKEN');
const CF_D1_DATABASE_ID = requireEnv('CF_D1_DATABASE_ID');
const CF_R2_BUCKET = process.env.CF_R2_BUCKET || 'werewolf-avatars';
const CF_API_URL = process.env.CF_API_URL; // optional, for avatar URL rewriting

function requireEnv(name) {
  const val = process.env[name];
  if (!val) {
    console.error(`❌ Missing required env: ${name}`);
    process.exit(1);
  }
  return val;
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
    const data = await supabaseAdminFetch(
      `/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
    );
    const pageUsers = data.users || data;
    if (!Array.isArray(pageUsers) || pageUsers.length === 0) break;

    for (const u of pageUsers) {
      // 跳过匿名用户
      if (u.is_anonymous || !u.email) continue;
      users.push(u);
    }
    if (pageUsers.length < perPage) break;
    page++;
  }
  return users;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare D1 API helpers
// ─────────────────────────────────────────────────────────────────────────────

async function d1Query(sql, params = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    },
  );
  const json = await res.json();
  if (!json.success) {
    throw new Error(`D1 query failed: ${JSON.stringify(json.errors)}`);
  }
  return json.result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare R2 API helpers (S3-compatible via CF API)
// ─────────────────────────────────────────────────────────────────────────────

async function r2Upload(key, buffer, contentType) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${CF_R2_BUCKET}/objects/${encodeURIComponent(key)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        'Content-Type': contentType,
      },
      body: buffer,
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 upload failed for ${key}: ${res.status} ${text}`);
  }
}

async function r2ObjectExists(key) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${CF_R2_BUCKET}/objects/${encodeURIComponent(key)}`,
    {
      method: 'HEAD',
      headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
    },
  );
  return res.ok;
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration: Users
// ─────────────────────────────────────────────────────────────────────────────

async function migrateUsers(users) {
  console.log(`\n📦 Migrating ${users.length} registered user(s) to D1...\n`);
  let migrated = 0;
  let skipped = 0;

  for (const u of users) {
    // Check if already exists in D1
    const existing = await d1Query('SELECT id FROM users WHERE email = ?', [u.email]);
    if (existing[0]?.results?.length > 0) {
      console.log(`  ⏭  ${u.email} — already exists, skipping`);
      skipped++;
      continue;
    }

    const meta = u.user_metadata || {};
    // Supabase stores bcrypt hash in encrypted_password field (Admin API)
    const passwordHash = u.encrypted_password || null;

    await d1Query(
      `INSERT INTO users (id, email, password_hash, display_name, avatar_url, custom_avatar_url, avatar_frame, is_anonymous)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        u.id,
        u.email,
        passwordHash,
        meta.display_name || u.email.split('@')[0],
        meta.avatar_url || null,
        meta.custom_avatar_url || null,
        meta.avatar_frame || null,
      ],
    );
    console.log(`  ✅ ${u.email} (${u.id})`);
    migrated++;
  }

  console.log(`\n  Users: ${migrated} migrated, ${skipped} skipped\n`);
  return migrated;
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration: Avatars
// ─────────────────────────────────────────────────────────────────────────────

async function migrateAvatars(users) {
  // Collect users with custom avatars from Supabase Storage
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
    // Extract storage path from Supabase URL:
    // https://xxx.supabase.co/storage/v1/object/public/avatars/{userId}/{file}
    const match = avatarUrl.match(/\/avatars\/(.+)$/);
    if (!match) {
      console.log(`  ⚠️  ${u.email} — cannot parse avatar URL: ${avatarUrl}`);
      failed++;
      continue;
    }

    const r2Key = match[1]; // {userId}/{file}

    // Check if already in R2
    const exists = await r2ObjectExists(r2Key);
    if (exists) {
      console.log(`  ⏭  ${u.email} — avatar already in R2, skipping`);
      skipped++;
      continue;
    }

    // Download from Supabase Storage (public URL)
    try {
      const res = await fetch(avatarUrl);
      if (!res.ok) {
        console.log(`  ⚠️  ${u.email} — download failed (${res.status})`);
        failed++;
        continue;
      }
      const buffer = await res.arrayBuffer();
      const contentType = res.headers.get('content-type') || 'image/jpeg';

      // Upload to R2
      await r2Upload(r2Key, buffer, contentType);

      // Update D1 with new R2 URL
      const newUrl = CF_API_URL
        ? `${CF_API_URL}/avatar/${r2Key}`
        : `https://werewolf-avatars.${CF_ACCOUNT_ID}.r2.dev/${r2Key}`;

      await d1Query(
        `UPDATE users SET avatar_url = ?, custom_avatar_url = ?, updated_at = datetime('now') WHERE id = ?`,
        [newUrl, newUrl, u.id],
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
  console.log('🔄 Supabase → Cloudflare Migration\n');
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log(`  CF D1:    ${CF_D1_DATABASE_ID}`);
  console.log(`  CF R2:    ${CF_R2_BUCKET}\n`);

  // Step 1: List registered users from Supabase
  console.log('📋 Fetching registered users from Supabase Auth...');
  const users = await listRegisteredUsers();
  console.log(`  Found ${users.length} registered user(s)\n`);

  if (users.length === 0) {
    console.log('✨ No registered users to migrate. Done!');
    return;
  }

  // Step 2: Migrate users to D1
  await migrateUsers(users);

  // Step 3: Migrate avatars to R2
  await migrateAvatars(users);

  console.log('✨ Migration complete!');
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
