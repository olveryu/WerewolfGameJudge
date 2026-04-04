#!/usr/bin/env node
/**
 * E2E API Setup — Pre-flight for wrangler dev
 *
 * Runs BEFORE wrangler dev starts (chained via &&).
 * 1. Apply D1 migrations to local SQLite
 * 2. Write .dev.vars (JWT_SECRET for local auth)
 *
 * Used by: playwright.config.ts webServer[0].command
 */

import { applyD1Migrations, writeDevVars } from './lib/devConfig.mjs';

applyD1Migrations();
writeDevVars();
