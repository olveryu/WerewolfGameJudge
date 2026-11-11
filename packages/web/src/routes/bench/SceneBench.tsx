import './SceneBench.css';

import {
  FRAME_IDS,
  type FrameId,
  ROLE_REVEAL_EFFECT_IDS,
  type RoleRevealEffectId,
} from '@game-judge/game-engine/product/rewards';
import { lazy, type RefObject, Suspense, use, useRef } from 'react';
import { useSearchParams } from 'react-router';

import {
  REVEAL_ROOT_STYLE,
  REVEAL_TITLE_ROW_STYLE,
  REVEAL_TITLE_STYLE,
  revealTitle,
} from '@/features/room/components/RoleRevealEffects/common/shell';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';
import type { RoomSeatViewModel } from '@/features/room/model/RoomSeatDataSource';
import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import type { DecorationSpec } from '@/scene/decoration';
import { FLAIR_SPECS } from '@/scene/flairs/registry';
import { loadFrameSpec } from '@/scene/frames/registry';
import { SceneCanvas } from '@/scene/SceneCanvas';
import { SeatDecoration } from '@/scene/SeatDecoration';
import type { SceneFrameRate } from '@/scene/stage';
import { usePrefersReducedMotion } from '@/scene/usePrefersReducedMotion';

const SEAT_COUNT = 12;
const DEFAULT_FLAIRS = 'fireRing,goldenShine,snowfall';
const NOTHING_SUSPENDED: ReadonlySet<DecorationSpec> = new Set();

// Lazy, so the bench route does not share the room's chunks with the scene layer.
const RoomSeatBoard = lazy(() =>
  import('@/features/room/components/RoomSeatBoard').then((module) => ({
    default: module.RoomSeatBoard,
  })),
);

// The room's RoleRevealAnimator is room-only (see there), so the bench draws its shell itself.
const RevealEffectStage = lazy(() =>
  import('@/features/room/components/RoomSeatScene').then((module) =>
    module.loadRevealEffectStage(),
  ),
);

/** The roles the previous client's reveal-effect preview played, so frames compare 1:1. */
const BENCH_REVEAL_ROLE: RevealRoleData = { id: 'villager', name: '村民', alignment: 'villager' };
const BENCH_REVEAL_ROLES: readonly RevealRoleData[] = [
  BENCH_REVEAL_ROLE,
  { id: 'wolf', name: '狼人', alignment: 'wolf' },
  { id: 'seer', name: '预言家', alignment: 'god' },
  { id: 'witch', name: '女巫', alignment: 'god' },
  { id: 'hunter', name: '猎人', alignment: 'god' },
  { id: 'guard', name: '守卫', alignment: 'god' },
];
const REVEAL_EFFECT_ID_SET: ReadonlySet<string> = new Set(ROLE_REVEAL_EFFECT_IDS);

function isRevealEffectId(id: string): id is RoleRevealEffectId {
  return REVEAL_EFFECT_ID_SET.has(id);
}

/** `?reveal=<id>` plays one role reveal effect full screen, without interaction. */
function BenchReveal({ effectId }: { effectId: string }) {
  const reducedMotion = usePrefersReducedMotion();
  if (!isRevealEffectId(effectId)) {
    throw new Error(`Unknown reveal effect "${effectId}"`);
  }
  return (
    <div data-testid="role-reveal-modal" style={REVEAL_ROOT_STYLE}>
      <div style={REVEAL_TITLE_ROW_STYLE}>
        <h2 style={REVEAL_TITLE_STYLE}>{revealTitle(effectId)}</h2>
      </div>
      <Suspense fallback={null}>
        <RevealEffectStage
          effectType={effectId}
          effectProps={{
            role: BENCH_REVEAL_ROLE,
            allRoles: BENCH_REVEAL_ROLES,
            reducedMotion,
            testIDPrefix: 'role-reveal',
            onComplete: () => {
              document.body.dataset.revealComplete = 'true';
            },
          }}
        />
      </Suspense>
    </div>
  );
}

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
  return (
    <SeatDecoration
      decorations={decorations}
      suspended={NOTHING_SUSPENDED}
      tileRef={tileRef}
      hostRef={hostRef}
      opacity={1}
    />
  );
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
 * One real room seat (`?board`) wearing the cosmetics named by `frame`, `flair`, `pet` (a reveal
 * effect id) and `entrance`, for side-by-side checks against the previous client's seat tile.
 */
function BenchSeatBoard({ searchParams }: { searchParams: URLSearchParams }) {
  const seat: RoomSeatViewModel = {
    seat: 0,
    player: {
      occupant: { kind: 'human', userId: 'baseline-seat' },
      displayName: '月下狼人',
      avatarFrame: searchParams.get('frame') ?? undefined,
      seatFlair: searchParams.get('flair') ?? undefined,
      seatPetId: searchParams.get('pet') ?? undefined,
      seatAnimation: searchParams.get('entrance') ?? undefined,
      isAnonymous: false,
    },
    isSelf: false,
    highlight: 'none',
    secondaryLabel: null,
    showReadyBadge: false,
    statusBadge: null,
    indicators: null,
    isStatusEmphasized: false,
    showLevel: false,
    decorationsEnabled: true,
  };
  const model: RoomSeatBoardModel = {
    source: { count: 1, revision: 1, getSeat: () => seat },
    visuallyDisabled: false,
    onSeatPress: () => {},
    onBotSeatLongPress: null,
  };
  return (
    <main className="bench-page">
      <Suspense fallback={null}>
        <RoomSeatBoard model={model} header={null} footer={null} />
      </Suspense>
    </main>
  );
}

/**
 * Scene-layer benchmark: a 12-seat board with DOM seats and PixiJS decorations, used by
 * `scripts/scene-bench.mjs` and for side-by-side checks on devices. `?fps=30` caps the stage;
 * `?frames=id1,id2` and `?flairs=id3,id4` pick the decorations; `?board` shows one real room
 * seat instead (see `BenchSeatBoard`); `?reveal=<id>` plays one reveal effect (see `BenchReveal`).
 */
export function SceneBench() {
  const [searchParams] = useSearchParams();
  const revealEffectId = searchParams.get('reveal');
  if (revealEffectId !== null) return <BenchReveal effectId={revealEffectId} />;
  if (searchParams.has('board')) return <BenchSeatBoard searchParams={searchParams} />;
  return <SceneBenchBoard searchParams={searchParams} />;
}

function SceneBenchBoard({ searchParams }: { searchParams: URLSearchParams }) {
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
