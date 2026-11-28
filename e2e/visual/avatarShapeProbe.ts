import { expect, type Page } from '@playwright/test';

/**
 * Render probe for the one avatar shape (config/avatarShape.ts, UI drift lock P9).
 *
 * The lint rules hold the ordinary ways of writing an avatar's shape; this measures what the page
 * actually renders, so a shape set some other way (a host named without `avatar`, an outer
 * wrapper's rounded clip, a rule of higher specificity) still fails. For every rendered avatar:
 * - its own corner radius is `--avatar-corner-ratio` × its side;
 * - no ancestor clips it with `clip-path` or a mask, and no ancestor's rounded overflow clip cuts
 *   into its corners (a box concentric with the avatar, as `avatar-concentric` draws, cuts nothing).
 * Radii are the used values: `calc()` and percentages resolved against the box, the CSS overlap
 * scaling applied, and an overflow clip measured on the padding box with its inner radius.
 * An avatar inside a seat entrance is measured once the entrance rests (identity transform, no
 * wipe, full opacity); mid-motion frames are the scene's, not the shape's.
 *
 * Avatars are hidden in app-page screenshots (random ids), but the probe reads computed geometry,
 * which hiding by `visibility` leaves in place.
 */

/** Sub-pixel rounding allowed between the expected and the rendered geometry, in CSS pixels. */
const TOLERANCE_PX = 0.5;

/** How long the probe waits for the page's avatars to render and settle. */
const AVATAR_SETTLE_TIMEOUT_MS = 10_000;

interface AvatarShapeViolation {
  readonly avatar: string;
  readonly problem: string;
}

interface AvatarShapeReport {
  readonly count: number;
  readonly violations: readonly AvatarShapeViolation[];
}

async function measureAvatarShapes(page: Page): Promise<AvatarShapeReport> {
  return page.evaluate((tolerance) => {
    const ratioText = getComputedStyle(document.documentElement)
      .getPropertyValue('--avatar-corner-ratio')
      .trim();
    const ratio = Number(ratioText);
    if (ratioText === '' || !Number.isFinite(ratio)) {
      throw new Error(`--avatar-corner-ratio is not published (read "${ratioText}")`);
    }
    const describe = (element: Element): string => {
      const classes = [...element.classList].join('.');
      return `${element.tagName.toLowerCase()}${classes === '' ? '' : `.${classes}`}`;
    };
    const path = (element: Element): string => {
      const parts: string[] = [];
      for (
        let node: Element | null = element;
        node && parts.length < 4;
        node = node.parentElement
      ) {
        parts.unshift(describe(node));
      }
      return parts.join(' > ');
    };
    const px = (value: string): number => Number.parseFloat(value) || 0;
    /** Resolves a computed length (px, %, or calc() of both) against a reference length. */
    const resolve = (value: string, reference: number): number => {
      if (/^-?[\d.]+px$/.test(value)) return px(value);
      const meter = document.createElement('div');
      meter.style.cssText = `position:absolute;visibility:hidden;width:${reference}px;height:0`;
      const inner = document.createElement('div');
      inner.style.width = value;
      meter.append(inner);
      document.body.append(meter);
      const used = inner.getBoundingClientRect().width;
      meter.remove();
      return used;
    };
    /**
     * Used corner radius in px of a box (horizontal radius of the top-left corner; the boxes are
     * square or round all four corners alike), with the CSS overlap scaling: radii never exceed
     * half the box's side.
     */
    const cornerOf = (style: CSSStyleDeclaration, width: number, height: number): number => {
      const value = style.borderTopLeftRadius.split(' ')[0] ?? '0px';
      return Math.min(resolve(value, width), width / 2, height / 2);
    };
    const atRest = (element: Element): boolean => {
      const pose = element.closest('[data-entrance-pose]');
      if (pose === null) return true;
      const poseStyle = getComputedStyle(pose);
      return (
        poseStyle.transform === 'none' &&
        poseStyle.clipPath === 'none' &&
        Number(poseStyle.opacity) === 1
      );
    };
    const violations: { avatar: string; problem: string }[] = [];
    const avatars = [...document.querySelectorAll('.avatar')].filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && atRest(element);
    });
    for (const avatar of avatars) {
      const name = path(avatar);
      const box = avatar.getBoundingClientRect();
      const style = getComputedStyle(avatar);
      const radius = cornerOf(style, box.width, box.height);
      const expected = ratio * box.width;
      if (Math.abs(radius - expected) > tolerance) {
        violations.push({
          avatar: name,
          problem: `corner ${radius.toFixed(2)}px, expected ${expected.toFixed(2)}px (ratio ${ratio} of ${box.width.toFixed(2)}px)`,
        });
      }
      // The avatar's corner curve at 45°, one point per corner.
      const inset = radius * (1 - Math.SQRT1_2);
      const corners = [
        { x: box.left + inset, y: box.top + inset, sx: 1, sy: 1 },
        { x: box.right - inset, y: box.top + inset, sx: -1, sy: 1 },
        { x: box.left + inset, y: box.bottom - inset, sx: 1, sy: -1 },
        { x: box.right - inset, y: box.bottom - inset, sx: -1, sy: -1 },
      ];
      for (
        let node = avatar.parentElement;
        node && node !== document.body;
        node = node.parentElement
      ) {
        const nodeStyle = getComputedStyle(node);
        if (nodeStyle.clipPath !== 'none' || nodeStyle.maskImage !== 'none') {
          violations.push({
            avatar: name,
            problem: `${path(node)} clips it with clip-path or mask`,
          });
          continue;
        }
        const clips = nodeStyle.overflowX !== 'visible' || nodeStyle.overflowY !== 'visible';
        if (!clips) continue;
        // An overflow clip cuts along the padding box, whose corners are the border radius less
        // the border width.
        const outer = node.getBoundingClientRect();
        const borderTop = px(nodeStyle.borderTopWidth);
        const borderRight = px(nodeStyle.borderRightWidth);
        const borderBottom = px(nodeStyle.borderBottomWidth);
        const borderLeft = px(nodeStyle.borderLeftWidth);
        const frame = {
          left: outer.left + borderLeft,
          right: outer.right - borderRight,
          top: outer.top + borderTop,
          bottom: outer.bottom - borderBottom,
        };
        const frameRadius = Math.max(
          0,
          cornerOf(nodeStyle, outer.width, outer.height) - Math.max(borderLeft, borderTop),
        );
        if (frameRadius <= tolerance) continue;
        const cut = corners.some(({ x, y, sx, sy }) => {
          const cx = sx === 1 ? frame.left + frameRadius : frame.right - frameRadius;
          const cy = sy === 1 ? frame.top + frameRadius : frame.bottom - frameRadius;
          const inQuadrant = (x - cx) * sx < 0 && (y - cy) * sy < 0;
          return inQuadrant && Math.hypot(x - cx, y - cy) > frameRadius + tolerance;
        });
        if (cut) {
          violations.push({
            avatar: name,
            problem: `${path(node)} cuts its corners (rounded ${frameRadius.toFixed(2)}px clip)`,
          });
        }
      }
    }
    return { count: avatars.length, violations };
  }, TOLERANCE_PX);
}

/**
 * Asserts every rendered avatar on the page has the one shape. `expectAvatars` fails a page that
 * should show avatars but rendered none, so the probe cannot pass by measuring nothing.
 */
export async function expectAvatarShapes(page: Page, expectAvatars: boolean): Promise<void> {
  // Like the screenshot assertion that follows, wait for the page to settle: avatars render
  // after their data arrives, so a single early measurement could see none or a moving frame.
  await expect(async () => {
    const report = await measureAvatarShapes(page);
    if (expectAvatars) {
      expect(report.count, 'avatars rendered on the page').toBeGreaterThan(0);
    }
    expect(report.violations, `avatar shape violations (${report.count} avatars measured)`).toEqual(
      [],
    );
  }).toPass({ timeout: AVATAR_SETTLE_TIMEOUT_MS });
}
