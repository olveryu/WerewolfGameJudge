/** Pictionary room actions that drive only visible production UI and authoritative state. */

import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { enterRoomCodeViaNumPad } from '../helpers/home';
import { waitForRoomScreenReady } from '../helpers/waits';
import { RoomPage } from './RoomPage';

const PHONE_STAGE_MAX_WIDTH = 430;
const GALLERY_ALIGNMENT_TOLERANCE = 2;

/** Operates one real player's Pictionary room surface. */
export class PictionaryRoomPage extends RoomPage {
  constructor(page: Page) {
    super(page);
  }

  /** Join an existing room through the same number-pad flow used by players. */
  async joinViaCode(roomCode: string): Promise<void> {
    await this.page.getByTestId(TESTIDS.homeEnterRoomButton).click();
    await expect(this.page.getByText('加入房间', { exact: true })).toBeVisible();
    await enterRoomCodeViaNumPad(this.page, roomCode);
    await this.page.getByText('加入', { exact: true }).click();
    await waitForRoomScreenReady(this.page, { role: 'joiner' });
  }

  /** Start the round from the shared host-management panel. */
  async startRound(): Promise<void> {
    await this.clickHostManagementAction(TESTIDS.pictionaryStartRoundButton);
    await expect(this.page.getByTestId(TESTIDS.pictionaryStageFrame)).toBeVisible({
      timeout: 15_000,
    });
  }

  /** Wait for the opening prompt composer with no inherited context. */
  async expectPromptStep(step: number, totalSteps: number): Promise<void> {
    const stage = this.page.getByTestId(TESTIDS.pictionaryStageFrame);
    await expect(stage.getByText(`第 ${step} / ${totalSteps} 棒`, { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(stage.getByText('写下一个题目', { exact: true })).toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.pictionaryTextInput)).toBeVisible();
    await expect(stage.getByText('上一棒', { exact: true })).toHaveCount(0);
  }

  /** Mark one locally persisted opening prompt ready for final collection. */
  async completePromptEditing(text: string): Promise<void> {
    await this.page.getByTestId(TESTIDS.pictionaryTextInput).fill(text);
    const submitButton = this.page.getByTestId(TESTIDS.pictionaryTextSubmitButton);
    await expect(submitButton).toHaveAccessibleName('完成编辑');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
  }

  /** Prove that a ready text draft can return to editing before collection. */
  async reviseReadyPrompt(initialText: string, finalText: string): Promise<void> {
    const input = this.page.getByTestId(TESTIDS.pictionaryTextInput);
    const completionButton = this.page.getByTestId(TESTIDS.pictionaryTextSubmitButton);
    await input.fill(initialText);
    await completionButton.click();
    await expect(input).not.toBeEditable();
    await expect(completionButton).toHaveAccessibleName('继续编辑');
    await completionButton.click();
    await expect(input).toBeEditable();
    await input.fill(finalText);
    await completionButton.click();
    await expect(input).not.toBeEditable();
  }

  /** Assert a drawing task with its inherited text context and complete tool set. */
  async expectDrawingStep(step: number, totalSteps: number): Promise<void> {
    const stage = this.page.getByTestId(TESTIDS.pictionaryStageFrame);
    await expect(stage.getByText(`第 ${step} / ${totalSteps} 棒`, { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(stage.getByText('把这句话画出来', { exact: true })).toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.pictionaryDrawingCanvas)).toBeVisible();
    await expect(stage.getByText('上一棒', { exact: true })).toBeVisible();
    const canvasBounds = await this.page.getByTestId(TESTIDS.pictionaryDrawingCanvas).boundingBox();
    if (canvasBounds === null) throw new Error('Pictionary canvas has no browser layout box');
    const toolbarBounds = [];
    for (const tool of [/^选择工具，/, /^选择颜色，/, /^选择粗细，/, /^撤销$/, /^重做$/]) {
      const button = stage.getByRole('button', { name: tool });
      await expect(button).toBeInViewport({ ratio: 1 });
      const toolBounds = await button.boundingBox();
      if (toolBounds === null) throw new Error(`Pictionary ${tool} has no browser layout box`);
      expect(toolBounds.y).toBeGreaterThanOrEqual(canvasBounds.y + canvasBounds.height);
      toolbarBounds.push(toolBounds);
    }
    expect(new Set(toolbarBounds.map((bounds) => bounds.y)).size).toBe(1);
    await expect(stage.getByRole('button', { name: '红色', exact: true })).toHaveCount(0);
    await stage.getByRole('button', { name: /^选择工具，/ }).click();
    for (const tool of ['画笔', '橡皮', '直线', '矩形', '椭圆', '填充', '清空画布']) {
      await expect(this.page.getByRole('button', { name: tool, exact: true })).toBeInViewport({
        ratio: 1,
      });
    }
    await this.page.getByRole('button', { name: '关闭选择面板', exact: true }).click();
    await stage.getByRole('button', { name: /^选择颜色，/ }).click();
    await expect(this.page.getByRole('button', { name: '粉色', exact: true })).toBeInViewport({
      ratio: 1,
    });
    await this.page.getByRole('button', { name: '蓝色', exact: true }).click();
    await expect(
      stage.getByRole('button', { name: '选择颜色，当前蓝色', exact: true }),
    ).toBeVisible();
    await stage.getByRole('button', { name: /^选择粗细，/ }).click();
    await this.page.getByRole('button', { name: '30 像素画笔', exact: true }).click();
    await expect(
      stage.getByRole('button', { name: '选择粗细，当前 30 像素', exact: true }),
    ).toBeVisible();
    await stage.getByRole('button', { name: /^选择颜色，/ }).click();
    await expect(
      this.page.getByRole('button', { name: '关闭选择面板', exact: true }),
    ).toBeVisible();
    await this.page.mouse.click(1, 1);
    await expect(this.page.getByRole('button', { name: '关闭选择面板', exact: true })).toHaveCount(
      0,
    );
    await expect(stage.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
    await expect(this.page.getByTestId(TESTIDS.pictionaryDrawingSubmitButton)).toBeDisabled();
  }

  /** Keep preset colors first and select a custom color using only picker gestures. */
  async exerciseColorPicker(): Promise<void> {
    const colorButton = this.page.getByRole('button', { name: /^选择颜色，/ });
    const swatch = colorButton.locator('[style*="background-color"]').first();
    const initialColor = await swatch.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    const colorButtonBounds = await colorButton.boundingBox();
    await colorButton.click();
    const palette = this.page.getByLabel('画笔颜色面板', { exact: true });
    await expect(palette).toBeInViewport({ ratio: 1 });
    const paletteBounds = await palette.boundingBox();
    const viewport = this.page.viewportSize();
    const presetBounds = await this.page
      .getByRole('button', { name: '粉色', exact: true })
      .boundingBox();
    const entryBounds = await this.page
      .getByRole('button', { name: '展开调色板', exact: true })
      .boundingBox();
    if (!paletteBounds || !viewport || !colorButtonBounds || !presetBounds || !entryBounds) {
      throw new Error('Pictionary color palette has no browser layout box');
    }
    expect(entryBounds.width).toBe(presetBounds.width);
    expect(entryBounds.height).toBe(presetBounds.height);
    expect(entryBounds.y).toBe(presetBounds.y);
    if (viewport.width < 600) {
      expect(paletteBounds.y + paletteBounds.height).toBeCloseTo(viewport.height, 0);
    } else {
      expect(colorButtonBounds.y - paletteBounds.y - paletteBounds.height).toBeCloseTo(8, 0);
    }
    const panel = this.page.getByLabel('饱和度与明度', { exact: true });
    const hue = this.page.getByLabel('色相', { exact: true });
    await expect(panel).toHaveCount(0);
    await expect(this.page.getByRole('button', { name: '粉色', exact: true })).toBeInViewport({
      ratio: 1,
    });
    await this.page.getByRole('button', { name: '展开调色板', exact: true }).click();
    await expect(this.page.getByRole('textbox')).toHaveCount(0);
    await expect(this.page.getByText(/#[0-9a-f]{6}/i)).toHaveCount(0);
    for (const control of [panel, hue]) {
      await expect(control).toBeInViewport({ ratio: 1 });
    }
    const panelBounds = await panel.boundingBox();
    const hueBounds = await hue.boundingBox();
    if (panelBounds === null || hueBounds === null) {
      throw new Error('Pictionary color picker has no browser layout box');
    }
    await this.page.mouse.move(
      hueBounds.x + hueBounds.width * 0.2,
      hueBounds.y + hueBounds.height / 2,
    );
    await this.page.mouse.down();
    await this.page.mouse.move(
      hueBounds.x + hueBounds.width * 0.6,
      hueBounds.y + hueBounds.height / 2,
      { steps: 8 },
    );
    await this.page.mouse.up();
    await this.page.mouse.move(
      panelBounds.x + panelBounds.width * 0.2,
      panelBounds.y + panelBounds.height * 0.2,
    );
    await this.page.mouse.down();
    await this.page.mouse.move(
      panelBounds.x + panelBounds.width * 0.7,
      panelBounds.y + panelBounds.height * 0.4,
      { steps: 8 },
    );
    await this.page.mouse.up();
    await this.page.getByRole('button', { name: '关闭选择面板', exact: true }).click();
    await expect(colorButton).toHaveAccessibleName('选择颜色，当前自定义颜色');
    const selectedColor = await swatch.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(selectedColor).not.toBe(initialColor);
    await this.drawStroke(2);
    await colorButton.click();
    await expect(panel).toHaveCount(0);
    await this.page.getByRole('button', { name: '展开调色板', exact: true }).click();
    await expect(panel).toBeInViewport({ ratio: 1 });
    await this.page.getByRole('button', { name: '返回常用颜色', exact: true }).click();
    await expect(panel).toHaveCount(0);
    await expect(this.page.getByRole('button', { name: /^最近颜色 / })).toHaveCount(1);
    await this.page.getByRole('button', { name: '红色', exact: true }).click();
    await expect(colorButton).toHaveAccessibleName('选择颜色，当前红色');
    await colorButton.click();
    await this.page.getByRole('button', { name: '最近颜色 1', exact: true }).click();
    await expect(swatch).toHaveCSS('background-color', selectedColor);
  }

  /** Draw one non-empty stroke through browser pointer events. */
  async drawStroke(strokeVariant: number): Promise<void> {
    const canvas = this.page.getByTestId(TESTIDS.pictionaryDrawingCanvas);
    await expect(canvas).toBeVisible();
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas).toBeInViewport({ ratio: 0.9 });
    const bounds = await canvas.boundingBox();
    if (bounds === null) throw new Error('Pictionary canvas has no browser layout box');

    const verticalOffset = strokeVariant * 0.04;
    await this.page.mouse.move(
      bounds.x + bounds.width * 0.2,
      bounds.y + bounds.height * (0.2 + verticalOffset),
    );
    await this.page.mouse.down();
    try {
      await this.page.mouse.move(
        bounds.x + bounds.width * 0.8,
        bounds.y + bounds.height * (0.75 - verticalOffset),
        { steps: 12 },
      );
    } finally {
      await this.page.mouse.up();
    }
    await expect(this.page.getByTestId(TESTIDS.pictionaryDrawingSubmitButton)).toBeEnabled();
  }

  /** Exercise each drawing operation against the real Skia canvas. */
  async exerciseDrawingTools(): Promise<void> {
    const stage = this.page.getByTestId(TESTIDS.pictionaryStageFrame);
    await this.drawStroke(0);
    const undoButton = stage.getByRole('button', { name: '撤销', exact: true });
    const redoButton = stage.getByRole('button', { name: '重做', exact: true });
    await expect(undoButton).toBeEnabled();
    await undoButton.click();
    await expect(this.page.getByTestId(TESTIDS.pictionaryDrawingSubmitButton)).toBeDisabled();
    await expect(redoButton).toBeEnabled();
    await redoButton.click();
    await expect(this.page.getByTestId(TESTIDS.pictionaryDrawingSubmitButton)).toBeEnabled();
    for (const [toolIndex, tool] of ['直线', '矩形', '椭圆', '橡皮'].entries()) {
      await stage.getByRole('button', { name: /^选择工具，/ }).click();
      await this.page.getByRole('button', { name: tool, exact: true }).click();
      await expect(
        stage.getByRole('button', { name: `选择工具，当前${tool}`, exact: true }),
      ).toBeVisible();
      await this.drawStroke(toolIndex + 1);
    }
    await stage.getByRole('button', { name: /^选择颜色，/ }).click();
    await this.page.getByRole('button', { name: '红色', exact: true }).click();
    await stage.getByRole('button', { name: /^选择工具，/ }).click();
    await this.page.getByRole('button', { name: '填充', exact: true }).click();
    const canvas = this.page.getByTestId(TESTIDS.pictionaryDrawingCanvas);
    await canvas.scrollIntoViewIfNeeded();
    const bounds = await canvas.boundingBox();
    if (bounds === null) throw new Error('Pictionary canvas has no browser layout box');
    await this.page.mouse.click(bounds.x + bounds.width * 0.05, bounds.y + bounds.height * 0.05);
    await expect(this.page.getByTestId(TESTIDS.pictionaryDrawingSubmitButton)).toBeEnabled();
    await stage.getByRole('button', { name: /^选择工具，/ }).click();
    await this.page.getByRole('button', { name: '清空画布', exact: true }).click();
    await this.page.getByRole('dialog').getByText('取消', { exact: true }).click();
    await expect(undoButton).toBeEnabled();
    await stage.getByRole('button', { name: /^选择工具，/ }).click();
    await this.page.getByRole('button', { name: '清空画布', exact: true }).click();
    await this.page.getByRole('dialog').getByText('清空', { exact: true }).click();
    await expect(undoButton).toBeDisabled();
    await expect(this.page.getByTestId(TESTIDS.pictionaryDrawingSubmitButton)).toBeDisabled();
    await stage.getByRole('button', { name: /^选择工具，/ }).click();
    await this.page.getByRole('button', { name: '画笔', exact: true }).click();
    await this.drawStroke(0);
  }

  /** Mark the locally persisted drawing ready for final collection. */
  async completeDrawingEditing(): Promise<void> {
    const completionButton = this.page.getByTestId(TESTIDS.pictionaryDrawingSubmitButton);
    await expect(completionButton).toHaveAccessibleName('完成编辑');
    await completionButton.click();
  }

  /** Wait for a guess task and its protected source drawing. */
  async expectGuessStep(step: number, totalSteps: number): Promise<void> {
    const stage = this.page.getByTestId(TESTIDS.pictionaryStageFrame);
    await expect(stage.getByText(`第 ${step} / ${totalSteps} 棒`, { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(stage.getByText('猜猜画的是什么', { exact: true })).toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.pictionaryTextInput)).toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.pictionaryDrawingImageButton)).toBeVisible({
      timeout: 30_000,
    });
    await expect(stage.getByText('上一棒画作', { exact: true })).toBeVisible();
    await expect(stage.getByText(/ 的画作$/)).toHaveCount(0);
  }

  /** Open and close the protected drawing's fullscreen preview. */
  async expectFullscreenDrawingPreview(): Promise<void> {
    await this.page.getByTestId(TESTIDS.pictionaryDrawingImageButton).click();
    const preview = this.page.getByTestId(TESTIDS.pictionaryDrawingFullscreenPreview);
    await expect(preview).toBeVisible();
    await this.page.getByRole('button', { name: '关闭' }).click();
    await expect(preview).not.toBeVisible();
  }

  /** Mark one locally persisted guess ready for final collection. */
  async completeGuessEditing(text: string): Promise<void> {
    await this.page.getByTestId(TESTIDS.pictionaryTextInput).fill(text);
    const submitButton = this.page.getByTestId(TESTIDS.pictionaryTextSubmitButton);
    await expect(submitButton).toHaveAccessibleName('完成编辑');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
  }

  /** Wait until synchronized manual gallery playback begins. */
  async expectGallery(): Promise<void> {
    const stage = this.page.getByTestId(TESTIDS.pictionaryStageFrame);
    await expect(stage.getByText('第 1 / 4 本画册', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(this.page.getByTestId(TESTIDS.pictionaryGalleryAlbum)).toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.pictionaryGalleryEntry)).toHaveCount(1);
  }

  /** Assert the authoritative chain and entry cursors shown on this player. */
  async expectGalleryPosition(
    chain: number,
    entry: number,
    chainTotal: number,
    entryTotal: number,
  ): Promise<void> {
    const stage = this.page.getByTestId(TESTIDS.pictionaryStageFrame);
    await expect(
      stage.getByText(`第 ${chain} / ${chainTotal} 本画册`, { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    const revealedEntries = this.page.getByTestId(TESTIDS.pictionaryGalleryEntry);
    await expect(revealedEntries).toHaveCount(entry, { timeout: 10_000 });
    await expect(
      revealedEntries.last().getByText(`第 ${entry} / ${entryTotal} 棒`, { exact: true }),
    ).toBeVisible();
    if (entry > 1) {
      await expect
        .poll(async () => {
          const albumBounds = await this.page
            .getByTestId(TESTIDS.pictionaryGalleryAlbum)
            .boundingBox();
          const entryBounds = await revealedEntries.last().boundingBox();
          if (albumBounds === null || entryBounds === null) {
            throw new Error('Pictionary gallery has no browser layout box');
          }
          return Math.abs(entryBounds.y - albumBounds.y);
        })
        .toBeLessThanOrEqual(GALLERY_ALIGNMENT_TOLERANCE);
    } else {
      await expect(
        stage.getByText(`第 ${chain} / ${chainTotal} 本画册`, { exact: true }),
      ).toBeInViewport();
    }
  }

  /** Read the cumulative album for cross-player synchronization assertions. */
  async readLatestGalleryEntryText(): Promise<string> {
    const text = await this.page.getByTestId(TESTIDS.pictionaryGalleryEntry).last().textContent();
    if (text === null) throw new Error('Current Pictionary gallery entry has no text content');
    return text;
  }

  /** Advance the authoritative gallery cursor from the host controls. */
  async advanceGallery(): Promise<void> {
    const responsePromise = this.page.waitForResponse((response) => {
      const request = response.request();
      if (new URL(response.url()).pathname !== '/room/command' || request.method() !== 'POST') {
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
        body.command.type === 'pictionary.gallery.advance'
      );
    });
    await this.page.getByTestId(TESTIDS.pictionaryGalleryAdvanceButton).click();
    const response = await responsePromise;
    expect(await response.finished()).toBeNull();
    expect(response.ok()).toBe(true);
    expect(await response.json()).toMatchObject({
      kind: 'committed',
      outcome: { kind: 'success' },
    });
  }

  /** Wait until all synchronized reveals finish and local browsing begins. */
  async expectEnded(): Promise<void> {
    await expect(this.page.getByRole('button', { name: '下一本' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(this.page.getByTestId(TESTIDS.pictionaryGalleryEntry)).toHaveCount(4);
  }

  /** Assert that desktop viewports retain the product's phone-sized stage. */
  async expectPhoneSizedStage(): Promise<void> {
    const bounds = await this.page.getByTestId(TESTIDS.pictionaryStageFrame).boundingBox();
    if (bounds === null) throw new Error('Pictionary stage has no browser layout box');
    expect(bounds.width).toBeLessThanOrEqual(PHONE_STAGE_MAX_WIDTH);
  }

  /** Require core task controls to fit without scrolling, including a reduced keyboard viewport. */
  async expectTaskFitsViewport(kind: 'prompt' | 'guess' | 'drawing'): Promise<void> {
    const media = this.page.getByTestId(
      kind === 'drawing' ? TESTIDS.pictionaryDrawingCanvas : TESTIDS.pictionaryDrawingImageButton,
    );
    const button = this.page.getByTestId(
      kind === 'drawing'
        ? TESTIDS.pictionaryDrawingSubmitButton
        : TESTIDS.pictionaryTextSubmitButton,
    );
    await expect(button).toBeInViewport({ ratio: 1 });
    if (kind !== 'drawing')
      await expect(this.page.getByTestId(TESTIDS.pictionaryTextInput)).toBeInViewport({ ratio: 1 });
    if (kind !== 'prompt') {
      await expect(media).toBeInViewport({ ratio: 1 });
      const bounds = await media.boundingBox();
      if (bounds === null) throw new Error('Task media layout is missing');
      expect(bounds.height).toBeGreaterThan(60);
      expect(bounds.width / bounds.height).toBeCloseTo(4 / 3, 1);
    }
    expect(
      await this.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
}
