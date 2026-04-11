/**
 * shareNightReview - Share night review as screenshot image.
 *
 * Capture source is provided by caller (typically a hidden share card view).
 * Mini program path uses Canvas 2D to draw the card directly (no html2canvas).
 */
import type { RefObject } from 'react';
import { Dimensions, Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { borderRadius, spacing, type ThemeColors, typography } from '@/theme';
import { log } from '@/utils/logger';

import type { NightReviewData } from './NightReview.helpers';
import { shareImageBase64 } from './shareImage';

type ShareNightReviewResult = 'shared' | 'cancelled' | 'failed';

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
 * Mirrors the layout of NightReviewShareCard using the same theme tokens.
 */
export function renderNightReviewToCanvas(
  data: NightReviewData,
  roomNumber: string,
  colors: ThemeColors,
): string {
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio ?? 2) : 2;
  const screenWidth = Dimensions.get('window').width;
  const cardWidth = Math.round(screenWidth * 0.88);
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
  const tmpCtx = tmpCanvas.getContext('2d')!;

  let totalHeight = pad; // top padding

  // Title
  totalHeight += lineHeight.title + spacing.medium;

  // Disclaimer
  totalHeight += lineHeight.line + spacing.medium;

  // "行动摘要" section title
  totalHeight += lineHeight.section + spacing.small;

  // Action lines (with wrapping)
  tmpCtx.font = `${fontSize.line}px system-ui, -apple-system, sans-serif`;
  const wrappedActions: string[][] = [];
  for (const line of data.actionLines) {
    const wrapped = wrapText(tmpCtx, line, contentWidth - spacing.small);
    wrappedActions.push(wrapped);
    totalHeight += wrapped.length * lineHeight.line;
  }

  // Divider
  totalHeight += spacing.medium * 2 + 1;

  // "全员身份" section title
  totalHeight += lineHeight.section + spacing.small;

  // Identity lines (with wrapping)
  const wrappedIdentities: string[][] = [];
  for (const line of data.identityLines) {
    const wrapped = wrapText(tmpCtx, line, contentWidth - spacing.small);
    wrappedIdentities.push(wrapped);
    totalHeight += wrapped.length * lineHeight.line;
  }

  totalHeight += pad; // bottom padding

  // ── Create final canvas ──
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cardWidth * dpr);
  canvas.height = Math.round(totalHeight * dpr);
  const ctx = canvas.getContext('2d')!;
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
  ctx.fillText(`房间 ${roomNumber} 战报`, cardWidth / 2, y + lineHeight.title / 2);
  y += lineHeight.title + spacing.medium;

  // ── Disclaimer ──
  ctx.font = `${fontSize.line}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = colors.textSecondary;
  ctx.fillText('⚠ 仅供裁判及观战者参考', cardWidth / 2, y + lineHeight.line / 2);
  y += lineHeight.line + spacing.medium;

  // ── "行动摘要" ──
  ctx.font = `600 ${fontSize.section}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = colors.primary;
  ctx.textAlign = 'left';
  ctx.fillText('行动摘要', pad, y + lineHeight.section / 2);
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

  // ── "全员身份" ──
  ctx.font = `600 ${fontSize.section}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = colors.primary;
  ctx.fillText('全员身份', pad, y + lineHeight.section / 2);
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
  return idx >= 0 ? dataUrl.slice(idx + prefix.length) : dataUrl;
}

export async function captureNightReviewCard(ref: RefObject<View | null>): Promise<string> {
  if (Platform.OS === 'web') {
    const html2canvas = (await import('html2canvas')).default;
    const node = ref.current as unknown as HTMLElement;
    if (!node) throw new Error('Night review share card ref not ready');
    const canvas = await html2canvas(node, { backgroundColor: null });
    const dataUrl = canvas.toDataURL('image/png');
    const prefix = 'base64,';
    const idx = dataUrl.indexOf(prefix);
    return idx >= 0 ? dataUrl.slice(idx + prefix.length) : dataUrl;
  }

  return captureRef(ref, { format: 'png', result: 'base64', quality: 1 });
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
  roomNumber: string,
): Promise<ShareNightReviewResult> {
  try {
    await shareImageBase64(
      getBase64,
      `room-${roomNumber}-review.png`,
      `狼人杀房间 ${roomNumber} 战报`,
    );
    return 'shared';
  } catch (error) {
    if (isShareCancelledError(error)) return 'cancelled';
    log.warn('Share night review failed:', error);
    return 'failed';
  }
}
