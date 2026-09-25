/** Exercises real capture/upload in the mini-program branch; only the native preview bridge is simulated. */

import { expect, type Page, type Route, test } from '@playwright/test';

import { waitForRoomScreenReady } from './waits';

declare global {
  interface Window {
    recordWeChatPreview(current: string | undefined, urls: string[]): Promise<void>;
  }
}

/** Checks that unrelated pending images cannot block PNG upload and WeChat preview completion. */
export async function expectWeChatImageShare(
  page: Page,
  openButtonName: string | RegExp,
  shareButtonName: string | RegExp,
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
    await page.getByRole('button', { name: openButtonName, exact: true }).click();
    const shareButton = page.getByRole('button', { name: shareButtonName, exact: true });
    await expect(shareButton).toBeEnabled();
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
      expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(png.readUInt32BE(20)).toBeGreaterThan(png.readUInt32BE(16));
      expect(png.length).toBeGreaterThan(10_000);
      await test.info().attach(`wechat-share-${index}`, { body: png, contentType: 'image/png' });
    }
    await page.getByRole('button', { name: '关闭详情', exact: true }).click();
  } finally {
    page.off('download', recordDownload);
    await page.evaluate(() => document.getElementById('unrelated-share-image')?.remove());
    await Promise.all(pendingRequests.map((route) => route.abort()));
    await page.unroute(pendingImageUrl, holdImage);
  }
}
