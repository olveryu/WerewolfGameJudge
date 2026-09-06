/** Pictionary room actions that drive only visible production UI and authoritative state. */

import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { enterRoomCodeViaNumPad } from '../helpers/home';
import { waitForRoomScreenReady } from '../helpers/waits';
import { RoomPage } from './RoomPage';

const PHONE_STAGE_MAX_WIDTH = 430;

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

  /** Assert the current drawing task and its opening-context contract. */
  async expectDrawingStep(step: number, totalSteps: number, isOpening: boolean): Promise<void> {
    const stage = this.page.getByTestId(TESTIDS.pictionaryStageFrame);
    await expect(stage.getByText(`第 ${step} / ${totalSteps} 棒`, { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      stage.getByText(isOpening ? '自由画一幅画' : '把这句话画出来', { exact: true }),
    ).toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.pictionaryDrawingCanvas)).toBeVisible();
    if (isOpening) {
      await expect(stage.getByText('上一棒', { exact: true })).toHaveCount(0);
    } else {
      await expect(stage.getByText('上一棒', { exact: true })).toBeVisible();
    }
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

  /** Reserve, render, upload, and commit the current drawing. */
  async submitDrawing(): Promise<void> {
    await this.page.getByTestId(TESTIDS.pictionaryDrawingSubmitButton).click();
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
  }

  /** Open and close the protected drawing's fullscreen preview. */
  async expectFullscreenDrawingPreview(): Promise<void> {
    await this.page.getByTestId(TESTIDS.pictionaryDrawingImageButton).click();
    const preview = this.page.getByTestId(TESTIDS.pictionaryDrawingFullscreenPreview);
    await expect(preview).toBeVisible();
    await this.page.getByRole('button', { name: '关闭' }).click();
    await expect(preview).not.toBeVisible();
  }

  /** Submit one valid guess through the visible composer. */
  async submitGuess(text: string): Promise<void> {
    await this.page.getByTestId(TESTIDS.pictionaryTextInput).fill(text);
    const submitButton = this.page.getByTestId(TESTIDS.pictionaryTextSubmitButton);
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
  }

  /** Wait until synchronized manual gallery playback begins. */
  async expectGallery(): Promise<void> {
    const stage = this.page.getByTestId(TESTIDS.pictionaryStageFrame);
    await expect(stage.getByText('接龙揭晓', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(this.page.getByTestId(TESTIDS.pictionaryGalleryEntry)).toBeVisible();
  }

  /** Assert the authoritative chain and entry cursors shown on this player. */
  async expectGalleryPosition(chain: number, entry: number, total: number): Promise<void> {
    const stage = this.page.getByTestId(TESTIDS.pictionaryStageFrame);
    await expect(stage.getByText(`第 ${chain} / ${total} 条接龙`, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      this.page
        .getByTestId(TESTIDS.pictionaryGalleryEntry)
        .getByText(`第 ${entry} / ${total} 棒`, { exact: true }),
    ).toBeVisible();
  }

  /** Read the current reveal block for cross-player synchronization assertions. */
  async readGalleryEntryText(): Promise<string> {
    const text = await this.page.getByTestId(TESTIDS.pictionaryGalleryEntry).textContent();
    if (text === null) throw new Error('Pictionary gallery entry has no text content');
    return text;
  }

  /** Advance the authoritative gallery cursor from the host controls. */
  async advanceGallery(): Promise<void> {
    await this.page.getByTestId(TESTIDS.pictionaryGalleryAdvanceButton).click();
  }

  /** Wait until all synchronized reveals finish and local browsing begins. */
  async expectEnded(): Promise<void> {
    await expect(
      this.page.getByTestId(TESTIDS.pictionaryStageFrame).getByText('自由回看', { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  }

  /** Assert that desktop viewports retain the product's phone-sized stage. */
  async expectPhoneSizedStage(): Promise<void> {
    const bounds = await this.page.getByTestId(TESTIDS.pictionaryStageFrame).boundingBox();
    if (bounds === null) throw new Error('Pictionary stage has no browser layout box');
    expect(bounds.width).toBeLessThanOrEqual(PHONE_STAGE_MAX_WIDTH);
  }
}
