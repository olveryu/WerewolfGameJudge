import { type RefObject, use, useEffect, useRef, useState } from 'react';

import {
  type AvatarCoverage,
  type AvatarPose,
  ENTRANCE_REPLAY_DELAY_MS,
  type EntranceGeometry,
  type EntranceSpec,
} from '@/scene/entrance';
import { sceneStagePromise } from '@/scene/sceneStagePromise';
import { offsetInHost } from '@/scene/SeatDecoration';
import type { EntranceHandle } from '@/scene/stageEntrance';

interface SeatEntranceProps {
  spec: EntranceSpec;
  /** The seat's tile; the entrance square is its border box. */
  tileRef: RefObject<HTMLElement | null>;
  /** The element `SceneCanvas` covers. */
  hostRef: RefObject<HTMLElement | null>;
  /** The DOM avatar the entrance moves. */
  avatarRef: RefObject<HTMLElement | null>;
  /** An element React leaves empty, behind the avatar, that receives ghost copies. */
  ghostHostRef: RefObject<HTMLElement | null>;
  /** `true` while a play is in progress (the seat hides its flair and pet). */
  onActiveChange: (active: boolean) => void;
  /** Opacity of the stage-drawn effect, for dimmed (locked) picker cells. */
  opacity: number;
}

function cssLength(value: string, basis: number): number {
  return value.endsWith('%') ? (Number.parseFloat(value) / 100) * basis : Number.parseFloat(value);
}

function relativeBox(element: HTMLElement, host: HTMLElement, origin: { x: number; y: number }) {
  const offset = offsetInHost(element, host);
  return {
    x: offset.x - origin.x,
    y: offset.y - origin.y,
    width: element.offsetWidth,
    height: element.offsetHeight,
  };
}

/** The avatar's opaque part: the wolf-paw fallback covers only its mark, a picture its box. */
function measureCoverage(
  avatar: HTMLElement,
  host: HTMLElement,
  origin: { x: number; y: number },
): AvatarCoverage {
  const picture = avatar.querySelector<HTMLElement>('.avatar');
  if (!picture) {
    throw new Error('Seat avatar has no picture to cover');
  }
  const mark = picture.querySelector<HTMLElement>('.avatar-fallback-mark');
  if (mark) {
    const url = /url\(["']?(.*?)["']?\)/.exec(mark.style.maskImage || mark.style.webkitMaskImage);
    if (!url?.[1]) {
      throw new Error('Seat avatar mark has no mask image');
    }
    return {
      kind: 'mark',
      url: url[1],
      tint: getComputedStyle(mark).backgroundColor,
      ...relativeBox(mark, host, origin),
    };
  }
  const box = relativeBox(picture, host, origin);
  const radius = cssLength(getComputedStyle(picture).borderTopLeftRadius, box.width);
  return { kind: 'box', ...box, radius };
}

function measureEntrance(
  tile: HTMLElement,
  host: HTMLElement,
  avatar: HTMLElement,
): EntranceGeometry {
  const origin = offsetInHost(tile, host);
  const avatarBox = relativeBox(avatar, host, origin);
  return {
    ...origin,
    size: tile.offsetWidth,
    cornerRadius: cssLength(getComputedStyle(tile).borderTopLeftRadius, tile.offsetWidth),
    pivotX: avatarBox.x + avatarBox.width / 2,
    pivotY: avatarBox.y + avatarBox.height / 2,
    coverage: measureCoverage(avatar, host, origin),
  };
}

/** RN transform order `[translate, rotate, scale]`, then the 3D turn with an 800 px perspective. */
function cssTransform(pose: AvatarPose): string {
  const turn = pose.rotateYDeg === 0 ? '' : ` perspective(800px) rotateY(${pose.rotateYDeg}deg)`;
  return `translate(${pose.translateX}px, ${pose.translateY}px) rotate(${pose.rotateDeg}deg) scale(${pose.scale})${turn}`;
}

function applyPose(element: HTMLElement, pose: AvatarPose): void {
  element.style.opacity = String(Math.min(1, Math.max(0, pose.opacity)));
  element.style.transform = cssTransform(pose);
  element.style.clipPath =
    pose.clipTop === 0 && pose.clipRight === 0
      ? ''
      : `inset(${pose.clipTop * 100}% ${pose.clipRight * 100}% 0 0)`;
}

function clearPose(element: HTMLElement): void {
  element.style.removeProperty('opacity');
  element.style.removeProperty('transform');
  element.style.removeProperty('clip-path');
}

/**
 * Poses the avatar (the last pose) and ghost copies cloned from it (the earlier ones). The avatar
 * hides while the stage paints it (`drawnOnStage`).
 */
function applyPoses(
  avatar: HTMLElement,
  ghostHost: HTMLElement,
  poses: readonly AvatarPose[],
  drawnOnStage: boolean,
) {
  const ghostCount = poses.length - 1;
  if (ghostHost.childElementCount !== ghostCount) {
    ghostHost.replaceChildren(...Array.from({ length: ghostCount }, () => avatar.cloneNode(true)));
  }
  poses.forEach((pose, index) => {
    const isAvatar = index === ghostCount;
    const element = isAvatar ? avatar : ghostHost.children[index];
    if (!(element instanceof HTMLElement)) {
      throw new Error('Seat entrance ghost is missing');
    }
    applyPose(element, isAvatar && drawnOnStage ? { ...pose, opacity: 0 } : pose);
  });
}

/**
 * Plays a seat's entrance on the scene stage: when it mounts (a player sits down, or the seat
 * is shown with its player already seated), then again `ENTRANCE_REPLAY_DELAY_MS` after each
 * completion, as the previous room tile's looping entrance did. Moves the DOM avatar through its
 * style and restores it on unmount. Suspends until PixiJS has loaded; throws to the nearest
 * error boundary when the avatar mark fails to load.
 */
export function SeatEntrance({
  spec,
  tileRef,
  hostRef,
  avatarRef,
  ghostHostRef,
  onActiveChange,
  opacity,
}: SeatEntranceProps) {
  const stage = use(sceneStagePromise());
  const [failure, setFailure] = useState<Error | null>(null);
  const handleRef = useRef<EntranceHandle | null>(null);
  if (failure) throw failure;

  useEffect(() => {
    const tile = tileRef.current;
    const host = hostRef.current;
    const avatar = avatarRef.current;
    const ghostHost = ghostHostRef.current;
    if (!tile || !host || !avatar || !ghostHost) {
      throw new Error('SeatEntrance tile, host or avatar is not mounted');
    }
    let replay: ReturnType<typeof setTimeout> | undefined;
    const handle = stage.mountEntrance(spec, host, {
      applyAvatar: (poses, drawnOnStage) => applyPoses(avatar, ghostHost, poses, drawnOnStage),
      onActiveChange: (active) => {
        onActiveChange(active);
        if (active) {
          ghostHost.replaceChildren();
        } else {
          replay = setTimeout(() => handle.play(), ENTRANCE_REPLAY_DELAY_MS);
        }
      },
      onError: setFailure,
    });
    const align = () => handle.setGeometry(measureEntrance(tile, host, avatar));
    const observer = new ResizeObserver(align);
    observer.observe(tile);
    observer.observe(host);
    observer.observe(avatar);
    // Scroll events do not bubble; capture catches scrolled containers inside the host.
    host.addEventListener('scroll', align, { capture: true, passive: true });
    align();
    handleRef.current = handle;
    handle.play();
    return () => {
      clearTimeout(replay);
      observer.disconnect();
      host.removeEventListener('scroll', align, { capture: true });
      handleRef.current = null;
      handle.destroy();
      clearPose(avatar);
      ghostHost.replaceChildren();
    };
  }, [stage, spec, tileRef, hostRef, avatarRef, ghostHostRef, onActiveChange]);

  useEffect(() => {
    handleRef.current?.setOpacity(opacity);
  }, [stage, spec, onActiveChange, opacity]);

  return null;
}
