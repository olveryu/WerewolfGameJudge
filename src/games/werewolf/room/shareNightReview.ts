/**
 * shareNightReview - Share night review as screenshot image.
 *
 * Capture source is provided by caller (typically a hidden share card view).
 * Mini program fallback path uses Canvas 2D to draw the card directly (no
 * html2canvas): renderNightReviewToCanvas below is the text-medium rendering
 * of the same report — it consumes the same NightReviewData entries in order
 * and the shared layout/copy spec in nightReviewLayout, and the structural
 * alignment with the DOM presentation is pinned by nightReviewCanvasAlignment
 * tests. It must not grow a second hand-drawn layout spec.
 */
import type { RefObject } from 'react';
import { Dimensions, type View } from 'react-native';

import { captureViewPngBase64 } from '@/features/room/services/captureViewPngBase64';
import { captureViewSegmentedPngBase64 } from '@/features/room/services/captureViewSegmentedPngBase64';
import { shareImageBase64 } from '@/features/room/services/shareImage';
import { borderRadius, spacing, type ThemeColors, typography } from '@/theme';
import { log } from '@/utils/logger';

import type { NightReviewData } from './NightReview.helpers';
import {
  formatNightReviewShareTitle,
  NIGHT_REVIEW_ACTIONS_TITLE,
  NIGHT_REVIEW_CARD_WIDTH_RATIO,
  NIGHT_REVIEW_DISCLAIMER_TEXT,
  NIGHT_REVIEW_IDENTITIES_TITLE,
} from './nightReviewLayout';
import {
  formatNightReviewActionLine,
  formatNightReviewIdentityLine,
} from './shareNightReviewLines';

type ShareNightReviewResult = 'shared' | 'cancelled' | 'failed';

/**
 * Trial switch: when true, the mini-program share path captures the share card
 * with the segmented band capture instead of the Canvas 2D renderer below.
 * Set to false to fall back to the hand-drawn renderer.
 */
export const SEGMENTED_CAPTURE_TRIAL_ENABLED = true;

// ─────────────────────────────────────────────────────────────────────────────
// Canvas 2D renderer — draws the battle report card without DOM/html2canvas.
// Used by mini program web-view where html2canvas has overflow clipping issues.
// ─────────────────────────────────────────────────────────────────────────────

/** Draw a rounded-rect path on ctx. */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Wrap a single line of text into multiple lines that fit within maxWidth.
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    let end = remaining.length;
    while (ctx.measureText(remaining.slice(0, end)).width > maxWidth && end > 1) {
      end--;
    }
    lines.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }
  return lines;
}

/**
 * Render NightReviewData to a canvas and return base64 PNG.
 * Text-medium rendering of the shared report: geometry and copy come from
 * nightReviewLayout (the same spec the DOM surfaces use) and theme tokens;
 * entries are drawn in NightReviewData order via shareNightReviewLines.
 */
export function renderNightReviewToCanvas(
  data: NightReviewData,
  roomCode: string,
  colors: ThemeColors,
): string {
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio ?? 2) : 2;
  const screenWidth = Dimensions.get('window').width;
  const cardWidth = Math.round(screenWidth * NIGHT_REVIEW_CARD_WIDTH_RATIO);
  const pad = spacing.large;
  const contentWidth = cardWidth - pad * 2;
  const fontSize = {
    title: typography.subtitle,
    section: typography.body,
    line: typography.secondary,
  };
  const lineHeight = {
    title: typography.lineHeights.subtitle,
    section: typography.lineHeights.body,
    line: typography.lineHeights.secondary,
  };

  // ── Measure total height ──
  // We need a temporary canvas for measureText
  const tmpCanvas = document.createElement('canvas');
  const tmpCtx = tmpCanvas.getContext('2d');
  if (tmpCtx === null) {
    throw new Error('[FAIL-FAST] Canvas 2D context is unavailable for night review measurement');
  }

  let totalHeight = pad; // top padding

  // Title
  totalHeight += lineHeight.title + spacing.medium;

  // Disclaimer
  totalHeight += lineHeight.line + spacing.medium;

  // Actions section title
  totalHeight += lineHeight.section + spacing.small;

  // Action lines (with wrapping)
  tmpCtx.font = `${fontSize.line}px system-ui, -apple-system, sans-serif`;
  const actionLines = data.actions.map((entry) => formatNightReviewActionLine(entry));
  const wrappedActions: string[][] = [];
  for (const line of actionLines) {
    const wrapped = wrapText(tmpCtx, line, contentWidth - spacing.small);
    wrappedActions.push(wrapped);
    totalHeight += wrapped.length * lineHeight.line;
  }

  // Divider
  totalHeight += spacing.medium * 2 + 1;

  // Identities section title
  totalHeight += lineHeight.section + spacing.small;

  // Identity lines (with wrapping)
  const identityLines = data.identities.map((entry) => formatNightReviewIdentityLine(entry));
  const wrappedIdentities: string[][] = [];
  for (const line of identityLines) {
    const wrapped = wrapText(tmpCtx, line, contentWidth - spacing.small);
    wrappedIdentities.push(wrapped);
    totalHeight += wrapped.length * lineHeight.line;
  }

  totalHeight += pad; // bottom padding

  // ── Create final canvas ──
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cardWidth * dpr);
  canvas.height = Math.round(totalHeight * dpr);
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('[FAIL-FAST] Canvas 2D context is unavailable for night review rendering');
  }
  ctx.scale(dpr, dpr);

  // ── Card background ──
  roundRect(ctx, 0, 0, cardWidth, totalHeight, borderRadius.large);
  ctx.fillStyle = colors.surface;
  ctx.fill();
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  let y = pad;

  // ── Title ──
  ctx.font = `bold ${fontSize.title}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = colors.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatNightReviewShareTitle(roomCode), cardWidth / 2, y + lineHeight.title / 2);
  y += lineHeight.title + spacing.medium;

  // ── Disclaimer ──
  ctx.font = `${fontSize.line}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = colors.textSecondary;
  ctx.fillText(`⚠ ${NIGHT_REVIEW_DISCLAIMER_TEXT}`, cardWidth / 2, y + lineHeight.line / 2);
  y += lineHeight.line + spacing.medium;

  // ── Actions section ──
  ctx.font = `600 ${fontSize.section}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = colors.primary;
  ctx.textAlign = 'left';
  ctx.fillText(NIGHT_REVIEW_ACTIONS_TITLE, pad, y + lineHeight.section / 2);
  y += lineHeight.section + spacing.small;

  // ── Action lines ──
  ctx.font = `${fontSize.line}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = colors.text;
  for (const wrapped of wrappedActions) {
    for (const wLine of wrapped) {
      ctx.fillText(wLine, pad + spacing.small, y + lineHeight.line / 2);
      y += lineHeight.line;
    }
  }

  // ── Divider ──
  y += spacing.medium;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(cardWidth - pad, y);
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  ctx.stroke();
  y += 1 + spacing.medium;

  // ── Identities section ──
  ctx.font = `600 ${fontSize.section}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = colors.primary;
  ctx.fillText(NIGHT_REVIEW_IDENTITIES_TITLE, pad, y + lineHeight.section / 2);
  y += lineHeight.section + spacing.small;

  // ── Identity lines ──
  ctx.font = `${fontSize.line}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = colors.text;
  for (const wrapped of wrappedIdentities) {
    for (const wLine of wrapped) {
      ctx.fillText(wLine, pad + spacing.small, y + lineHeight.line / 2);
      y += lineHeight.line;
    }
  }

  const dataUrl = canvas.toDataURL('image/png');
  const prefix = 'base64,';
  const idx = dataUrl.indexOf(prefix);
  if (idx < 0) {
    throw new Error('[FAIL-FAST] Night review canvas must produce a base64 data URL');
  }
  return dataUrl.slice(idx + prefix.length);
}

export async function captureNightReviewCard(ref: RefObject<View | null>): Promise<string> {
  return captureViewPngBase64(ref);
}

export async function captureNightReviewCardSegmented(
  ref: RefObject<View | null>,
): Promise<string> {
  return captureViewSegmentedPngBase64(ref);
}

function isShareCancelledError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const normalized = `${error.name} ${error.message}`.toLowerCase();
  return (
    normalized.includes('abort') || normalized.includes('cancel') || normalized.includes('dismiss')
  );
}

export async function shareNightReviewReportImage(
  getBase64: () => Promise<string>,
  roomCode: string,
): Promise<ShareNightReviewResult> {
  try {
    await shareImageBase64(getBase64, `room-${roomCode}-review.png`, `狼人杀房间 ${roomCode} 战报`);
    return 'shared';
  } catch (error) {
    if (isShareCancelledError(error)) return 'cancelled';
    log.warn('Share night review failed', error);
    return 'failed';
  }
}
