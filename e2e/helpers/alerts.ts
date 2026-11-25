/**
 * AlertHost interactions, located by test id only.
 *
 * Button order: one button renders alone; two render as [取消, 确定];
 * three or more render in a column with cancel moved last.
 */

import { errors, expect, type Locator, type Page } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';

const ALERT_TITLE_TIMEOUT_MS = 3000;

/**
 * The open alert's primary button: the only button of a one-button alert, or the
 * second (non-cancel) button of a two-button alert.
 *
 * @throws {Error} When the alert has three or more buttons, which have no single primary.
 */
export async function alertPrimaryButton(page: Page): Promise<Locator | null> {
  if ((await page.getByTestId(TESTIDS.alertButton(2)).count()) > 0) {
    throw new Error('The open alert has three or more buttons and no single primary button');
  }
  const second = page.getByTestId(TESTIDS.alertButton(1));
  if ((await second.count()) > 0) return second;
  const first = page.getByTestId(TESTIDS.alertButton(0));
  return (await first.count()) > 0 ? first : null;
}

/**
 * Press the primary button of the alert that is open now, and wait until that alert has closed
 * or been replaced. An alert stays open while its button's command is in flight, so a caller
 * that only clicked would still be looking at it. A replacement alert is left for its caller.
 *
 * @returns false when no alert was open, or it was gone before its button could be pressed
 */
export async function pressCurrentAlertPrimary(
  page: Page,
  timeout = 5000,
  waitForClose = true,
): Promise<boolean> {
  const modal = page.getByTestId(TESTIDS.alertModal);
  if (!(await modal.isVisible())) return false;
  let [title] = await page.getByTestId(TESTIDS.alertTitle).elementHandles();
  if (title === undefined) {
    if (!waitForClose) return false;
    await expect
      .poll(
        async () =>
          !(await modal.isVisible()) || (await page.getByTestId(TESTIDS.alertTitle).count()) > 0,
        { timeout, message: 'The alert that was closing neither finished nor showed a new body' },
      )
      .toBe(true);
    if (!(await modal.isVisible())) return false;
    [title] = await page.getByTestId(TESTIDS.alertTitle).elementHandles();
    if (title === undefined) throw new Error('The alert body did not settle after its exit');
  }
  try {
    const primary = await alertPrimaryButton(page);
    if (primary === null) throw new Error('The open alert has a title but no primary button');
    const [button] = await primary.elementHandles();
    if (button === undefined)
      throw new Error('The alert primary button disappeared before capture');
    try {
      // Capture the button node: a live locator could click a newer alert after replacement.
      if (!(await title.evaluate((element) => element.isConnected))) return false;
      try {
        await button.click({ timeout });
      } catch (error) {
        const detached =
          error instanceof Error && error.message.includes('Element is not attached to the DOM');
        if (
          (detached || error instanceof errors.TimeoutError) &&
          !(await title.evaluate((element) => element.isConnected))
        ) {
          return false;
        }
        throw error;
      }
      if (!waitForClose) return true;
      await expect
        .poll(() => title.evaluate((element) => element.isConnected), {
          timeout,
          message: 'The alert stayed open after its primary button was pressed',
        })
        .toBe(false);
      await expect
        .poll(
          async () =>
            !(await modal.isVisible()) || (await page.getByTestId(TESTIDS.alertTitle).count()) > 0,
          { timeout, message: 'The pressed alert neither finished closing nor was replaced' },
        )
        .toBe(true);
      return true;
    } finally {
      await button.dispose();
    }
  } finally {
    await title.dispose();
  }
}

interface AlertSnapshot {
  readonly title: string;
  /** Empty when the alert has no message. */
  readonly message: string;
}

/**
 * The open alert's title and message from one page evaluation, or null while no alert body is
 * mounted. Separate reads can straddle a replacement and pair one alert's title with another
 * alert's message.
 */
async function readAlertSnapshot(page: Page): Promise<AlertSnapshot | null> {
  return page.getByTestId(TESTIDS.alertModal).evaluateAll(
    (modals, testIds) => {
      const open = modals.flatMap((modal) => {
        const title = modal.querySelector(`[data-testid="${testIds.title}"]`);
        if (title === null) return [];
        const message = modal.querySelector(`[data-testid="${testIds.message}"]`);
        return [{ title: title.textContent ?? '', message: message?.textContent ?? '' }];
      });
      if (open.length > 1) throw new Error(`${open.length} alerts are open at once`);
      return open[0] ?? null;
    },
    { title: TESTIDS.alertTitle, message: TESTIDS.alertMessage },
  );
}

/**
 * Wait for an alert and read its title and message, joined by a newline. With `expectedTitle`,
 * waits for the alert that carries that title; without it, reads whichever alert is open, so
 * the caller must already know the previous alert is gone.
 */
export async function readAlertText(
  page: Page,
  timeout = 10_000,
  expectedTitle?: string,
): Promise<string> {
  const seen: { alert: AlertSnapshot | null } = { alert: null };
  await expect(async () => {
    seen.alert = await readAlertSnapshot(page);
    expect(seen.alert, 'An alert should be open').not.toBeNull();
    if (expectedTitle !== undefined) {
      expect(seen.alert?.title, 'The open alert should carry the expected title').toBe(
        expectedTitle,
      );
    }
  }).toPass({ timeout });
  if (seen.alert === null) throw new Error('[FAIL-FAST] The alert wait passed without an alert');
  return `${seen.alert.title}\n${seen.alert.message}`;
}

/** Assert the open alert's title, then press the button at `buttonIndex` after asserting its label. */
export async function pressAlertButton(
  page: Page,
  opts: {
    readonly title: string;
    readonly buttonIndex: number;
    readonly buttonLabel: string;
    readonly timeout?: number;
  },
): Promise<void> {
  await expect(page.getByTestId(TESTIDS.alertTitle)).toHaveText(opts.title, {
    timeout: opts.timeout ?? ALERT_TITLE_TIMEOUT_MS,
  });
  const button = page.getByTestId(TESTIDS.alertButton(opts.buttonIndex));
  await expect(button).toHaveText(opts.buttonLabel);
  await button.click();
}

/** Confirm a two-button [取消, 确定] alert with the given title. */
export async function confirmAlert(page: Page, title: string, timeout?: number): Promise<void> {
  await pressAlertButton(page, { title, buttonIndex: 1, buttonLabel: '确定', timeout });
}
