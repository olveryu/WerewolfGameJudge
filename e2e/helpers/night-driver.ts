import { expect, type Locator, type Page } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { RoomPage } from '../pages/RoomPage';
import { alertPrimaryButton, pressAlertButton, readAlertText } from './alerts';
import type { CapturedRole } from './multi-player';
import { ensureConnected } from './waits';

/**
 * Night Driver — role-aware night flow helpers.
 *
 * Shared utilities for E2E tests that need to drive specific role actions
 * during the night phase, verify reveal dialogs, and check death outcomes.
 * Provides role lookup, seat click, advance buttons, poll loops, and wolf vote
 * driving. Does not modify game state directly or import services/models.
 */

// ---------------------------------------------------------------------------
// Action logger — prints every E2E action with timestamp for debugging
// ---------------------------------------------------------------------------

function pageId(page: Page, allPages?: Page[]): string {
  if (allPages) {
    const idx = allPages.indexOf(page);
    if (idx !== -1) return `P${idx}`;
  }
  // Fallback: use last 4 chars of page URL hash
  const url = page.url();
  return `P(${url.slice(-20)})`;
}

/** Log an E2E action. Uses console.log (E2E tooling, not app code). */
// eslint-disable-next-line no-console
const log = (msg: string) => console.log(`[night-driver ${Date.now()}] ${msg}`);

// ---------------------------------------------------------------------------
// Time budgets — every wait is a wall-clock deadline, every click capped
// ---------------------------------------------------------------------------

/**
 * Per-click cap. A click that cannot complete (element covered, page
 * mid-transition) must fail within seconds and let the caller move on;
 * an uncapped click once blocked a night spec for four minutes while
 * the game was healthy (the click's actionability check never passed
 * and nothing ever timed it out).
 */
const CLICK_TIMEOUT_MS = 5_000;
/** Confirm dialogs can trail a slow broadcast; the window is generous. */
const CONFIRM_TIMEOUT_MS = 10_000;
/** Poll cadence for the deadline loops below. */
const POLL_INTERVAL_MS = 300;
/** Heartbeat cadence: long waits report every page's anchors. */
const HEARTBEAT_INTERVAL_MS = 15_000;
/** Default budget for step waits (measured: full night cases run 1.7–1.8 min). */
const DEFAULT_STEP_WAIT_MS = 120_000;
/** Default budget for the wolf-step wait inside the vote drivers. */
const WOLF_STEP_WAIT_MS = 30_000;

// ---------------------------------------------------------------------------
// Role lookup
// ---------------------------------------------------------------------------

/** Find the page index for a given role displayName. Returns -1 if not found. */
export function findRolePageIndex(roleMap: Map<number, CapturedRole>, roleName: string): number {
  for (const [idx, info] of roleMap) {
    if (info.displayName === roleName) return idx;
  }
  return -1;
}

/** Find ALL page indices for a given role displayName. */
export function findAllRolePageIndices(
  roleMap: Map<number, CapturedRole>,
  roleName: string,
): number[] {
  const indices: number[] = [];
  for (const [idx, info] of roleMap) {
    if (info.displayName === roleName) indices.push(idx);
  }
  return indices;
}

// ---------------------------------------------------------------------------
// UI reading
// ---------------------------------------------------------------------------

/**
 * Read the shell phase anchor: the game's current phase, verbatim from
 * the shell header's `data-phase` attribute (see RoomShellModel.phase).
 */
export async function readRoomPhase(page: Page): Promise<string | null> {
  return page
    .getByTestId(TESTIDS.roomHeader)
    .getAttribute('data-phase', { timeout: 200 })
    .catch(() => null);
}

/**
 * Read the shell step anchor: the game's current step inside its phase,
 * verbatim from the shell header's `data-step` attribute (see
 * RoomShellModel.step). Null when the game has no step in its current
 * phase (the attribute is absent then).
 */
export async function readRoomStep(page: Page): Promise<string | null> {
  return page
    .getByTestId(TESTIDS.roomHeader)
    .getAttribute('data-step', { timeout: 200 })
    .catch(() => null);
}

/** One heartbeat line: every page's (phase, step) anchors. */
async function logHeartbeat(pages: Page[], waitingFor: string): Promise<void> {
  const parts: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    const phase = await readRoomPhase(pages[i]!);
    const step = await readRoomStep(pages[i]!);
    parts.push(`P${i}=${phase ?? '?'}/${step ?? '-'}`);
  }
  log(`heartbeat waitingFor=${waitingFor} ${parts.join(' ')}`);
}

/**
 * Click with the shared cap; a failed click is logged, never thrown, so
 * a stuck element degrades to a missed sweep instead of a hung test.
 */
async function clickCapped(locator: Locator, label: string): Promise<boolean> {
  try {
    await locator.click({ timeout: CLICK_TIMEOUT_MS });
    return true;
  } catch {
    log(`clickCapped — "${label}" did not complete within ${CLICK_TIMEOUT_MS}ms`);
    return false;
  }
}

/** Phases in which a werewolf night is over: day has broken or the game ended. */
const NIGHT_END_PHASES: ReadonlySet<string> = new Set(['Day', 'Ended']);

/**
 * A night has ended when the room's authoritative phase has left the
 * night. This reads the phase anchor — never display copy — so copy
 * redesigns cannot silently break night-end detection (they did once:
 * the host's Ended guide sentence carried the keyword the old text scan
 * depended on, and removing the sentence stalled every night spec while
 * the games themselves completed normally).
 */
export async function isNightEnded(page: Page): Promise<boolean> {
  const phase = await readRoomPhase(page);
  return phase !== null && NIGHT_END_PHASES.has(phase);
}

/**
 * A werewolf night step button, by its button spec key (see buildNightButtons):
 * skip, wolfEmpty, wolfCancel, save, confirm, groupConfirmAck, viewHunterStatus,
 * multiConfirm, chooseCard.
 */
export function nightButton(page: Page, key: string): Locator {
  return page.getByTestId(TESTIDS.werewolfNightButton(key));
}

/** The open alert dialog. */
function alertModal(page: Page): Locator {
  return page.getByTestId(TESTIDS.alertModal);
}

/** Wait for a two-button confirm alert and press its 确定 button. */
async function pressConfirm(page: Page): Promise<void> {
  const confirm = page.getByTestId(TESTIDS.alertButton(1));
  await expect(confirm).toHaveText('确定', { timeout: CONFIRM_TIMEOUT_MS });
  await confirm.click({ timeout: CLICK_TIMEOUT_MS });
}

// ---------------------------------------------------------------------------
// Seat interaction
// ---------------------------------------------------------------------------

/**
 * Click a seat tile and confirm via alert. Returns true if confirmed.
 *
 * One bounded re-click is allowed when the confirm dialog never
 * appeared AND the room step has not moved: for single-target steps a
 * seat click only opens the confirm dialog (a fresh dialog replaces
 * the previous one; the submission itself is guarded against
 * duplicates), so a re-click cannot double-submit. If the step HAS
 * moved, the click landed and something else went wrong — fail
 * instead of clicking into the next step. Multi-target (draft) steps
 * do not use this helper.
 */
export async function clickSeatAndConfirm(page: Page, seatIdx: number): Promise<boolean> {
  log(`clickSeatAndConfirm seat=${seatIdx}`);
  // Dismiss any existing alert (e.g. "夜间行动" action prompt) before clicking
  await dismissAlert(page);

  const stepBefore = await readRoomStep(page);
  const tile = page.getByTestId(TESTIDS.seatTilePressable(seatIdx));
  await tile.waitFor({ state: 'visible', timeout: CLICK_TIMEOUT_MS });

  const confirmButton = page.getByTestId(TESTIDS.alertButton(1));
  let appeared = false;
  for (let attempt = 0; attempt < 2 && !appeared; attempt++) {
    if (!(await clickCapped(tile, `seat tile ${seatIdx}`))) return false;
    log(`clickSeatAndConfirm seat=${seatIdx} — tile clicked (attempt ${attempt + 1})`);
    appeared = await confirmButton
      .waitFor({ state: 'visible', timeout: CONFIRM_TIMEOUT_MS })
      .then(() => true)
      .catch(() => false);
    if (!appeared) {
      const stepNow = await readRoomStep(page);
      if (stepNow !== stepBefore) {
        log(
          `clickSeatAndConfirm seat=${seatIdx} — step moved ${stepBefore} -> ${stepNow} without a confirm dialog; not retrying`,
        );
        return false;
      }
      log(`clickSeatAndConfirm seat=${seatIdx} — no confirm alert appeared, step unchanged`);
    }
  }
  if (!appeared) return false;

  await expect(confirmButton).toHaveText('确定');
  if (!(await clickCapped(confirmButton, 'seat confirm'))) return false;
  log(`clickSeatAndConfirm seat=${seatIdx} — confirmed`);
  // Confirm dialogs have two buttons; the reveal or info alerts that may follow
  // have one. Once the second button is gone, the confirm dialog is processed.
  await confirmButton.waitFor({ state: 'hidden', timeout: CLICK_TIMEOUT_MS });
  return true;
}

/**
 * Drive a multi-seat selection step: toggle each target seat (a toggle opens no
 * dialog; the confirm button's count follows each one), then press the
 * multiConfirm button labelled `confirmLabel` (e.g. '确认催眠（2人）') and
 * confirm its alert.
 */
export async function driveMultiSelect(
  page: Page,
  targetSeats: readonly number[],
  confirmLabel: string,
): Promise<void> {
  await dismissAlert(page);
  const confirmButton = nightButton(page, 'multiConfirm');
  for (const [selectedCount, seat] of targetSeats.entries()) {
    await page.getByTestId(TESTIDS.seatTilePressable(seat)).click({ timeout: CLICK_TIMEOUT_MS });
    await expect(confirmButton).toContainText(`（${selectedCount + 1}人）`);
  }
  await expect(confirmButton).toHaveText(confirmLabel);
  await confirmButton.click({ timeout: CLICK_TIMEOUT_MS });
  await pressConfirm(page);
}

/** Select and confirm the first enabled card inside the bottom-card modal. */
export async function chooseFirstEnabledBottomCard(page: Page): Promise<string> {
  const modal = page.getByTestId(TESTIDS.chooseBottomCardModal);
  await modal.waitFor({ state: 'visible', timeout: 5000 });

  for (let cardIndex = 0; ; cardIndex++) {
    const option = modal.getByTestId(TESTIDS.chooseBottomCardOption(cardIndex));
    if ((await option.count()) === 0) break;
    if (!(await option.isEnabled())) continue;

    const selectedText = await option.textContent();
    if (selectedText === null || selectedText.trim().length === 0) {
      throw new Error(`Bottom-card option ${cardIndex} has no accessible text`);
    }
    const selectedName = selectedText.trim();
    await option.click({ timeout: CLICK_TIMEOUT_MS });
    await pressConfirm(page);
    return selectedName;
  }

  throw new Error('Bottom-card modal has no enabled option');
}

// ---------------------------------------------------------------------------
// Advance buttons
// ---------------------------------------------------------------------------

/**
 * Night buttons a sweep may press to move a step along: open a status
 * dialog, view the hunter status, or skip the step.
 */
const ADVANCE_BUTTON_KEYS = ['confirm', 'viewHunterStatus', 'skip'] as const;

/**
 * Try to advance one page by one click: the open alert's primary button
 * first, then the first visible advance night button.
 * Returns true if a button was clicked.
 */
export async function tryClickAdvanceButton(page: Page, label?: string): Promise<boolean> {
  const tag = label ?? '';
  if (
    await alertModal(page)
      .isVisible()
      .catch(() => false)
  ) {
    const primary = await alertPrimaryButton(page);
    if (await clickCapped(primary, 'advance alert')) {
      log(`tryClickAdvanceButton${tag} — alert primary clicked`);
      return true;
    }
    return false;
  }

  for (const key of ADVANCE_BUTTON_KEYS) {
    const button = nightButton(page, key);
    if (await button.isVisible().catch(() => false)) {
      if (await clickCapped(button, `advance night button ${key}`)) {
        log(`tryClickAdvanceButton${tag} — night button ${key} clicked`);
        return true;
      }
      return false;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Poll / wait helpers
// ---------------------------------------------------------------------------

/**
 * Generic poll loop: advance night on all pages until condition is met
 * or the deadline passes. Uses simple skip-all strategy (clicks advance
 * buttons, no seat selection). Returns whether the condition was met.
 */
async function pollUntil(
  pages: Page[],
  condition: () => Promise<boolean>,
  timeoutMs = DEFAULT_STEP_WAIT_MS,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let lastHeartbeat = 0;
  for (;;) {
    if (await condition()) return true;
    if (Date.now() >= deadline) return false;
    if (Date.now() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
      lastHeartbeat = Date.now();
      await logHeartbeat(pages, 'pollUntil');
    }
    await ensureConnected(pages);
    for (const page of pages) {
      const pIdx = pages.indexOf(page);
      await tryClickAdvanceButton(page, ` poll-P${pIdx}`);
    }
    // Poll cadence for retry loop
    await pages[0]!.waitForTimeout(POLL_INTERVAL_MS);
  }
}

/**
 * Wait until a page's room reaches the given night step, polling the
 * step anchor. Returns false when the deadline passes.
 */
export async function waitForRoomStep(
  page: Page,
  stepId: string,
  timeoutMs = WOLF_STEP_WAIT_MS,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if ((await readRoomStep(page)) === stepId) return true;
    if (Date.now() >= deadline) return false;
    await page.waitForTimeout(POLL_INTERVAL_MS);
  }
}

/** Cap for observing one step's prompt cycle before proceeding anyway. */
const PROMPT_CYCLE_CAP_MS = 20_000;

/**
 * Driver-observed night counter. The room anchors expose no night
 * number, and pages are reused across nights within a test, so a memo
 * keyed on phase/step alone would false-hit on the next night (every
 * night has the same phases and steps). Waits that observe a night
 * end advance the epoch; memos from earlier nights stop matching.
 */
let nightEpoch = 0;
const noteNightEnded = (): void => {
  nightEpoch += 1;
};

/**
 * Per-page memo of step instances whose prompt cycle already fired:
 * page -> "epoch/phase/step" key. Reset implicitly when the key changes.
 */
const promptCycleSeen = new WeakMap<Page, string>();

/**
 * Wait for the acting page's step-prompt cycle to fire.
 *
 * Why this exists (all in client code): seat taps are policy NOOPs
 * while step audio plays (interaction policy reason 'audio_playing';
 * the tap only toasts). The step's prompt dialog is auto-triggered
 * only once audio ends, and the alert slot is single with
 * replace-on-call semantics (src/utils/alert.ts) — so the prompt's
 * arrival is the client-visible signal that the audio gate lifted
 * and the page will actually process a seat tap. The old keyword
 * waits returned after the prompt text rendered, implicitly waiting
 * out the audio; the step anchor flips earlier, so the cycle is
 * observed explicitly here.
 *
 * Observe only — the prompt is NOT dismissed (callers dismiss as
 * their first step, and blocked-step specs read the prompt itself).
 * A cycle counts as fired on any modal transition after the step
 * matched: none -> some, some -> none, or the modal's text changing
 * (a fresh prompt replacing a leftover dialog). If no transition is
 * observed within the cap (sampling pages that never get a prompt,
 * actors whose prompt fired before the wait started), the wait
 * proceeds anyway and logs it — never worse than not waiting.
 */
export async function waitForPromptCycle(
  page: Page,
  stepId: string,
  deadlineMs: number,
): Promise<boolean> {
  const key = `${nightEpoch}/${(await readRoomPhase(page)) ?? '?'}/${stepId}`;
  if (promptCycleSeen.get(page) === key) return true;

  const cap = Math.min(deadlineMs, Date.now() + PROMPT_CYCLE_CAP_MS);
  const modal = alertModal(page);
  const sample = async (): Promise<string | null> => {
    const visible = await modal.isVisible().catch(() => false);
    if (!visible) return null;
    return (await modal.textContent({ timeout: 200 }).catch(() => '')) ?? '';
  };
  const initial = await sample();
  for (;;) {
    if ((await readRoomStep(page)) !== stepId) return false;
    const now = await sample();
    if (now !== initial) {
      promptCycleSeen.set(page, key);
      log(`waitForPromptCycle — prompt cycle fired for step ${stepId}`);
      return true;
    }
    if (Date.now() >= cap) {
      log(`waitForPromptCycle — no prompt transition observed for step ${stepId}; proceeding`);
      return true;
    }
    await page.waitForTimeout(POLL_INTERVAL_MS);
  }
}

/**
 * waitForRoomStep + waitForPromptCycle: the step has been reached AND
 * the page's audio gate has lifted (its step prompt fired), so the
 * next interaction is actually processed instead of policy-NOOPed.
 */
export async function waitForStepAndSettle(
  page: Page,
  stepId: string,
  timeoutMs = WOLF_STEP_WAIT_MS,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  if (!(await waitForRoomStep(page, stepId, timeoutMs))) return false;
  return waitForPromptCycle(page, stepId, deadline);
}

/** Budget for the host's audio ack (the night-end clip alone runs ~7.6s). */
const AUDIO_ACK_WAIT_MS = 30_000;

/**
 * Wait until the host page's audio ack for the currently playing
 * announcement batch has been committed by the server.
 *
 * Why this exists: terminal commands (return to lobby / redeal /
 * abort) are rejected by the engine while audio plays
 * (forbidden_while_audio_playing), and the client submits them once
 * with no retry — a click inside the announcement window strands the
 * room behind a failure alert. The step-scoped prompt cycle
 * (waitForPromptCycle) cannot observe the night-end announcement:
 * Ended has no step anchor and fires no prompt, and the bottom
 * panel's audio-waiting placeholder exists only in Ongoing. The ack
 * is the anchor instead: the host submits werewolf.audio.ack only
 * after the batch has played in full, and its committed response
 * means the server has cleared isAudioPlaying.
 *
 * Call only when the announcement batch is the one outstanding —
 * i.e. after the phase flip that queued it (a night cannot advance
 * past an un-acked step, so no earlier batch can still be playing).
 *
 * @throws {Error} When no ack is committed within the budget, or the
 *   ack command was not committed.
 */
export async function waitForHostAudioAck(
  hostPage: Page,
  timeoutMs = AUDIO_ACK_WAIT_MS,
): Promise<void> {
  const response = await hostPage.waitForResponse(
    (resp) => {
      const request = resp.request();
      if (new URL(resp.url()).pathname !== '/room/command' || request.method() !== 'POST') {
        return false;
      }
      const body: unknown = request.postDataJSON();
      return (
        typeof body === 'object' &&
        body !== null &&
        'command' in body &&
        typeof body.command === 'object' &&
        body.command !== null &&
        'type' in body.command &&
        body.command.type === 'werewolf.audio.ack'
      );
    },
    { timeout: timeoutMs },
  );
  if (!response.ok()) {
    throw new Error(`Audio ack request failed with HTTP ${response.status()}`);
  }
  const result: unknown = await response.json();
  if (
    typeof result !== 'object' ||
    result === null ||
    !('kind' in result) ||
    result.kind !== 'committed'
  ) {
    throw new Error('Audio ack was not committed by the server');
  }
}

/**
 * Wait for a specific step of the night by reading the role page's step
 * anchor (data-step — the engine's current step, verbatim). Detection
 * binds only the anchor, never display copy: copy may be redesigned
 * freely without stalling night drivers.
 *
 * While waiting, advances other pages' skip buttons so intermediate
 * steps can complete.
 *
 * @param rolePage - The page belonging to the role we're waiting for
 * @param stepId - The night step id to wait for (engine step vocabulary)
 * @param allPages - All pages (used to advance other roles' skip buttons)
 * @param timeoutMs - Wall-clock budget
 * @returns true if the step was reached; false if the night ended first
 *   or the budget ran out
 */
export async function waitForRoleTurn(
  rolePage: Page,
  stepId: string,
  allPages: Page[],
  timeoutMs = DEFAULT_STEP_WAIT_MS,
): Promise<boolean> {
  log(`waitForRoleTurn step=${stepId} rolePage=${pageId(rolePage, allPages)}`);
  const deadline = Date.now() + timeoutMs;
  let lastHeartbeat = 0;
  for (;;) {
    if ((await readRoomStep(rolePage)) === stepId) {
      // The anchor flips while the step's audio is still playing, and
      // seat taps during audio are policy NOOPs. The step prompt
      // fires exactly when the audio gate lifts — wait for its cycle
      // before returning, so the caller's first tap actually lands.
      if (await waitForPromptCycle(rolePage, stepId, deadline)) {
        log(`waitForRoleTurn — step ${stepId} reached, prompt cycle done`);
        return true;
      }
      // The step moved on while waiting for the cycle: fall through
      // to the sweep/cadence below and re-detect next round.
      log(`waitForRoleTurn — step ${stepId} moved on during prompt cycle`);
    }

    if (await isNightEnded(allPages[0]!)) {
      log('waitForRoleTurn — night ended');
      noteNightEnded();
      return false;
    }
    if (Date.now() >= deadline) {
      log(`waitForRoleTurn — timed out after ${timeoutMs}ms waiting for step ${stepId}`);
      return false;
    }
    if (Date.now() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
      lastHeartbeat = Date.now();
      await logHeartbeat(allPages, stepId);
    }

    // Ensure all pages are connected before advancing
    await ensureConnected(allPages);

    // Advance other pages — skip the target role's own page so its own
    // pending step is never skipped past. For other pages, include skip
    // buttons to advance past intermediate roles (e.g. seer before
    // gargoyle).
    for (const p of allPages) {
      if (p === rolePage) continue;
      const pIdx = allPages.indexOf(p);
      await tryClickAdvanceButton(p, ` P${pIdx}`);
    }
    // Poll cadence for retry loop
    await allPages[0]!.waitForTimeout(POLL_INTERVAL_MS);
  }
}

/** Wait for night to end across all pages. */
export async function waitForNightEnd(
  pages: Page[],
  timeoutMs = DEFAULT_STEP_WAIT_MS,
): Promise<boolean> {
  log('waitForNightEnd — start');
  const ended = await pollUntil(
    pages,
    async () => {
      for (const p of pages) {
        if (await isNightEnded(p)) return true;
      }
      return false;
    },
    timeoutMs,
  );
  if (!ended) return false;
  // Every client renders the same broadcast, but the host page's anchor
  // can land a beat after the first page that flipped; give it a brief
  // settle window before reporting.
  for (let i = 0; i < 10; i++) {
    if (await isNightEnded(pages[0]!)) {
      noteNightEnded();
      return true;
    }
    await pages[0]!.waitForTimeout(POLL_INTERVAL_MS);
  }
  return false;
}

/**
 * After night ends, open 昨夜信息 through host management, confirm the
 * 提示 dialog with 确定查看, and return the night-result alert's text
 * (title and message). The alert stays open.
 *
 * The action is disabled while the night-end narration plays (audio
 * playback lock), so wait for the lock to lift before clicking: the
 * button itself is the gate, which holds whether the audio ack
 * already landed or is still in flight.
 */
export async function viewLastNightInfo(hostPage: Page): Promise<string> {
  await dismissAlert(hostPage);
  const panel = await new RoomPage(hostPage).openHostManagement();
  const action = panel.getByTestId(TESTIDS.lastNightInfoButton);
  await expect(action).toBeEnabled({ timeout: AUDIO_ACK_WAIT_MS });
  await action.click();
  await expect(panel).not.toBeVisible();
  await pressAlertButton(hostPage, {
    title: '提示',
    buttonIndex: 1,
    buttonLabel: '确定查看',
    timeout: CONFIRM_TIMEOUT_MS,
  });
  await expect(hostPage.getByTestId(TESTIDS.alertTitle)).toHaveText('昨夜信息');
  return readAlertText(hostPage);
}

// ---------------------------------------------------------------------------
// Wolf voting
// ---------------------------------------------------------------------------

/**
 * Drive all wolves to vote on a specific target seat.
 * Waits for the wolfKill step anchor before each vote (the step is
 * shared by all wolves, so every wolf votes inside the same step).
 *
 * @throws {Error} When the wolf step is not reached or a vote
 *   confirmation is unavailable.
 */
export async function driveWolfVote(
  pages: Page[],
  wolfIndices: number[],
  targetSeat: number,
): Promise<void> {
  log(`driveWolfVote wolfIndices=[${wolfIndices}] targetSeat=${targetSeat}`);
  for (const wIdx of wolfIndices) {
    const wPage = pages[wIdx]!;
    log(`driveWolfVote — P${wIdx} waiting for step wolfKill`);
    if (!(await waitForStepAndSettle(wPage, 'wolfKill'))) {
      throw new Error(`Wolf step not reached for page ${wIdx}`);
    }
    log(`driveWolfVote — P${wIdx} wolfKill reached, clicking seat`);
    if (!(await clickSeatAndConfirm(wPage, targetSeat))) {
      throw new Error(`Wolf vote confirmation failed for page ${wIdx}, target seat ${targetSeat}`);
    }
    log(`driveWolfVote — P${wIdx} vote done`);
  }
}

/**
 * Drive all wolves to vote skip attack (empty kill).
 * Clicks the "放弃袭击" button in the bottom action panel for each wolf.
 */
export async function driveWolfEmptyVote(pages: Page[], wolfIndices: number[]): Promise<void> {
  log(`driveWolfEmptyVote wolfIndices=[${wolfIndices}]`);
  for (const wIdx of wolfIndices) {
    const wPage = pages[wIdx]!;
    log(`driveWolfEmptyVote — P${wIdx} waiting for step wolfKill`);
    if (!(await waitForStepAndSettle(wPage, 'wolfKill'))) {
      throw new Error(`Wolf step not reached for page ${wIdx}`);
    }
    // Dismiss the step prompt before interacting — after the settle,
    // not before: dismissing first would eat the very prompt whose
    // transition the settle observes, stalling it to the cap.
    await dismissAlert(wPage);

    await clickNightButton(wPage, 'wolfEmpty', '放弃袭击');
    await pressConfirm(wPage);
    log(`driveWolfEmptyVote — P${wIdx} confirmed 放弃袭击`);
  }
}

/**
 * Drive all wolves to confirm the kill-disabled empty vote.
 *
 * When the wolf kill is disabled (poisoner override on Night 1, or a
 * nightmare block), the bottom panel shows "确认放弃袭击" instead of
 * the plain "放弃袭击" button that driveWolfEmptyVote clicks, and the
 * step prompt explains the kill is impossible. Callers must run
 * waitForRoleTurn for 'wolfKill' first, as with the other wolf-vote
 * drivers: this helper assumes the step is active on every page.
 */
export async function driveWolfDisabledEmptyVote(
  pages: Page[],
  wolfIndices: number[],
): Promise<void> {
  log(`driveWolfDisabledEmptyVote wolfIndices=[${wolfIndices}]`);
  for (const wIdx of wolfIndices) {
    const wPage = pages[wIdx]!;
    await clickNightButton(wPage, 'wolfEmpty', '确认放弃袭击');
    await pressConfirm(wPage);
    log(`driveWolfDisabledEmptyVote — P${wIdx} confirmed 确认放弃袭击`);
  }
}

// ---------------------------------------------------------------------------
// Reveal dialog
// ---------------------------------------------------------------------------

/**
 * Dismiss the open alert, if any, by pressing its primary button.
 *
 * Does NOT wait for the modal to close — callers rely on Playwright's
 * built-in actionability checks (inert attribute) for subsequent interactions
 * with elements inside #root.
 */
export async function dismissAlert(page: Page): Promise<void> {
  if (
    !(await alertModal(page)
      .isVisible()
      .catch(() => false))
  )
    return;
  const primary = await alertPrimaryButton(page);
  if (await clickCapped(primary, 'dismiss alert')) {
    log('dismissAlert — primary clicked');
  }
}

/**
 * Wait until a groupConfirm reveal step is active, detected by its
 * status button becoming visible on any page; the button's label must
 * be `statusButtonText` (e.g. '情侣状态', '表白状态').
 *
 * While polling, only dismiss blocking alert modals. Never click
 * bottom-panel action buttons: a click (e.g. '不用技能') would submit
 * a game action on a page whose current step the waiter has not
 * verified. This is the single implementation for groupConfirm
 * reveal waits; the cupid, piper, and wolf-girl specs all use it.
 */
export async function waitForGroupConfirmStep(
  pages: Page[],
  statusButtonText: string,
  maxIterations = 60,
): Promise<boolean> {
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    for (const page of pages) {
      const statusButton = nightButton(page, 'groupConfirmAck');
      if (await statusButton.isVisible().catch(() => false)) {
        await expect(statusButton).toHaveText(statusButtonText);
        return true;
      }
    }
    for (const page of pages) {
      await dismissAlert(page);
    }
    await pages[0]!.waitForTimeout(POLL_INTERVAL_MS);
  }
  return false;
}

/**
 * Drive one player through a groupConfirm reveal acknowledgement:
 * dismiss the step prompt, open the status button, read the personal
 * message, acknowledge it. Returns the personal message text.
 *
 * The ack button text is the reveal step's own confirmButtonText
 * (e.g. '我知道了' for the cupid reveal, '知道了' for piper and
 * wolf-girl reveals). The ack click is unconditional: a missing ack
 * button must fail the test, not pass silently. This is the single
 * implementation for groupConfirm reveal acks; the cupid, piper,
 * and wolf-girl specs all use it.
 */
export async function driveGroupConfirmAck(
  page: Page,
  statusButtonText: string,
  ackButtonText: string,
): Promise<string> {
  await clickNightButton(page, 'groupConfirmAck', statusButtonText);
  const message = await readAlertText(page, 5000);
  const ackButton = page.getByTestId(TESTIDS.alertButton(0));
  await expect(ackButton).toHaveText(ackButtonText);
  await ackButton.click();
  return message;
}

// ---------------------------------------------------------------------------
// Bottom action panel
// ---------------------------------------------------------------------------

/**
 * Dismiss the step prompt, then press a night button after asserting its
 * label. The step prompt opens once the step audio ends, so callers that
 * waited for the role turn always find it open.
 */
export async function clickNightButton(page: Page, key: string, label: string): Promise<void> {
  await dismissAlert(page);
  const button = nightButton(page, key);
  await expect(button).toHaveText(label, { timeout: 10_000 });
  await button.click({ timeout: CLICK_TIMEOUT_MS });
  log(`clickNightButton — ${key} "${label}" clicked`);
}

// ---------------------------------------------------------------------------
// Magician swap (two-target selection)
// ---------------------------------------------------------------------------

/**
 * Drive the magician to swap two seats.
 * Clicks seat1, confirms first target prompt, clicks seat2, confirms swap.
 */
export async function driveMagicianSwap(
  page: Page,
  seat1: number,
  seat2: number,
): Promise<boolean> {
  // Dismiss any existing alert (e.g. "夜间行动") before interacting with seats
  await dismissAlert(page);

  // Click first seat → triggers "已选择第一位玩家" info alert.
  // Draft (toggle) selection: a failed click is reported, never
  // blindly retried — re-clicking a seat would toggle the draft.
  const tile1 = page.getByTestId(TESTIDS.seatTilePressable(seat1));
  await tile1.waitFor({ state: 'visible', timeout: CLICK_TIMEOUT_MS });
  if (!(await clickCapped(tile1, `magician seat ${seat1}`))) return false;

  // Dismiss "已选择第一位玩家" alert before clicking second seat
  await dismissAlert(page);

  // Click second seat → triggers "确认交换" confirm dialog
  const tile2 = page.getByTestId(TESTIDS.seatTilePressable(seat2));
  await tile2.waitFor({ state: 'visible', timeout: CLICK_TIMEOUT_MS });
  if (!(await clickCapped(tile2, `magician seat ${seat2}`))) return false;

  // Confirm the swap alert
  const confirmButton = page.getByTestId(TESTIDS.alertButton(1));
  const appeared = await confirmButton
    .waitFor({ state: 'visible', timeout: CONFIRM_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return false;
  await expect(confirmButton).toHaveText('确定');
  return clickCapped(confirmButton, 'magician swap confirm');
}
