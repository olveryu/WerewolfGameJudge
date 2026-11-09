import './SceneBenchPage.css';

import { FRAME_IDS, type FrameId } from '@game-judge/game-engine/product/rewards';
import { type RefObject, Suspense, use, useRef } from 'react';
import { useSearchParams } from 'react-router';

import type { DecorationSpec } from '@/scene/decoration';
import { FLAIR_SPECS } from '@/scene/flairs/registry';
import { loadFrameSpec } from '@/scene/frames/registry';
import { SceneCanvas } from '@/scene/SceneCanvas';
import { SeatDecoration } from '@/scene/SeatDecoration';
import type { SceneFrameRate } from '@/scene/stage';
import { usePrefersReducedMotion } from '@/scene/usePrefersReducedMotion';

const SEAT_COUNT = 12;
const DEFAULT_FLAIRS = 'fireRing,goldenShine,snowfall';

function flairSpec(id: string): DecorationSpec {
  const spec = [...FLAIR_SPECS.values()].find((candidate) => candidate.id === id);
  if (!spec) {
    throw new Error(`Unknown flair "${id}"`);
  }
  return spec;
}

const FRAME_ID_SET: ReadonlySet<string> = new Set(FRAME_IDS);

function isFrameId(id: string): id is FrameId {
  return FRAME_ID_SET.has(id);
}

function frameSpec(id: string): Promise<DecorationSpec> {
  if (!isFrameId(id)) {
    throw new Error(`Unknown frame "${id}"`);
  }
  return loadFrameSpec(id);
}

/**
 * `?frames=a,b` and `?flairs=c,d` pick the decorations; seats cycle through each list (seat 1
 * the first, …), frame under flair. Without either, seats show the default flairs.
 */
async function parseSeatDecorations(
  flairs: string | null,
  frames: string | null,
): Promise<readonly (readonly DecorationSpec[])[]> {
  const flairIds = flairs ?? (frames === null ? DEFAULT_FLAIRS : null);
  const flairSpecs = flairIds === null ? [] : flairIds.split(',').map(flairSpec);
  const frameSpecs = frames === null ? [] : await Promise.all(frames.split(',').map(frameSpec));
  return Array.from({ length: SEAT_COUNT }, (_, seat) =>
    [frameSpecs[seat % frameSpecs.length], flairSpecs[seat % flairSpecs.length]].filter(
      (spec) => spec !== undefined,
    ),
  );
}

/** Parsed once per query, so the seats' decoration effects stay mounted across renders. */
const seatDecorationsByQuery = new Map<string, Promise<readonly (readonly DecorationSpec[])[]>>();

function seatDecorationsFor(
  flairs: string | null,
  frames: string | null,
): Promise<readonly (readonly DecorationSpec[])[]> {
  const key = `${flairs}|${frames}`;
  let seats = seatDecorationsByQuery.get(key);
  if (!seats) {
    seats = parseSeatDecorations(flairs, frames);
    seatDecorationsByQuery.set(key, seats);
  }
  return seats;
}

function parseFrameRate(value: string | null): SceneFrameRate {
  if (value === null || value === '60') return 60;
  if (value === '30') return 30;
  throw new Error(`Unsupported fps "${value}"; use 60 or 30`);
}

interface BenchSeatProps {
  seat: number;
  seatDecorations: Promise<readonly (readonly DecorationSpec[])[]>;
  hostRef: RefObject<HTMLDivElement | null>;
  animate: boolean;
}

function BenchSeatDecoration({
  seat,
  seatDecorations,
  tileRef,
  hostRef,
}: Omit<BenchSeatProps, 'animate'> & { tileRef: RefObject<HTMLDivElement | null> }) {
  const decorations = use(seatDecorations)[seat - 1];
  if (!decorations) {
    throw new Error(`Bench seat ${seat} has no decorations`);
  }
  return <SeatDecoration decorations={decorations} tileRef={tileRef} hostRef={hostRef} />;
}

function BenchSeat({ seat, seatDecorations, hostRef, animate }: BenchSeatProps) {
  const tileRef = useRef<HTMLDivElement>(null);
  return (
    <li className="bench-seat">
      <div ref={tileRef} className="bench-tile">
        {seat}
      </div>
      <span className="bench-name">{`玩家 ${seat}`}</span>
      {animate && (
        <Suspense fallback={null}>
          <BenchSeatDecoration
            seat={seat}
            seatDecorations={seatDecorations}
            tileRef={tileRef}
            hostRef={hostRef}
          />
        </Suspense>
      )}
    </li>
  );
}

/**
 * Scene-layer benchmark: a 12-seat board with DOM seats and PixiJS decorations, used by
 * `scripts/scene-bench.mjs` and for side-by-side checks on devices. `?fps=30` caps the stage;
 * `?frames=id1,id2` and `?flairs=id3,id4` pick the decorations.
 */
export function SceneBenchPage() {
  const [searchParams] = useSearchParams();
  const frameRate = parseFrameRate(searchParams.get('fps'));
  const seatDecorations = seatDecorationsFor(
    searchParams.get('flairs'),
    searchParams.get('frames'),
  );
  const prefersReducedMotion = usePrefersReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);

  return (
    <main className="bench-page">
      <h1>场景层基准</h1>
      <div ref={hostRef} className="bench-board">
        <ol className="bench-grid">
          {Array.from({ length: SEAT_COUNT }, (_, index) => (
            <BenchSeat
              key={index + 1}
              seat={index + 1}
              seatDecorations={seatDecorations}
              hostRef={hostRef}
              animate={!prefersReducedMotion}
            />
          ))}
        </ol>
        <Suspense fallback={null}>
          <SceneCanvas hostRef={hostRef} frameRate={frameRate} />
        </Suspense>
      </div>
    </main>
  );
}
