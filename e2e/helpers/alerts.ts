/**
 * AlertHost interactions, located by test id only.
 *
 * Button order: one button renders alone; two render as [取消, 确定];
 * three or more render in a column with cancel moved last.
 */

import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';

const ALERT_TITLE_TIMEOUT_MS = 3000;

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
