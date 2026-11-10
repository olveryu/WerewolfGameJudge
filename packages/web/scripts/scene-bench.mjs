// Scene-layer benchmark (docs/web-client-rewrite.md §8.2 P0, §9).
//
// Builds nothing: run `pnpm --filter @game-judge/web build` first. Serves dist with
// `vite preview`, opens /__bench/scene in Chromium at a phone viewport, records a
// performance trace, and prints, for each frame cap:
//   - mainThreadBusyRatio: share of wall time the renderer main thread spent in tasks
//   - animationFrameCallbackMs p50 / p95: duration of each requestAnimationFrame callback, i.e.
//     the PixiJS tick (sampling plus WebGL submission); ticks skipped by the frame cap are ~0
// Desktop numbers are relative regression signals only; absolute budgets are judged on devices.
// Pass --headed to use the machine's GPU instead of headless software GL.
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { URL } from 'node:url';

import { chromium } from '@playwright/test';
import { preview } from 'vite';

const packageDirectory = path.resolve(import.meta.dirname, '..');
const WARMUP_MS = 2000;
const TRACE_MS = 10000;
const FRAME_RATES = [60, 30];
const PHONE_VIEWPORT = { width: 390, height: 844 };

function percentile(sortedValues, fraction) {
  const index = Math.min(sortedValues.length - 1, Math.floor(sortedValues.length * fraction));
  return sortedValues[index];
}

/** Picks the renderer main thread that ran the animation frames. */
function findSceneThread(events) {
  const counts = new Map();
  for (const event of events) {
    if (event.name !== 'FireAnimationFrame') continue;
    const key = `${event.pid}:${event.tid}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const [busiest] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!busiest) {
    throw new Error('Trace has no FireAnimationFrame events: the scene never animated');
  }
  return busiest[0];
}

function summarise(trace) {
  const events = trace.traceEvents;
  const threadKey = findSceneThread(events);
  const onThread = events.filter((event) => `${event.pid}:${event.tid}` === threadKey);
  const taskMicros = onThread
    .filter((event) => event.name === 'ThreadControllerImpl::RunTask' && event.ph === 'X')
    .reduce((sum, event) => sum + event.dur, 0);
  const callbackMillis = onThread
    .filter((event) => event.name === 'FireAnimationFrame' && event.ph === 'X')
    .map((event) => event.dur / 1000)
    .sort((a, b) => a - b);
  return {
    mainThreadBusyRatio: Number((taskMicros / (TRACE_MS * 1000)).toFixed(3)),
    animationFrameCallbackMs: {
      p50: Number(percentile(callbackMillis, 0.5).toFixed(2)),
      p95: Number(percentile(callbackMillis, 0.95).toFixed(2)),
    },
  };
}

const headed = process.argv.includes('--headed');
const server = await preview({ root: packageDirectory, preview: { port: 4317, strictPort: true } });
const browser = await chromium.launch({ headless: !headed });
try {
  const baseUrl = server.resolvedUrls?.local[0];
  if (!baseUrl) throw new Error('vite preview did not report a local URL');
  const results = {};
  for (const frameRate of FRAME_RATES) {
    const page = await browser.newPage({ viewport: PHONE_VIEWPORT, deviceScaleFactor: 2 });
    const session = await page.context().newCDPSession(page);
    // Keep the page treated as focused so Chromium does not throttle its frames.
    await session.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await page.goto(new URL(`__bench/scene?fps=${frameRate}`, baseUrl).href);
    await page.locator('canvas.scene-canvas').waitFor({ state: 'attached' });
    await delay(WARMUP_MS);
    await browser.startTracing(page, { categories: ['toplevel', 'devtools.timeline'] });
    await delay(TRACE_MS);
    const trace = JSON.parse((await browser.stopTracing()).toString('utf8'));
    results[`fps${frameRate}`] = summarise(trace);
    await page.close();
  }
  process.stdout.write(`${JSON.stringify({ headed, traceMs: TRACE_MS, results }, null, 2)}\n`);
} finally {
  await browser.close();
  await server.close();
}
