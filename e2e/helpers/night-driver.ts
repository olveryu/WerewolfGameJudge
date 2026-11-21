import { errors, expect, type Locator, type Page } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { RoomPage } from '../pages/RoomPage';
import { dismissCurrentAlert, pressAlertButton, readAlertText } from './alerts';
import type { CommandFrameObservation } from './command-frames';
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
const SWEEP_CLICK_TIMEOUT_MS = 1_000;

/** A required night action failed, with the observed room state and original cause. */
class NightDriverError extends Error {
  constructor(message: string, context: string, cause?: unknown) {
    super(`${message}\n${context}`, { cause });
    this.name = 'NightDriverError';
  }
}

async function roomDiagnostics(pages: Page[]): Promise<string> {
  return (
    await Promise.all(
      pages.map(async (page, index) => {
        const [phase, step, audio, title] = await Promise.all([
          readRoomPhase(page),
          readRoomStep(page),
          page.getByTestId(TESTIDS.audioWaitingMessage).count(),
          page.getByTestId(TESTIDS.alertTitle).allTextContents(),
        ]);
        return `P${index}=${phase ?? '?'}/${step ?? '-'} audio=${audio > 0} alert=${JSON.stringify(title)}`;
      }),
    )
  ).join('\n');
}

async function failNightAction(message: string, pages: Page[], cause?: unknown): Promise<never> {
  const reason = cause instanceof Error ? `: ${cause.message}` : '';
  throw new NightDriverError(`${message}${reason}`, await roomDiagnostics(pages), cause);
}

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
 * Cap a scan click at one second. Actionability timeouts defer the sweep;
 * other failures propagate instead of being silently treated as a missed click.
 */
async function clickCapped(locator: Locator, label: string): Promise<boolean> {
  try {
    await locator.click({ timeout: SWEEP_CLICK_TIMEOUT_MS });
    return true;
  } catch (error) {
    if (!(error instanceof errors.TimeoutError)) throw error;
    log(`sweep deferred — "${label}": ${error.message}`);
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
 * chooseCard.
 */
export function nightButton(page: Page, key: string): Locator {
  return page.getByTestId(TESTIDS.werewolfNightButton(key));
}

async function openActionGroupFor(page: Page, key: string): Promise<void> {
  const entry = nightButton(page, 'openActionGroup');
  if (!(await entry.isVisible())) return;
  const actionIds = (await entry.getAttribute('data-player-action-ids'))?.split(' ') ?? [];
  if (!actionIds.includes(TESTIDS.werewolfNightButton(key))) return;
  await entry.click({ timeout: CLICK_TIMEOUT_MS });
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

/** Tap an enabled seat that produces a notice rather than a submission dialog. */
export async function clickSeatAndReadNotice(
  page: Page,
  seat: number,
  title: string,
): Promise<string> {
  try {
    await dismissAlert(page);
    const tile = page.getByTestId(TESTIDS.seatTilePressable(seat));
    await expect(tile).toHaveAttribute('data-inert', 'false');
    await tile.click({ timeout: CLICK_TIMEOUT_MS });
    return await readAlertText(page, CONFIRM_TIMEOUT_MS, title);
  } catch (error) {
    return failNightAction(`Seat ${seat} notice "${title}" failed`, [page], error);
  }
}

/**
 * Enter selection mode and confirm the chosen target(s). Fixed-size
 * selections open confirmation immediately; variable-size selections use a button.
 */
export async function clickSeatAndConfirm(page: Page, seatIdx: number): Promise<void> {
  await selectAndSubmitSeats(page, [seatIdx]);
}

async function selectAndSubmitSeats(
  page: Page,
  seats: readonly number[],
  expectation?: { readonly actionLabel: string; readonly confirmationTitle: string },
): Promise<void> {
  const stepBefore = await readRoomStep(page);
  try {
    if (stepBefore === null) throw new Error('No active step before seat selection');
    await waitForStepAndSettle(page, stepBefore);
    await dismissAlert(page);
    await openActionGroupFor(page, 'startSeatSelection');
    const room = new RoomPage(page);
    if (await room.hasPanelPlayerAction(TESTIDS.werewolfNightButton('startSeatSelection'))) {
      await room.openHostManagement();
    }
    await nightButton(page, 'startSeatSelection').click({ timeout: CLICK_TIMEOUT_MS });
    for (const seat of seats) {
      const tile = page.getByTestId(TESTIDS.seatTilePressable(seat));
      await expect(tile).toHaveAttribute('data-inert', 'false');
      await tile.click({ timeout: CLICK_TIMEOUT_MS });
      await expect(tile).toHaveAttribute('aria-pressed', 'true');
    }
    const selectionButton = nightButton(page, 'submitSeatSelection');
    const confirmationDialog = alertModal(page);
    await expect
      .poll(
        async () => (await selectionButton.isVisible()) || (await confirmationDialog.isVisible()),
        { timeout: CONFIRM_TIMEOUT_MS },
      )
      .toBe(true);
    if (await selectionButton.isVisible()) {
      if (expectation !== undefined)
        await expect(selectionButton).toContainText(expectation.actionLabel);
      await expect(selectionButton).toContainText(seats.map((seat) => `${seat + 1}号`).join('、'));
      await selectionButton.click({ timeout: CLICK_TIMEOUT_MS });
    }
    await expect(confirmationDialog).toBeVisible({ timeout: CONFIRM_TIMEOUT_MS });
    if (expectation !== undefined) {
      await expect(confirmationDialog.getByTestId(TESTIDS.alertTitle)).toHaveText(
        expectation.confirmationTitle,
      );
    }
    await expect(page.getByTestId(TESTIDS.roomHeader)).toHaveAttribute('data-step', stepBefore);
    await expect(page.getByTestId(TESTIDS.alertMessage)).toContainText(
      seats.map((seat) => `${seat + 1}号`).join('、'),
    );
    await pressConfirm(page);
    log(`seat selection submitted — step=${stepBefore} seats=${seats.join(',')}`);
  } catch (error) {
    return failNightAction(`Seat selection [${seats}] failed in ${stepBefore}`, [page], error);
  }
}

/** Select multiple targets and verify the labelled action before submitting. */
export async function driveMultiSelect(
  page: Page,
  targetSeats: readonly number[],
  actionLabel: string,
  confirmationTitle: string,
): Promise<void> {
  await selectAndSubmitSeats(page, targetSeats, { actionLabel, confirmationTitle });
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
const PANEL_NIGHT_BUTTON_KEYS = new Set(['skip', 'wolfEmpty', 'wolfCancel']);

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
    if (await tryDismissAlert(page)) {
      log(`tryClickAdvanceButton${tag} — alert primary clicked`);
      return true;
    }
    return false;
  }

  for (const key of ADVANCE_BUTTON_KEYS) {
    const button = nightButton(page, key);
    if (await button.isVisible().catch(() => false)) {
      return tryClickNightButton(page, key, tag);
    }
    if (key === 'skip' && (await tryClickNightButton(page, key, tag))) return true;
  }

  return false;
}

/**
 * Discover expanded actions through their DOM declaration, without opening
 * the panel to probe. A declared action must succeed unless it is withdrawn
 * while acting; still-offered actions fail with room diagnostics.
 */
export async function tryClickNightButton(page: Page, key: string, label = ''): Promise<boolean> {
  const step = await readRoomStep(page);
  if (step === null || !(await isStepUnlocked(page, step))) return false;
  const bottomButton = nightButton(page, key);
  if (!(await bottomButton.isVisible()) && !(await alertModal(page).isVisible())) {
    await openActionGroupFor(page, key);
  }
  const room = new RoomPage(page);
  const actionId = TESTIDS.werewolfNightButton(key);
  const isPanelAction =
    PANEL_NIGHT_BUTTON_KEYS.has(key) && (await room.hasPanelPlayerAction(actionId));
  if (isPanelAction) {
    if (await alertModal(page).isVisible()) return false;
    let panel = page.getByTestId(TESTIDS.roomHostManagementPanel);
    try {
      if (!(await panel.isVisible())) panel = await room.openHostManagement();
      if (!(await isStepUnlocked(page, step))) {
        if (await panel.isVisible()) await room.closeHostManagement();
        return false;
      }
      await panel.getByTestId(actionId).click({ timeout: CLICK_TIMEOUT_MS });
    } catch (error) {
      if (await room.hasPanelPlayerAction(actionId)) {
        return failNightAction(`Panel action ${step}/${key} failed`, [page], error);
      }
      const message = error instanceof Error ? error.message : String(error);
      log(`panel action withdrawn — ${step}/${key}: ${message}\n${await roomDiagnostics([page])}`);
      return false;
    }
    await expect(panel).not.toBeVisible({ timeout: CLICK_TIMEOUT_MS });
  } else {
    if (
      !(await bottomButton.isVisible()) ||
      !(await isStepUnlocked(page, step)) ||
      !(await clickCapped(bottomButton, `night button ${key}`))
    ) {
      return false;
    }
  }
  log(`tryClickNightButton${label} — night button ${key} clicked`);
  return true;
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

async function isStepUnlocked(page: Page, stepId: string): Promise<boolean> {
  return (
    (await page.getByTestId(TESTIDS.audioWaitingMessage).count()) === 0 &&
    (await page.getByTestId(TESTIDS.bottomActionPanel).isVisible()) &&
    (await readRoomPhase(page)) === 'Ongoing' &&
    (await readRoomStep(page)) === stepId
  );
}

/** Observe the audio lock, never an unrelated dialog's entrance or exit. */
async function waitForStepUnlock(page: Page, stepId: string, deadlineMs: number): Promise<boolean> {
  for (;;) {
    if ((await readRoomStep(page)) !== stepId) return false;
    if (await isStepUnlocked(page, stepId)) return true;
    if (Date.now() >= deadlineMs) {
      return failNightAction(`Audio lock did not lift for step ${stepId}`, [page]);
    }
    await page.waitForTimeout(POLL_INTERVAL_MS);
  }
}

/**
 * Wait for the requested step and its audio lock to lift.
 */
export async function waitForStepAndSettle(
  page: Page,
  stepId: string,
  timeoutMs = WOLF_STEP_WAIT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  if (!(await waitForRoomStep(page, stepId, timeoutMs))) {
    return failNightAction(`Step ${stepId} not reached within ${timeoutMs}ms`, [page]);
  }
  if (!(await waitForStepUnlock(page, stepId, deadline))) {
    return failNightAction(`Step ${stepId} moved before the audio lock lifted`, [page]);
  }
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
 * room behind a failure alert. The step-scoped audio wait
 * cannot observe the night-end announcement:
 * Ended has no step anchor and fires no prompt, and the bottom
 * panel's audio-waiting placeholder exists only in Ongoing. The ack
 * is the anchor instead: the host submits werewolf.audio.ack only
 * after the batch has played in full, and its committed COMMAND_RESULT
 * means the server has cleared isAudioPlaying.
 *
 * The observation is attached before the host page enters the room
 * (setupNPlayerGame returns it on the setup result): the room socket is
 * created on room entry, and a listener installed later misses it.
 * The wait is for the NEXT ack after this call, like waitForResponse —
 * an ack from an earlier batch does not satisfy it.
 *
 * Call only when the announcement batch is the one outstanding —
 * i.e. after the phase flip that queued it (a night cannot advance
 * past an un-acked step, so no earlier batch can still be playing).
 *
 * @throws {Error} When no ack is committed within the budget, or the
 *   ack command was not committed.
 */
export async function waitForHostAudioAck(
  observation: CommandFrameObservation,
  timeoutMs = AUDIO_ACK_WAIT_MS,
): Promise<void> {
  const frame = await observation.waitForCommand('werewolf.audio.ack', timeoutMs);
  const result = await observation.waitForResult(frame.commandId, timeoutMs);
  if (result.outcome !== 'decided') {
    throw new Error(`Audio ack was not decided by the server (outcome: ${result.outcome})`);
  }
  const decision: unknown = result.result;
  if (
    typeof decision !== 'object' ||
    decision === null ||
    !('kind' in decision) ||
    decision.kind !== 'committed'
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
 * @throws {NightDriverError} If the night ends first or the budget expires.
 */
export async function waitForRoleTurn(
  rolePage: Page,
  stepId: string,
  allPages: Page[],
  timeoutMs = DEFAULT_STEP_WAIT_MS,
): Promise<void> {
  log(`waitForRoleTurn step=${stepId} rolePage=${pageId(rolePage, allPages)}`);
  const deadline = Date.now() + timeoutMs;
  let lastHeartbeat = 0;
  for (;;) {
    if ((await readRoomStep(rolePage)) === stepId) {
      if (await waitForStepUnlock(rolePage, stepId, deadline)) {
        log(`waitForRoleTurn — step ${stepId} reached, audio unlocked`);
        return;
      }
      log(`waitForRoleTurn — step ${stepId} moved on during audio`);
    }

    if (await isNightEnded(allPages[0]!)) {
      return failNightAction(`Night ended before step ${stepId} became actionable`, allPages);
    }
    if (Date.now() >= deadline) {
      return failNightAction(`Timed out after ${timeoutMs}ms waiting for step ${stepId}`, allPages);
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
): Promise<void> {
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
  if (!ended) return failNightAction(`Night did not end within ${timeoutMs}ms`, pages);
  // Every client renders the same broadcast, but the host page's anchor
  // can land a beat after the first page that flipped; give it a brief
  // settle window before reporting.
  for (let i = 0; i < 10; i++) {
    if (await isNightEnded(pages[0]!)) {
      return;
    }
    await pages[0]!.waitForTimeout(POLL_INTERVAL_MS);
  }
  return failNightAction('Host did not observe the end-of-night snapshot', pages);
}

/**
 * After night ends, open 昨夜信息 through host management, confirm the
 * 提示 dialog with 确定查看, assert the 昨夜信息 title, and return the
 * night-result message. The alert stays open.
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
  await expect(panel).toBeVisible();
  await pressAlertButton(hostPage, {
    title: '提示',
    buttonIndex: 1,
    buttonLabel: '确定查看',
    timeout: CONFIRM_TIMEOUT_MS,
  });
  await expect(hostPage.getByTestId(TESTIDS.alertTitle)).toHaveText('昨夜信息');
  const message = hostPage.getByTestId(TESTIDS.alertMessage);
  await expect(message).toBeVisible();
  return message.innerText();
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
    await waitForStepAndSettle(wPage, 'wolfKill');
    log(`driveWolfVote — P${wIdx} wolfKill reached, clicking seat`);
    await clickSeatAndConfirm(wPage, targetSeat);
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
    await waitForStepAndSettle(wPage, 'wolfKill');
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
 * Dismiss the captured alert and wait for its body to close or be replaced.
 * Required actions fail with room diagnostics; a replacement is never clicked.
 */
export async function dismissAlert(page: Page): Promise<void> {
  try {
    if (await dismissCurrentAlert(page, CLICK_TIMEOUT_MS)) {
      log('dismissAlert — captured primary clicked');
    }
  } catch (error) {
    return failNightAction('Could not dismiss the current alert', [page], error);
  }
}

/** A scan may defer a blocked click, but never a non-actionability error. */
async function tryDismissAlert(page: Page): Promise<boolean> {
  try {
    return await dismissCurrentAlert(page, SWEEP_CLICK_TIMEOUT_MS, false);
  } catch (error) {
    if (!(error instanceof errors.TimeoutError)) throw error;
    const buttons = await Promise.all(
      [0, 1, 2].map(async (index) => {
        const button = page.getByTestId(TESTIDS.alertButton(index));
        return button.evaluateAll((elements) =>
          elements.map((element) => ({
            disabled: element.hasAttribute('disabled'),
            text: element.textContent,
          })),
        );
      }),
    );
    log(
      `alert sweep deferred — ${await roomDiagnostics([page])} buttons=${JSON.stringify(buttons)}`,
    );
    return false;
  }
}

/**
 * Wait until a groupConfirm reveal step is active, detected by its
 * status button becoming visible on any page; its accessible name must
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
): Promise<void> {
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    for (const page of pages) {
      const statusButton = nightButton(page, 'groupConfirmAck');
      if (await statusButton.isVisible().catch(() => false)) {
        await dismissAlert(page);
        await expect(statusButton).toHaveAccessibleName(statusButtonText);
        return;
      }
    }
    for (const page of pages) {
      await tryDismissAlert(page);
    }
    await pages[0]!.waitForTimeout(POLL_INTERVAL_MS);
  }
  return failNightAction(`Group confirmation "${statusButtonText}" did not appear`, pages);
}

/**
 * Drive one player through a groupConfirm reveal acknowledgement:
 * dismiss the step prompt, open the status button, read the personal
 * message, acknowledge it. Returns the personal message text.
 *
 * The ack button text is the reveal step's own confirmButtonText
 * (e.g. '知道了' for the cupid reveal, piper and
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
  await pressAlertButton(page, { title: '查看状态？', buttonIndex: 1, buttonLabel: '查看' });
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
 * label after dismissing its step prompt.
 */
export async function clickNightButton(
  page: Page,
  key: string,
  label: string,
  options?: { readonly revealPrivateStatus?: boolean },
): Promise<void> {
  let button = nightButton(page, key);
  let panel: Locator | null = null;
  if (!(await button.isVisible())) {
    await dismissAlert(page);
    await openActionGroupFor(page, key);
  }
  if (PANEL_NIGHT_BUTTON_KEYS.has(key) && !(await button.isVisible().catch(() => false))) {
    await dismissAlert(page);
    const existingPanel = page.getByTestId(TESTIDS.roomHostManagementPanel);
    panel = (await existingPanel.isVisible())
      ? existingPanel
      : await new RoomPage(page).openHostManagement();
    button = panel.getByTestId(TESTIDS.werewolfNightButton(key));
  }
  await dismissAlert(page);
  await expect(button).toHaveAccessibleName(label, { timeout: 10_000 });
  await expect(button).toBeEnabled({ timeout: 10_000 });
  await button.click({ timeout: CLICK_TIMEOUT_MS });
  if (options?.revealPrivateStatus === true) {
    await pressAlertButton(page, { title: '查看状态？', buttonIndex: 1, buttonLabel: '查看' });
  }
  if (panel !== null) await expect(panel).not.toBeVisible({ timeout: CLICK_TIMEOUT_MS });
  log(`clickNightButton — ${key} "${label}" clicked`);
}

// ---------------------------------------------------------------------------
// Magician swap (two-target selection)
// ---------------------------------------------------------------------------

/**
 * Draft and submit the magician's two-seat swap.
 */
export async function driveMagicianSwap(page: Page, seat1: number, seat2: number): Promise<void> {
  await selectAndSubmitSeats(page, [seat1, seat2], {
    actionLabel: '确认交换',
    confirmationTitle: '确认交换',
  });
}
