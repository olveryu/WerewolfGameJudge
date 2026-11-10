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
export async function alertPrimaryButton(page: Page): Promise<Locator> {
  if ((await page.getByTestId(TESTIDS.alertButton(2)).count()) > 0) {
    throw new Error('The open alert has three or more buttons and no single primary button');
  }
  const second = page.getByTestId(TESTIDS.alertButton(1));
  return (await second.count()) > 0 ? second : page.getByTestId(TESTIDS.alertButton(0));
}

/**
 * Wait for an alert and read its title and message, joined by a newline. The
 * message element renders only when the alert has a message.
 */
export async function readAlertText(page: Page, timeout = 10_000): Promise<string> {
  const title = page.getByTestId(TESTIDS.alertTitle);
  await expect(title).toBeVisible({ timeout });
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
