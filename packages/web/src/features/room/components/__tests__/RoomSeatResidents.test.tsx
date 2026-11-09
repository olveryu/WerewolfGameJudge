/**
 * Seat entrance interplay, as in the previous room tile: the entrance plays when the seat
 * mounts, the flair and pet hide while it plays (the frame stays), they show again once it
 * completes, and it replays after `ENTRANCE_REPLAY_DELAY_MS`.
 */
import { act, render, waitFor } from '@testing-library/react';
import { createRef, Suspense } from 'react';

import { RoomSeatResidents } from '@/features/room/components/RoomSeatScene';
import type { DecorationSpec } from '@/scene/decoration';
import { ENTRANCE_REPLAY_DELAY_MS, type EntranceSpec } from '@/scene/entrance';
import type { ResidentDecorations } from '@/scene/residentDecorations';
import type { EntranceCallbacks } from '@/scene/stageEntrance';

interface FakeHandle {
  spec: DecorationSpec;
  suspended: boolean;
}

const stage = vi.hoisted(() => ({
  decorations: [] as FakeHandle[],
  entrance: null as { callbacks: EntranceCallbacks; plays: number } | null,
}));

vi.mock('@/scene/sceneStagePromise', () => {
  const fakeStage = {
    mount: (spec: DecorationSpec) => {
      const handle: FakeHandle = { spec, suspended: false };
      stage.decorations.push(handle);
      return {
        setRect: () => {},
        setSuspended: (suspended: boolean) => {
          handle.suspended = suspended;
        },
        destroy: () => {},
      };
    },
    mountEntrance: (_spec: EntranceSpec, callbacks: EntranceCallbacks) => {
      const entrance = { callbacks, plays: 0 };
      stage.entrance = entrance;
      return {
        setGeometry: () => {},
        play: () => {
          entrance.plays += 1;
          callbacks.onActiveChange(true);
        },
        destroy: () => {},
      };
    },
  };
  const ready = Promise.resolve(fakeStage);
  return { sceneStagePromise: () => ready };
});

const residents: ResidentDecorations = {
  frameId: 'ironForge',
  flairId: 'fireRing',
  petId: 'tarot',
  entranceId: 'fadeRedEnter',
};

function suspendedIds(): Record<string, boolean> {
  return Object.fromEntries(stage.decorations.map((handle) => [handle.spec.id, handle.suspended]));
}

/** jsdom has no layout: every element's offset parent is its DOM parent. */
function stubLayout() {
  vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.parentElement;
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
}

function mountSeat() {
  const host = createRef<HTMLDivElement>();
  const tile = createRef<HTMLButtonElement>();
  const avatar = createRef<HTMLSpanElement>();
  const ghosts = createRef<HTMLSpanElement>();
  render(
    <div ref={host}>
      <button ref={tile} type="button">
        <span ref={ghosts} />
        <span ref={avatar}>
          <span className="avatar" />
        </span>
      </button>
      <Suspense fallback={null}>
        <RoomSeatResidents
          residents={residents}
          tileRef={tile}
          hostRef={host}
          avatarRef={avatar}
          ghostHostRef={ghosts}
        />
      </Suspense>
    </div>,
  );
}

describe('RoomSeatResidents entrance interplay', () => {
  beforeEach(() => {
    stage.decorations = [];
    stage.entrance = null;
    stubLayout();
    return () => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      vi.useRealTimers();
    };
  });

  it('plays on mount, hides flair and pet while active, and replays after the delay', async () => {
    // An awaited act lets the suspended seat resume once its lazy specs and the stage resolve.
    await act(async () => {
      mountSeat();
    });
    await waitFor(() => expect(stage.entrance?.plays).toBe(1));
    expect(suspendedIds()).toEqual({ ironForge: false, fireRing: true, tarot: true });

    vi.useFakeTimers();
    act(() => stage.entrance?.callbacks.onActiveChange(false));
    expect(suspendedIds()).toEqual({ ironForge: false, fireRing: false, tarot: false });

    act(() => {
      vi.advanceTimersByTime(ENTRANCE_REPLAY_DELAY_MS - 1);
    });
    expect(stage.entrance?.plays).toBe(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(stage.entrance?.plays).toBe(2);
    expect(suspendedIds()).toEqual({ ironForge: false, fireRing: true, tarot: true });
  });
});
