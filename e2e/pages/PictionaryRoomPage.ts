/** Pictionary room actions that drive only visible production UI and authoritative state. */

import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { type CommandFrameObservation, observeCommandFrames } from '../helpers/command-frames';
import { dismissDialogByOutsideClick } from '../helpers/ui';
import { RoomPage } from './RoomPage';

const PHONE_STAGE_MAX_WIDTH = 430;
const GALLERY_ALIGNMENT_TOLERANCE = 2;
/** The drawing stays usable only if it keeps at least this share of the
 *  viewport height — a relative floor, so it holds at any viewport size. */
const MIN_TASK_MEDIA_VIEWPORT_FRACTION = 0.2;

/** Accessible names of the drawing tools in the tool panel, keyed by tool id. */
const DRAWING_TOOL_LABELS = {
  brush: '画笔',
  eraser: '橡皮',
  line: '直线',
  rectangle: '矩形',
  ellipse: '椭圆',
  fill: '填充',
} as const;

/** Tools exercised with one stroke each, in this order. */
const STROKE_TOOLS = ['line', 'rectangle', 'ellipse', 'eraser'] as const;

/** Operates one real player's Pictionary room surface. */
export class PictionaryRoomPage extends RoomPage {
  private readonly commands: CommandFrameObservation;

  constructor(page: Page) {
    super(page);
    // The room socket is created on room entry, so the frame observer must
    // be installed here — every construction happens before room entry.
    this.commands = observeCommandFrames(page);
  }

  /** Start the round from the shared host-management panel. */
  async startRound(): Promise<void> {
    await this.clickHostManagementActionAndConfirm(TESTIDS.startGameButton, '开始游戏？');
    await expect(this.page.getByTestId(TESTIDS.pictionaryStageFrame)).toBeVisible({
      timeout: 15_000,
    });
  }

  /** Wait until the stage information bar shows this relay step, then return the task frame. */
  private async waitForRelayStep(step: number, totalSteps: number) {
    await expect(this.page.getByTestId(TESTIDS.roomStageChip('step'))).toHaveText(
      `第 ${step}/${totalSteps} 棒`,
      { timeout: 30_000 },
    );
    return this.page.getByTestId(TESTIDS.pictionaryStageFrame);
  }

  /** Wait for the opening prompt composer with no inherited context. */
  async expectPromptStep(step: number, totalSteps: number): Promise<void> {
    const stage = await this.waitForRelayStep(step, totalSteps);
    await expect(stage.getByTestId(TESTIDS.pictionaryTaskTitle)).toHaveText('写下一个题目');
    const input = this.page.getByTestId(TESTIDS.pictionaryTextInput);
    await expect(input).toBeVisible();
    await expect(input).toHaveAccessibleName('接龙题目');
    await expect(this.page.getByTestId(TESTIDS.pictionaryDrawingImageButton)).toHaveCount(0);
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

  /** Assert a drawing task with its inherited context card and complete tool set. */
  async expectDrawingStep(step: number, totalSteps: number): Promise<void> {
    const stage = await this.waitForRelayStep(step, totalSteps);
    await expect(stage.getByTestId(TESTIDS.pictionaryDrawingPrompt)).toBeVisible();
    await expect(stage.getByTestId(TESTIDS.pictionaryDrawingCanvas)).toBeVisible();
    const canvasBounds = await stage.getByTestId(TESTIDS.pictionaryDrawingCanvas).boundingBox();
    if (canvasBounds === null) throw new Error('Pictionary canvas has no browser layout box');
    const toolbarBounds = [];
    for (const toolbarButton of [
      TESTIDS.drawingToolbarToolButton,
      TESTIDS.drawingToolbarColorButton,
      TESTIDS.drawingToolbarWidthButton,
      TESTIDS.drawingToolbarUndoButton,
      TESTIDS.drawingToolbarRedoButton,
    ]) {
      const button = stage.getByTestId(toolbarButton);
      await expect(button).toBeInViewport({ ratio: 1 });
      const toolBounds = await button.boundingBox();
      if (toolBounds === null) {
        throw new Error(`Pictionary ${toolbarButton} has no browser layout box`);
      }
      expect(toolBounds.y).toBeGreaterThanOrEqual(canvasBounds.y + canvasBounds.height);
      toolbarBounds.push(toolBounds);
    }
    expect(new Set(toolbarBounds.map((bounds) => bounds.y)).size).toBe(1);
    await expect(this.page.getByTestId(TESTIDS.drawingToolbarColorSwatch('红色'))).toHaveCount(0);
    await stage.getByTestId(TESTIDS.drawingToolbarToolButton).click();
    for (const [tool, label] of Object.entries(DRAWING_TOOL_LABELS)) {
      const option = this.page.getByTestId(TESTIDS.drawingToolbarToolOption(tool));
      await expect(option).toHaveAccessibleName(label);
      await expect(option).toBeInViewport({ ratio: 1 });
    }
    const clearButton = this.page.getByTestId(TESTIDS.drawingToolbarClearButton);
    await expect(clearButton).toHaveAccessibleName('清空画布');
    await expect(clearButton).toBeInViewport({ ratio: 1 });
    const panelCloseButton = this.page.getByTestId(TESTIDS.drawingToolbarPanelCloseButton);
    await expect(panelCloseButton).toHaveAccessibleName('关闭选择面板');
    await panelCloseButton.click();
    const colorButton = stage.getByTestId(TESTIDS.drawingToolbarColorButton);
    await colorButton.click();
    await this.page.getByTestId(TESTIDS.drawingToolbarColorSwatch('蓝色')).click();
    await expect(colorButton).toHaveAccessibleName('选择颜色，当前蓝色');
    const widthButton = stage.getByTestId(TESTIDS.drawingToolbarWidthButton);
    await widthButton.click();
    await this.page.getByTestId(TESTIDS.drawingToolbarWidthOption(30)).click();
    await expect(widthButton).toHaveAccessibleName('选择粗细，当前 30 像素');
    await colorButton.click();
    await expect(panelCloseButton).toBeVisible();
    await dismissDialogByOutsideClick(this.page, panelCloseButton);
    await expect(stage.getByTestId(TESTIDS.drawingToolbarUndoButton)).toBeDisabled();
    await expect(this.page.getByTestId(TESTIDS.pictionaryDrawingSubmitButton)).toBeDisabled();
  }

  /** Keep preset colors first and select a custom color using only picker gestures. */
  async exerciseColorPicker(): Promise<void> {
    const colorButton = this.page.getByTestId(TESTIDS.drawingToolbarColorButton);
    const swatch = this.page.getByTestId(TESTIDS.drawingToolbarColorButtonSwatch);
    const initialColor = await swatch.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    const colorButtonBounds = await colorButton.boundingBox();
    await colorButton.click();
    const palette = this.page.getByTestId(TESTIDS.drawingToolbarColorPanel);
    await expect(palette).toHaveAttribute('aria-label', '画笔颜色面板');
    await expect(palette).toBeInViewport({ ratio: 1 });
    const paletteBounds = await palette.boundingBox();
    const viewport = this.page.viewportSize();
    const pinkPreset = this.page.getByTestId(TESTIDS.drawingToolbarColorSwatch('粉色'));
    const customColorButton = this.page.getByTestId(TESTIDS.drawingToolbarCustomColorButton);
    const presetBounds = await pinkPreset.boundingBox();
    const entryBounds = await customColorButton.boundingBox();
    if (!paletteBounds || !viewport || !colorButtonBounds || !presetBounds || !entryBounds) {
      throw new Error('Pictionary color palette has no browser layout box');
    }
    expect(entryBounds.width).toBe(presetBounds.width);
    expect(entryBounds.height).toBe(presetBounds.height);
    if (viewport.width < 600) {
      expect(paletteBounds.y + paletteBounds.height).toBeCloseTo(viewport.height, 0);
    } else {
      expect(colorButtonBounds.y - paletteBounds.y - paletteBounds.height).toBeCloseTo(8, 0);
    }
    const panel = this.page.getByTestId(TESTIDS.drawingColorPickerArea);
    const hue = this.page.getByTestId(TESTIDS.drawingColorPickerHue);
    await expect(panel).toHaveCount(0);
    await expect(pinkPreset).toBeInViewport({ ratio: 1 });
    await expect(customColorButton).toBeInViewport({ ratio: 1 });
    await customColorButton.click();
    await expect(panel).toHaveAttribute('aria-label', '饱和度与明度');
    await expect(hue).toHaveAttribute('aria-label', '色相');
    await expect
      .poll(() =>
        this.page.evaluate(
          () =>
            document.querySelectorAll(
              'textarea, input:not([type]), input[type="text"], input[type="search"]',
            ).length,
        ),
      )
      .toBe(0);
    await expect(palette).not.toContainText(/#[0-9a-f]{6}/i);
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
    await this.page.getByTestId(TESTIDS.drawingToolbarPanelCloseButton).click();
    await expect(colorButton).toHaveAccessibleName('选择颜色，当前自定义颜色');
    const selectedColor = await swatch.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(selectedColor).not.toBe(initialColor);
    await this.drawStroke(2);
    await colorButton.click();
    await expect(panel).toHaveCount(0);
    await customColorButton.click();
    await expect(panel).toBeInViewport({ ratio: 1 });
    const backButton = this.page.getByTestId(TESTIDS.drawingToolbarColorBackButton);
    await expect(backButton).toHaveAccessibleName('返回常用颜色');
    await backButton.click();
    await expect(panel).toHaveCount(0);
    const firstRecentColor = this.page.getByTestId(TESTIDS.drawingToolbarRecentColor(0));
    await expect(firstRecentColor).toHaveAccessibleName('最近颜色 1');
    await expect(this.page.getByTestId(TESTIDS.drawingToolbarRecentColor(1))).toHaveCount(0);
    await this.page.getByTestId(TESTIDS.drawingToolbarColorSwatch('红色')).click();
    await expect(colorButton).toHaveAccessibleName('选择颜色，当前红色');
    await colorButton.click();
    await firstRecentColor.click();
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
  async exerciseDrawingTools(step: number, totalSteps: number): Promise<void> {
    const stage = await this.waitForRelayStep(step, totalSteps);
    await this.drawStroke(0);
    const undoButton = stage.getByTestId(TESTIDS.drawingToolbarUndoButton);
    const redoButton = stage.getByTestId(TESTIDS.drawingToolbarRedoButton);
    const toolButton = stage.getByTestId(TESTIDS.drawingToolbarToolButton);
    await expect(undoButton).toBeEnabled();
    await undoButton.click();
    await expect(this.page.getByTestId(TESTIDS.pictionaryDrawingSubmitButton)).toBeDisabled();
    await expect(redoButton).toBeEnabled();
    await redoButton.click();
    await expect(this.page.getByTestId(TESTIDS.pictionaryDrawingSubmitButton)).toBeEnabled();
    for (const [toolIndex, tool] of STROKE_TOOLS.entries()) {
      await toolButton.click();
      await this.page.getByTestId(TESTIDS.drawingToolbarToolOption(tool)).click();
      await expect(toolButton).toHaveAccessibleName(`选择工具，当前${DRAWING_TOOL_LABELS[tool]}`);
      await this.drawStroke(toolIndex + 1);
    }
    await stage.getByTestId(TESTIDS.drawingToolbarColorButton).click();
    await this.page.getByTestId(TESTIDS.drawingToolbarColorSwatch('红色')).click();
    await toolButton.click();
    await this.page.getByTestId(TESTIDS.drawingToolbarToolOption('fill')).click();
    const canvas = this.page.getByTestId(TESTIDS.pictionaryDrawingCanvas);
    await canvas.scrollIntoViewIfNeeded();
    const bounds = await canvas.boundingBox();
    if (bounds === null) throw new Error('Pictionary canvas has no browser layout box');
    await this.page.mouse.click(bounds.x + bounds.width * 0.05, bounds.y + bounds.height * 0.05);
    await expect(this.page.getByTestId(TESTIDS.pictionaryDrawingSubmitButton)).toBeEnabled();
    await toolButton.click();
    await this.page.getByTestId(TESTIDS.drawingToolbarClearButton).click();
    await this.page.getByTestId(TESTIDS.alertButton(0)).click();
    await expect(undoButton).toBeEnabled();
    await toolButton.click();
    await this.page.getByTestId(TESTIDS.drawingToolbarClearButton).click();
    await this.page.getByTestId(TESTIDS.alertButton(1)).click();
    await expect(undoButton).toBeDisabled();
    await expect(this.page.getByTestId(TESTIDS.pictionaryDrawingSubmitButton)).toBeDisabled();
    await toolButton.click();
    await this.page.getByTestId(TESTIDS.drawingToolbarToolOption('brush')).click();
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
    const stage = await this.waitForRelayStep(step, totalSteps);
    const input = this.page.getByTestId(TESTIDS.pictionaryTextInput);
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', '猜猜画的是什么');
    await expect(input).toHaveAccessibleName('看图猜词答案');
    const drawing = stage.getByTestId(TESTIDS.pictionaryDrawingImageButton);
    await expect(drawing).toBeVisible({ timeout: 30_000 });
    await expect(drawing).toHaveAccessibleName('上一棒画作，全屏查看');
  }

  /** Open and close the protected drawing's fullscreen preview. */
  async expectFullscreenDrawingPreview(): Promise<void> {
    await this.page.getByTestId(TESTIDS.pictionaryDrawingImageButton).click();
    const preview = this.page.getByTestId(TESTIDS.pictionaryDrawingFullscreenPreview);
    await expect(preview).toBeVisible();
    const closeButton = this.page.getByTestId(TESTIDS.pictionaryDrawingFullscreenCloseButton);
    await expect(closeButton).toHaveAccessibleName('关闭');
    await closeButton.click();
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
    await expect(this.page.getByTestId(TESTIDS.galleryAlbumEyebrow)).toHaveText('第 1 / 4 本画册', {
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
    const eyebrow = this.page.getByTestId(TESTIDS.galleryAlbumEyebrow);
    await expect(eyebrow).toHaveText(`第 ${chain} / ${chainTotal} 本画册`, { timeout: 15_000 });
    const revealedEntries = this.page.getByTestId(TESTIDS.pictionaryGalleryEntry);
    await expect(revealedEntries).toHaveCount(entry, { timeout: 10_000 });
    await expect(
      revealedEntries.last().getByTestId(TESTIDS.pictionaryGalleryEntryPosition),
    ).toHaveText(`第 ${entry} / ${entryTotal} 棒`);
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
      await expect(eyebrow).toBeInViewport();
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
    const commandPromise = this.commands.waitForCommand('pictionary.gallery.advance');
    await this.page.getByTestId(TESTIDS.pictionaryGalleryAdvanceButton).click();
    const frame = await commandPromise;
    const result = await this.commands.waitForResult(frame.commandId);
    expect(result.outcome).toBe('decided');
    const decision: unknown = result.result;
    expect(decision).toMatchObject({
      kind: 'committed',
      outcome: { kind: 'success' },
    });
  }

  /** Wait until all synchronized reveals finish and local browsing begins. */
  async expectEnded(): Promise<void> {
    const nextAlbumButton = this.page.getByTestId(
      TESTIDS.galleryPagerNextButton(TESTIDS.pictionaryStageFrame),
    );
    await expect(nextAlbumButton).toBeVisible({ timeout: 15_000 });
    await expect(nextAlbumButton).toHaveAccessibleName('下一本');
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
      const viewportHeight = await this.page.evaluate(() => window.innerHeight);
      expect(bounds.height).toBeGreaterThan(viewportHeight * MIN_TASK_MEDIA_VIEWPORT_FRACTION);
      expect(bounds.width / bounds.height).toBeCloseTo(4 / 3, 1);
    }
    expect(
      await this.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
}
