import { type Page, type TestInfo } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import {
  isNightEnded,
  nightButton,
  readRoomPhase,
  readRoomStep,
  tryClickAdvanceButton,
} from '../helpers/night-driver';

/**
 * NightFlowPage — the generic night runner.
 *
 * Drives a werewolf night to its end without role-specific choices: every
 * page presses its open alert's primary button, then its advance night
 * buttons (status, hunter status, skip), and each wolf casts one empty
 * vote. Detection reads the room header's phase and step anchors and the
 * night buttons' test ids, never display copy.
 *
 * It does NOT assert specific role actions (that is the engine
 * integration tests' job). It only verifies the night runs to completion.
 */

interface NightFlowResult {
  /** The room phase the night ended into (Day or Ended). */
  readonly phase: string;
  /** The night steps observed on the first page, in order. */
  readonly stepLog: readonly string[];
}

interface NightFlowState {
  readonly wolfVotedPages: Set<number>;
  readonly stepLog: string[];
}

/** A night with no click and no step change for this long is stuck. */
const NO_PROGRESS_LIMIT_MS = 45_000;

/** Advance one page by one click; wolves cast a single empty vote. */
async function advancePage(page: Page, pageIndex: number, state: NightFlowState): Promise<boolean> {
  if (await tryClickAdvanceButton(page, ` runner-P${pageIndex}`)) return true;
  if (state.wolfVotedPages.has(pageIndex)) return false;
  const emptyVote = nightButton(page, 'wolfEmpty');
  if (!(await emptyVote.isVisible().catch(() => false))) return false;
  await emptyVote.click();
  state.wolfVotedPages.add(pageIndex);
  return true;
}

async function captureAnchors(pages: Page[]): Promise<string> {
  const parts: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const phase = await readRoomPhase(page);
    const step = await readRoomStep(page);
    const hasAlert = await page
      .getByTestId(TESTIDS.alertModal)
      .isVisible()
      .catch(() => false);
    parts.push(`P${i}=${phase ?? '?'}/${step ?? '-'}${hasAlert ? '+alert' : ''}`);
  }
  return parts.join(' ');
}

async function maybeTakeAllScreenshots(
  pages: Page[],
  testInfo: TestInfo,
  iteration: number,
  interval: number,
): Promise<void> {
  if (iteration % interval !== 0) return;
  for (let i = 0; i < pages.length; i++) {
    const shot = await pages[i]!.screenshot();
    await testInfo.attach(`night-iter-${iteration}-page-${i}.png`, {
      body: shot,
      contentType: 'image/png',
    });
  }
}

/**
 * Sweep every page until the night ends or `timeoutMs` passes. Returns the
 * end phase and observed steps, or null when the time ran out first.
 *
 * @throws {Error} When nothing advanced and the step stayed put for
 *   NO_PROGRESS_LIMIT_MS.
 */
export async function runNightFlowFor(
  pages: Page[],
  testInfo: TestInfo,
  opts: { readonly timeoutMs: number; readonly screenshotInterval?: number },
): Promise<NightFlowResult | null> {
  const { timeoutMs, screenshotInterval = 5 } = opts;
  const primaryPage = pages[0]!;
  const state: NightFlowState = { wolfVotedPages: new Set(), stepLog: [] };
  const deadline = Date.now() + timeoutMs;
  let lastProgressAt = Date.now();

  for (let iteration = 1; Date.now() < deadline; iteration++) {
    if (await isNightEnded(primaryPage)) {
      const phase = await readRoomPhase(primaryPage);
      if (phase === null) throw new Error('Night ended but the phase anchor is gone');
      return { phase, stepLog: state.stepLog };
    }

    const step = await readRoomStep(primaryPage);
    if (step !== null && state.stepLog.at(-1) !== step) {
      state.stepLog.push(step);
      lastProgressAt = Date.now();
    }

    await maybeTakeAllScreenshots(
      pages,
      testInfo,
      iteration,
      iteration <= 3 ? 1 : screenshotInterval,
    );

    for (let i = 0; i < pages.length; i++) {
      if (await advancePage(pages[i]!, i, state)) {
        lastProgressAt = Date.now();
        break;
      }
    }

    if (Date.now() - lastProgressAt > NO_PROGRESS_LIMIT_MS) {
      throw new Error(
        `FAIL-FAST: Night made no progress for ${NO_PROGRESS_LIMIT_MS}ms. ${await captureAnchors(pages)}`,
      );
    }
    await primaryPage.waitForTimeout(300);
  }
  return null;
}

/** Wall-clock budget for a full night (measured: full night cases run 1.7–1.8 min). */
const NIGHT_TIMEOUT_MS = 150_000;

/**
 * Run the night flow until the night ends.
 *
 * @throws {Error} When the night does not end within NIGHT_TIMEOUT_MS, or
 *   makes no progress (see runNightFlowFor).
 */
export async function runNightFlowLoop(
  pages: Page[],
  testInfo: TestInfo,
  opts: { readonly screenshotInterval?: number } = {},
): Promise<NightFlowResult> {
  const result = await runNightFlowFor(pages, testInfo, {
    timeoutMs: NIGHT_TIMEOUT_MS,
    ...opts,
  });
  if (result === null) {
    throw new Error(
      `FAIL-FAST: Night did not complete within ${NIGHT_TIMEOUT_MS}ms. ${await captureAnchors(pages)}`,
    );
  }
  return result;
}
