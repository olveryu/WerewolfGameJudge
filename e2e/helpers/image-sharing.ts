/**
 * Review image sharing in a real browser: the desktop download fallback,
 * and real capture/upload in the mini-program branch, where only the
 * native preview bridge is simulated.
 */

import { readFile } from 'node:fs/promises';

import { expect, type Locator, type Page, type Route, test } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { waitForRoomScreenReady } from './waits';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** How long a review may take to pre-capture its pages before its share controls appear. */
export const REVIEW_CAPTURE_TIMEOUT_MS = 30_000;

/** A PNG's pixel size, read from its IHDR chunk. */
export function readPngSize(png: Buffer): { readonly width: number; readonly height: number } {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/** Close the open review dialog through its 「关闭详情」 header button. */
export async function closeReviewDialog(page: Page): Promise<void> {
  const closeButton = page.getByTestId(TESTIDS.roomDialogCloseButton);
  await expect(closeButton).toHaveAccessibleName('关闭详情');
  await closeButton.click();
}

/**
 * Presses a review share control once the review's pages are captured and
 * returns the one image the browser saved: desktop Chromium has no Web
 * Share for files, so the export falls back to a download named after the
 * review document. The image is a real PNG of a captured page and is
 * attached to the test.
 */
export async function downloadReviewImage(
  shareControl: Locator,
  filename: string,
): Promise<Buffer> {
  // Pages pre-capture in the background; the control enables once they are ready.
  await expect(shareControl).toBeEnabled({ timeout: REVIEW_CAPTURE_TIMEOUT_MS });
  const downloadPromise = shareControl.page().waitForEvent('download');
  await shareControl.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(filename);
  const path = test.info().outputPath(filename);
  await download.saveAs(path);
  const png = await readFile(path);
  expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  expect(png.length).toBeGreaterThan(10_000);
  await test.info().attach(filename, { body: png, contentType: 'image/png' });
  return png;
}

declare global {
  interface Window {
    recordWeChatPreview(current: string | undefined, urls: string[]): Promise<void>;
  }
}

/** Checks that unrelated pending images cannot block PNG upload and WeChat preview completion. */
export async function expectWeChatImageShare(
  page: Page,
  openButton: { readonly testId: string; readonly label: string },
  count: number,
): Promise<void> {
  const previews: { current: string | undefined; urls: string[] }[] = [];
  await page.exposeFunction(
    'recordWeChatPreview',
    (current: string | undefined, urls: string[]) => {
      previews.push({ current, urls });
    },
  );
  await page.addInitScript(() => {
    Object.assign(window, { __wxjs_environment: 'miniprogram' });
  });
  await page.reload();
  await waitForRoomScreenReady(page, { role: 'joiner' });
  await page.evaluate(() => {
    Object.assign(window, {
      wx: {
        previewImage: (options: { current?: string; urls: string[]; success?: () => void }) => {
          void window.recordWeChatPreview(options.current, options.urls);
          options.success?.();
        },
      },
    });
  });

  const pendingImageUrl = new URL('/__e2e-pending-share-image.png', page.url()).href;
  const pendingRequests: Route[] = [];
  const holdImage = (route: Route) => {
    pendingRequests.push(route);
  };
  await page.route(pendingImageUrl, holdImage);
  let downloadCount = 0;
  const recordDownload = () => {
    downloadCount += 1;
  };
  page.on('download', recordDownload);
  try {
    const requested = page.waitForRequest(pendingImageUrl);
    await page.evaluate((url) => {
      const image = document.createElement('img');
      image.id = 'unrelated-share-image';
      image.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0';
      image.src = url;
      document.body.appendChild(image);
    }, pendingImageUrl);
    await requested;
    const open = page.getByTestId(openButton.testId);
    await expect(open).toHaveText(openButton.label);
    await open.click();
    const shareButton = page.getByTestId(TESTIDS.roomReviewShareButton);
    await expect(shareButton).toBeEnabled({ timeout: REVIEW_CAPTURE_TIMEOUT_MS });
    await expect(shareButton).toHaveText(
      count === 1 ? '保存／分享图片' : `保存／分享全部 ${count} 页`,
    );
    await shareButton.click();
    await expect.poll(() => previews.length, { timeout: 20_000 }).toBe(1);
    await expect(shareButton).toBeEnabled();
    expect(downloadCount).toBe(0);
    expect(previews[0]!.urls).toHaveLength(count);
    expect(previews[0]!.current).toBe(previews[0]!.urls[0]);
    for (const [index, url] of previews[0]!.urls.entries()) {
      expect(url).toMatch(/^https?:\/\/[^/]+\/share\/[^/]+\.png$/);
      const response = await page.request.get(url);
      expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toBe('image/png');
      const png = await response.body();
      expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
      const { width, height } = readPngSize(png);
      expect(height).toBeGreaterThan(width);
      expect(png.length).toBeGreaterThan(10_000);
      await test.info().attach(`wechat-share-${index}`, { body: png, contentType: 'image/png' });
    }
    await closeReviewDialog(page);
  } finally {
    page.off('download', recordDownload);
    await page.evaluate(() => document.getElementById('unrelated-share-image')?.remove());
    await Promise.all(pendingRequests.map((route) => route.abort()));
    await page.unroute(pendingImageUrl, holdImage);
  }
}
