/**
 * Collection previews on the scene layer: an avatar tile that shows a frame, flair, pet or seat
 * entrance through the room's own scene code, and the one scene host a page puts over its previews.
 */
import './ResidentPreview.css';

import { type RefObject, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { Avatar } from '@/components/avatar/Avatar';
import { RoomSeatResidents, RoomSeatSceneCanvas } from '@/features/room/components/RoomSeatScene';
import { displaySettings } from '@/features/settings/displaySettings';
import type { ResidentDecorations } from '@/scene/residentDecorations';
import { usePrefersReducedMotion } from '@/scene/usePrefersReducedMotion';

/**
 * The page's scene canvas host, laid over the previews' shared positioned container. A host in
 * a dialog takes the canvas over the page's while the dialog is open. Renders nothing while the
 * user prefers reduced motion.
 */
export function ResidentSceneLayer({ hostRef }: { hostRef: RefObject<HTMLDivElement | null> }) {
  const display = useSyncExternalStore(displaySettings.subscribe, displaySettings.getSnapshot);
  const prefersReducedMotion = usePrefersReducedMotion();
  if (prefersReducedMotion) return null;
  return (
    <div ref={hostRef} className="resident-scene-host" aria-hidden>
      <Suspense fallback={null}>
        <RoomSeatSceneCanvas hostRef={hostRef} frameRate={display.sceneFrameRate} />
      </Suspense>
    </div>
  );
}

/** Whether `ref` is fully inside its scroll root (or the viewport), so stage drawing never spills. */
function useFullyVisible(
  ref: RefObject<HTMLElement | null>,
  scrollRootRef: RefObject<HTMLElement | null> | undefined,
): boolean {
  const [isVisible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) throw new Error('Resident preview tile is not mounted');
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (entry) setVisible(entry.intersectionRatio >= 1);
      },
      { root: scrollRootRef?.current ?? null, threshold: 1 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, scrollRootRef]);
  return isVisible;
}

interface ResidentAvatarTileProps {
  readonly userId: string;
  readonly avatarUrl: string | null;
  /** The decorations to preview; null shows the plain avatar. */
  readonly residents: ResidentDecorations | null;
  /** The page's {@link ResidentSceneLayer} host. */
  readonly sceneHostRef: RefObject<HTMLDivElement | null>;
  /** The scroll container the tile lives in; absent for a tile outside any scroller. */
  readonly scrollRootRef?: RefObject<HTMLElement | null>;
  /** Dims the avatar and its stage-drawn decorations (a locked item). */
  readonly opacity?: number;
  readonly className?: string;
}

/**
 * An avatar tile with its decorations drawn by the room seat scene. Sized by its parent; the
 * decorations mount only while the tile is fully visible and motion is allowed.
 */
export function ResidentAvatarTile({
  userId,
  avatarUrl,
  residents,
  sceneHostRef,
  scrollRootRef,
  opacity = 1,
  className,
}: ResidentAvatarTileProps) {
  const tileRef = useRef<HTMLSpanElement>(null);
  const avatarRef = useRef<HTMLSpanElement>(null);
  const ghostHostRef = useRef<HTMLSpanElement>(null);
  const isVisible = useFullyVisible(tileRef, scrollRootRef);
  const prefersReducedMotion = usePrefersReducedMotion();
  const shownResidents = isVisible && !prefersReducedMotion ? residents : null;
  const hasEntrance = shownResidents?.entranceId != null;
  return (
    <span
      ref={tileRef}
      className={className === undefined ? 'resident-tile' : `resident-tile ${className}`}
      data-framed={residents?.frameId != null}
      style={{ opacity }}
    >
      <span className="resident-tile-stage" data-entrance={hasEntrance}>
        {hasEntrance && <span ref={ghostHostRef} className="resident-tile-ghosts" />}
        <span ref={avatarRef} className="resident-tile-avatar">
          <Avatar userId={userId} avatarUrl={avatarUrl} size="fill" />
        </span>
      </span>
      {shownResidents !== null && (
        <Suspense fallback={null}>
          <RoomSeatResidents
            residents={shownResidents}
            tileRef={tileRef}
            hostRef={sceneHostRef}
            avatarRef={avatarRef}
            ghostHostRef={ghostHostRef}
            opacity={opacity}
          />
        </Suspense>
      )}
    </span>
  );
}
