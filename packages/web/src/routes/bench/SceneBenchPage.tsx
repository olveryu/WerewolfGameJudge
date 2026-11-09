import './SceneBenchPage.css';

import { type RefObject, Suspense, useRef } from 'react';
import { useSearchParams } from 'react-router';

import type { DecorationSpec } from '@/scene/decoration';
import { FLAIR_SPECS } from '@/scene/flairs/registry';
import { SceneCanvas } from '@/scene/SceneCanvas';
import { SeatDecoration } from '@/scene/SeatDecoration';
import type { SceneFrameRate } from '@/scene/stage';
import { usePrefersReducedMotion } from '@/scene/usePrefersReducedMotion';

const SEAT_COUNT = 12;
const DEFAULT_FLAIRS = ['fireRing', 'goldenShine', 'snowfall'] as const;

/** `?flairs=a,b,c` picks the flairs; seats cycle through them (seat 1 the first, …). */
function parseFlairs(value: string | null): readonly (readonly DecorationSpec[])[] {
  const ids = value === null ? DEFAULT_FLAIRS : value.split(',');
  const specs = ids.map((id) => {
    const spec = [...FLAIR_SPECS.values()].find((candidate) => candidate.id === id);
    if (!spec) {
      throw new Error(`Unknown flair "${id}"`);
    }
    return [spec];
  });
  return Array.from({ length: SEAT_COUNT }, (_, seat) => specs[seat % specs.length]!);
}

/** Parsed once per query value, so the seats' decoration effects stay mounted across renders. */
const seatDecorationsByQuery = new Map<string | null, readonly (readonly DecorationSpec[])[]>();

function seatDecorationsFor(value: string | null): readonly (readonly DecorationSpec[])[] {
  let seats = seatDecorationsByQuery.get(value);
  if (!seats) {
    seats = parseFlairs(value);
    seatDecorationsByQuery.set(value, seats);
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
  decorations: readonly DecorationSpec[];
  hostRef: RefObject<HTMLDivElement | null>;
  animate: boolean;
}

function BenchSeat({ seat, decorations, hostRef, animate }: BenchSeatProps) {
  const tileRef = useRef<HTMLDivElement>(null);
  return (
    <li className="bench-seat">
      <div ref={tileRef} className="bench-tile">
        {seat}
      </div>
      <span className="bench-name">{`玩家 ${seat}`}</span>
      {animate && (
        <Suspense fallback={null}>
          <SeatDecoration decorations={decorations} tileRef={tileRef} hostRef={hostRef} />
        </Suspense>
      )}
    </li>
  );
}

/**
 * Scene-layer benchmark: a 12-seat board with DOM seats and PixiJS decorations, used by
 * `scripts/scene-bench.mjs` and for side-by-side checks on devices. `?fps=30` caps the stage;
 * `?flairs=id1,id2` picks the flairs.
 */
export function SceneBenchPage() {
  const [searchParams] = useSearchParams();
  const frameRate = parseFrameRate(searchParams.get('fps'));
  const seatDecorations = seatDecorationsFor(searchParams.get('flairs'));
  const prefersReducedMotion = usePrefersReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);

  return (
    <main className="bench-page">
      <h1>场景层基准</h1>
      <div ref={hostRef} className="bench-board">
        <ol className="bench-grid">
          {seatDecorations.map((decorations, index) => (
            <BenchSeat
              key={index + 1}
              seat={index + 1}
              decorations={decorations}
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
