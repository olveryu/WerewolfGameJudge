import './SceneBenchPage.css';

import { type RefObject, Suspense, useRef } from 'react';
import { useSearchParams } from 'react-router';

import type { DecorationSpec } from '@/scene/decoration';
import { fireRingFlair } from '@/scene/flairs/fireRing';
import { goldenShineFlair } from '@/scene/flairs/goldenShine';
import { snowfallFlair } from '@/scene/flairs/snowfall';
import { SceneCanvas } from '@/scene/SceneCanvas';
import { SeatDecoration } from '@/scene/SeatDecoration';
import type { SceneFrameRate } from '@/scene/stage';
import { usePrefersReducedMotion } from '@/scene/usePrefersReducedMotion';

const SEAT_COUNT = 12;
const FLAIRS: readonly DecorationSpec[] = [fireRingFlair, goldenShineFlair, snowfallFlair];
/** Seats cycle through the flairs: seat 1 fire ring, seat 2 golden shine, seat 3 snowfall, … */
const SEATS = Array.from({ length: SEAT_COUNT / FLAIRS.length }, (_, round) =>
  FLAIRS.map((decoration, offset) => ({ seat: round * FLAIRS.length + offset + 1, decoration })),
).flat();

function parseFrameRate(value: string | null): SceneFrameRate {
  if (value === null || value === '60') return 60;
  if (value === '30') return 30;
  throw new Error(`Unsupported fps "${value}"; use 60 or 30`);
}

interface BenchSeatProps {
  seat: number;
  decoration: DecorationSpec;
  hostRef: RefObject<HTMLDivElement | null>;
  animate: boolean;
}

function BenchSeat({ seat, decoration, hostRef, animate }: BenchSeatProps) {
  const tileRef = useRef<HTMLDivElement>(null);
  return (
    <li className="bench-seat">
      <div ref={tileRef} className="bench-tile">
        {seat}
      </div>
      <span className="bench-name">{`玩家 ${seat}`}</span>
      {animate && (
        <Suspense fallback={null}>
          <SeatDecoration decoration={decoration} tileRef={tileRef} hostRef={hostRef} />
        </Suspense>
      )}
    </li>
  );
}

/**
 * Scene-layer benchmark (P0 spike): a 12-seat board with DOM seats and PixiJS decorations, used
 * by `scripts/scene-bench.mjs` and for side-by-side checks on devices. `?fps=30` caps the stage.
 */
export function SceneBenchPage() {
  const [searchParams] = useSearchParams();
  const frameRate = parseFrameRate(searchParams.get('fps'));
  const prefersReducedMotion = usePrefersReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);

  return (
    <main className="bench-page">
      <h1>场景层基准</h1>
      <div ref={hostRef} className="bench-board">
        <ol className="bench-grid">
          {SEATS.map(({ seat, decoration }) => (
            <BenchSeat
              key={seat}
              seat={seat}
              decoration={decoration}
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
