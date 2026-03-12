#!/usr/bin/env node
/**
 * generate-badges.mjs — 角色徽章批量生成脚本（Fluent Emoji 3D 版）
 *
 * 从 ROLE_SPECS 读取角色清单，下载 Microsoft Fluent Emoji 3D 资源，
 * 叠加阵营渐变边框 + 角标，导出多尺寸 PNG 徽章。
 *
 * 用法：
 *   node scripts/generate-badges.mjs                    # 全量生成
 *   node scripts/generate-badges.mjs --validate-only    # 仅校验映射
 *   node scripts/generate-badges.mjs --no-overwrite     # 增量模式
 *   node scripts/generate-badges.mjs --sizes 64,128     # 自定义尺寸
 *   node scripts/generate-badges.mjs --outdir out/badges
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import {
  EMOJI_MAP,
  FLUENT_BASE_URL,
  EXPORT_SIZES as DEFAULT_SIZES,
  DEFAULT_OUTDIR,
} from './badge-config.mjs';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const { values: args } = parseArgs({
  options: {
    outdir: { type: 'string', default: DEFAULT_OUTDIR },
    sizes: { type: 'string', default: DEFAULT_SIZES.join(',') },
    'validate-only': { type: 'boolean', default: false },
    'no-overwrite': { type: 'boolean', default: false },
  },
  strict: true,
});

const OUTDIR = resolve(args.outdir);
const SIZES = args.sizes.split(',').map(Number);
const VALIDATE_ONLY = args['validate-only'];
const NO_OVERWRITE = args['no-overwrite'];
const CACHE_DIR = join(OUTDIR, '.cache');

// ---------------------------------------------------------------------------
// Load ROLE_SPECS from game-engine dist (pre-built JS)
// ---------------------------------------------------------------------------
async function loadRoleSpecs() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const specsModule = await import(
    resolve(scriptDir, '../packages/game-engine/dist/models/roles/spec/specs.js')
  );
  return Object.entries(specsModule.ROLE_SPECS).map(([id, spec]) => ({
    id,
    faction: spec.faction,
    displayName: spec.displayName,
  }));
}

// ---------------------------------------------------------------------------
// Build download URL from EMOJI_MAP entry
// ---------------------------------------------------------------------------
function getFluentUrl([folder, fileName, hasSkinTone]) {
  const encodedFolder = encodeURIComponent(folder);
  if (hasSkinTone) {
    return `${FLUENT_BASE_URL}/${encodedFolder}/Default/3D/${fileName}_3d_default.png`;
  }
  return `${FLUENT_BASE_URL}/${encodedFolder}/3D/${fileName}_3d.png`;
}

// ---------------------------------------------------------------------------
// Download with cache
// ---------------------------------------------------------------------------
async function downloadEmoji(roleId, mapEntry) {
  const url = getFluentUrl(mapEntry);
  const cacheFile = join(CACHE_DIR, `${roleId}.png`);

  if (existsSync(cacheFile)) {
    return readFileSync(cacheFile);
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cacheFile, buffer);
  return buffer;
}

// ---------------------------------------------------------------------------
// Resize emoji to target size (no frame/background)
// ---------------------------------------------------------------------------
async function resizeEmoji(emojiBuffer, targetSize) {
  return sharp(emojiBuffer)
    .resize(targetSize, targetSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function validate(roles) {
  const errors = [];

  // 1. Every role has an emoji mapping
  const missingMapping = roles.filter((r) => !EMOJI_MAP[r.id]);
  for (const r of missingMapping) {
    errors.push(
      `MISSING_MAPPING: Role "${r.id}" (${r.displayName}) has no entry in EMOJI_MAP. ` +
        `Add \`${r.id}: ['FolderName', 'file_name', false]\` to badge-config.mjs.`,
    );
  }

  // 2. Validate sizes
  for (const s of SIZES) {
    if (!Number.isInteger(s) || s < 16 || s > 1024) {
      errors.push(`INVALID_SIZE: "${s}" is not a valid size (must be integer 16-1024).`);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const startTime = Date.now();
  console.log('🎨 Badge Generator (Fluent Emoji 3D) — loading roles...');

  const roles = await loadRoleSpecs();
  console.log(`   Found ${roles.length} roles in ROLE_SPECS`);

  // Validate
  const errors = validate(roles);
  if (errors.length > 0) {
    console.error('\n❌ Validation failed:\n');
    for (const e of errors) console.error(`   • ${e}`);
    process.exit(1);
  }
  console.log('   ✅ Mapping validation passed');

  if (VALIDATE_ONLY) {
    // Also check URLs are reachable
    console.log('   Checking download URLs...');
    let urlFails = 0;
    for (const role of roles) {
      const entry = EMOJI_MAP[role.id];
      if (!entry) continue;
      const url = getFluentUrl(entry);
      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (!res.ok) {
          console.error(`   ❌ ${role.id}: HTTP ${res.status} — ${url}`);
          urlFails++;
        } else {
          console.log(`   ✅ ${role.id}`);
        }
      } catch (e) {
        console.error(`   ❌ ${role.id}: ${e.message}`);
        urlFails++;
      }
    }
    if (urlFails > 0) {
      console.error(`\n${urlFails} URL(s) failed. Fix EMOJI_MAP entries.`);
      process.exit(1);
    }
    console.log('\n--validate-only: all URLs reachable. Exiting.');
    process.exit(0);
  }

  // Prepare output directories
  const pngDirs = Object.fromEntries(SIZES.map((s) => [s, join(OUTDIR, 'png', String(s))]));
  for (const dir of Object.values(pngDirs)) mkdirSync(dir, { recursive: true });

  // Generate
  const manifest = {};
  const report = { generatedAt: new Date().toISOString(), success: [], skipped: [], errors: [] };

  for (const role of roles) {
    const pngFileName = `role_${role.id}.png`;
    const firstPngPath = join(pngDirs[SIZES[0]], pngFileName);

    if (NO_OVERWRITE && existsSync(firstPngPath)) {
      report.skipped.push(role.id);
      console.log(`   ⏭  ${role.id} (skipped, already exists)`);
      manifest[role.id] = {
        displayName: role.displayName,
        faction: role.faction,
        png: Object.fromEntries(SIZES.map((s) => [s, `png/${s}/${pngFileName}`])),
      };
      continue;
    }

    try {
      // Download emoji
      const emojiBuffer = await downloadEmoji(role.id, EMOJI_MAP[role.id]);

      // Resize to each target size (no frame, pure emoji)
      for (const size of SIZES) {
        const badge = await resizeEmoji(emojiBuffer, size);
        const pngPath = join(pngDirs[size], pngFileName);
        writeFileSync(pngPath, badge);
      }

      manifest[role.id] = {
        displayName: role.displayName,
        faction: role.faction,
        png: Object.fromEntries(SIZES.map((s) => [s, `png/${s}/${pngFileName}`])),
      };

      report.success.push(role.id);
      console.log(`   ✅ ${role.id} (${role.displayName})`);
    } catch (err) {
      report.errors.push({ roleId: role.id, error: err.message });
      console.error(`   ❌ ${role.id}: ${err.message}`);
    }
  }

  // Write manifest
  writeFileSync(join(OUTDIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

  // Write report
  report.duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
  report.totalRoles = roles.length;
  report.sizes = SIZES;
  writeFileSync(join(OUTDIR, 'report.json'), JSON.stringify(report, null, 2), 'utf-8');

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Total roles:  ${roles.length}`);
  console.log(`   Generated:    ${report.success.length}`);
  console.log(`   Skipped:      ${report.skipped.length}`);
  console.log(`   Errors:       ${report.errors.length}`);
  console.log(`   PNG sizes:    ${SIZES.join(', ')}px`);
  console.log(`   Output:       ${OUTDIR}`);
  console.log(`   Duration:     ${report.duration}`);

  if (report.errors.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
