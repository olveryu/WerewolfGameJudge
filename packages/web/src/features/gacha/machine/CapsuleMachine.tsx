/**
 * CapsuleMachine — the gacha machine drawn on the shared scene stage's canvas, mounted as the
 * stage overlay. Loaded lazily by the gacha page, so PixiJS and the physics stay out of the
 * page chunk. The ticker runs only while a draw animates; an idle or finished machine is a still
 * frame. `released` hands the canvas back (a result dialog previews cosmetics on the stage).
 */
import './CapsuleMachine.css';

import type { Rarity } from '@game-judge/game-engine/product/rewards';
import type { Container } from 'pixi.js';
import {
  type CSSProperties,
  type Ref,
  use,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { sceneStagePromise } from '@/scene/sceneStagePromise';
import type { SceneStage } from '@/scene/stage';

import { CapsuleMachineRenderer } from './capsuleMachineRenderer';
import { GachaPhysics } from './gachaPhysics';

/** Controls the page drives; `startAnimation` is never called under reduced motion. */
export interface CapsuleMachineHandle {
  startAnimation(count: number): void;
  setResults(rarities: readonly Rarity[]): void;
  cancelAnimation(): void;
}

interface CapsuleMachineProps {
  readonly drawType: 'normal' | 'golden';
  /** Receives every phase transition (`PHASE` values). */
  readonly onPhaseChange: (phase: number) => void;
  readonly released: boolean;
  readonly ref: Ref<CapsuleMachineHandle>;
}

const LABEL_COLOR = { golden: 'rgba(245,200,80,0.7)', normal: 'rgba(200,200,240,0.5)' } as const;

/** The physics, its renderer and the overlay frame loop for one machine. */
class MachineController {
  readonly physics: GachaPhysics;
  readonly renderer: CapsuleMachineRenderer;
  private shakeTarget: HTMLElement | null = null;
  private mounted = false;
  private lastFrameMs: number | null = null;

  constructor(
    private readonly stage: SceneStage,
    root: Container,
    private phaseHandler: (phase: number) => void,
  ) {
    this.physics = new GachaPhysics((phase) => this.phaseHandler(phase));
    this.renderer = new CapsuleMachineRenderer(root, this.physics);
  }

  setPhaseHandler(handler: (phase: number) => void): void {
    this.phaseHandler = handler;
  }

  readonly frame = (nowMs: number): void => {
    const elapsedMs = this.lastFrameMs === null ? 0 : nowMs - this.lastFrameMs;
    this.lastFrameMs = nowMs;
    const wasRunning = this.physics.running;
    this.physics.step(elapsedMs);
    this.renderer.render();
    if (this.shakeTarget) {
      const { shakeX, shakeY } = this.physics;
      this.shakeTarget.style.transform = `translate(${shakeX}px, ${shakeY}px)`;
    }
    if (wasRunning && !this.physics.running) this.syncTicker();
  };

  /** Draws into `host`'s stage overlay and shakes `shakeTarget` with the machine. */
  mount(host: HTMLElement, shakeTarget: HTMLElement | null): () => void {
    const release = this.stage.mountOverlay(host, this.renderer.root, this.frame);
    this.shakeTarget = shakeTarget;
    this.mounted = true;
    this.syncTicker();
    return () => {
      this.mounted = false;
      this.shakeTarget = null;
      release();
    };
  }

  /** Runs the overlay ticker while the physics animates; a still machine draws one frame. */
  syncTicker(): void {
    if (!this.mounted) return;
    if (this.physics.running) this.lastFrameMs = null;
    this.stage.setOverlayAnimating(this.renderer.root, this.physics.running);
  }
}

const HOST_STYLE: CSSProperties = { position: 'absolute', inset: 0 };

export default function CapsuleMachine({
  drawType,
  onPhaseChange,
  released,
  ref,
}: CapsuleMachineProps) {
  const stage = use(sceneStagePromise());
  const [controller] = useState(
    () => new MachineController(stage, stage.createOverlayRoot(), onPhaseChange),
  );
  const frameRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    controller.setPhaseHandler(onPhaseChange);
  }, [controller, onPhaseChange]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) throw new Error('Capsule machine frame is not mounted');
    const resizeObserver = new ResizeObserver(() => {
      controller.renderer.setLayout(frame.clientWidth);
      if (!controller.physics.running) controller.syncTicker();
    });
    controller.renderer.setLayout(frame.clientWidth);
    resizeObserver.observe(frame);
    return () => resizeObserver.disconnect();
  }, [controller]);

  useLayoutEffect(() => {
    if (released) return;
    const host = hostRef.current;
    if (!host) throw new Error('Capsule machine canvas host is not mounted');
    return controller.mount(host, shakeRef.current);
  }, [controller, released]);

  useImperativeHandle(
    ref,
    () => ({
      startAnimation(count) {
        controller.physics.start(count);
        controller.syncTicker();
      },
      setResults(rarities) {
        controller.physics.setResults(rarities);
      },
      cancelAnimation() {
        controller.physics.cancel();
        controller.syncTicker();
      },
    }),
    [controller],
  );

  const golden = drawType === 'golden';
  return (
    <div className="capsule-machine" ref={frameRef} data-testid="capsule-machine">
      <div className="capsule-machine__shake" ref={shakeRef}>
        <div ref={hostRef} style={HOST_STYLE} />
        <span
          className="capsule-machine__label"
          style={{ color: golden ? LABEL_COLOR.golden : LABEL_COLOR.normal }}
          aria-hidden
        >
          {golden ? '★ GOLDEN GACHA ★' : '✦ GACHA ✦'}
        </span>
      </div>
    </div>
  );
}
