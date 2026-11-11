/**
 * AlertHost interactions, located by test id only.
 *
 * Button order: one button renders alone; two render as [取消, 确定];
 * three or more render in a column with cancel moved last.
 */

import { expect, type Locator, type Page } from '@playwright/test';

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

/** Close only the captured alert body; a replacement alert is left for its caller. */
export async function dismissCurrentAlert(
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
        {
          timeout,
        },
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
      await button.click({ timeout });
      if (!waitForClose) return true;
      await expect
        .poll(() => title.evaluate((element) => element.isConnected), { timeout })
        .toBe(false);
      await expect
        .poll(
          async () =>
            !(await modal.isVisible()) || (await page.getByTestId(TESTIDS.alertTitle).count()) > 0,
          {
            timeout,
          },
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

/**
 * Wait for an alert and read its title and message, joined by a newline. The
 * message element renders only when the alert has a message.
 */
export async function readAlertText(
  page: Page,
  timeout = 10_000,
  expectedTitle?: string,
): Promise<string> {
  const title = page.getByTestId(TESTIDS.alertTitle);
  if (expectedTitle === undefined) await expect(title).toBeVisible({ timeout });
  else await expect(title).toHaveText(expectedTitle, { timeout });
  const message = page.getByTestId(TESTIDS.alertMessage);
  const messageText = (await message.count()) > 0 ? await message.textContent() : '';
  return `${await title.textContent()}\n${messageText}`;
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
