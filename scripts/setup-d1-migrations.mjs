#!/usr/bin/env node
/**
 * CI-only: Apply D1 migrations before E2E tests.
 *
 * Runs as a dedicated GitHub Actions step (not buried inside the Playwright
 * webServer) so migration failures are visible and fail fast, instead of
 * hanging the "Run E2E tests" step with no clear cause.
 *
 * The Playwright webServer still calls setup-e2e-api.mjs (which is idempotent),
 * but by then the migrations are already applied.
 */

import { applyD1Migrations } from './lib/devConfig.mjs';

applyD1Migrations();
