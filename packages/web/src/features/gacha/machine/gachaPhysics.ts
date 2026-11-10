/**
 * Capsule machine physics: 28 balls in a glass dome, the tumble, the gate, the chute, the floor
 * and the capsule-opening particles. Pure state stepped by the stage ticker; every coordinate is
 * in the 400x600 reference space (`gachaConstants`), and the renderer scales the drawing.
 */
import type { Rarity } from '@game-judge/game-engine/product/rewards';

import {
  BALL_COLORS,
  BALL_R,
  BALL_R_MULTI,
  BALL_R_SINGLE,
  CHUTE_BOT,
  COLLISION_PASSES,
  DAMPING,
  DOME_CX,
  DOME_CY,
  DOME_R,
  FLOOR_Y,
  FRICTION,
  GRAVITY,
  HOLE_CX,
  HOLE_HALF_W,
  HOLE_Y,
  NUM_BALLS,
  PHASE,
  REF_W,
  SETTLE_DURATION,
  TUMBLE_DURATION,
  TUMBLE_FORCE,
} from './gachaConstants';

/** Ball record layout: x, y, vx, vy, radius, flags. */
export const BALL_STRIDE = 6;
/** Shell piece layout: x, y, vx, vy, size, rotation, vrot, alpha, colorIdx (-1 = white). */
export const SHELL_STRIDE = 9;
/** Sparkle layout: x, y, vx, vy, life, size, rarityIdx. */
export const SPARKLE_STRIDE = 7;
export const F_ESCAPED = 1;
const F_ON_FLOOR = 2;
export const F_OPENED = 4;

type Phase = (typeof PHASE)[keyof typeof PHASE];

const RARITY_INDEX: Record<Rarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  mythic: 4,
};

function hasFlag(flags: number, flag: number): boolean {
  return (flags & flag) !== 0;
}

function at(data: readonly number[], index: number): number {
  const value = data[index];
  if (value === undefined) {
    throw new Error(`Capsule physics index ${index} is out of range`);
  }
  return value;
}

function constrainToDome(data: number[], i: number, gateOpen: boolean): void {
  const base = i * BALL_STRIDE;
  const bx = at(data, base);
  const by = at(data, base + 1);
  const r = at(data, base + 4);
  if (hasFlag(at(data, base + 5), F_ESCAPED)) return;

  const dx = bx - DOME_CX;
  const dy = by - DOME_CY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxR = DOME_R - r - 1;

  if (gateOpen && Math.abs(bx - HOLE_CX) < HOLE_HALF_W && by + r > HOLE_Y - 6) {
    if (by > HOLE_Y + r * 0.5) {
      data[base + 5] = at(data, base + 5) | F_ESCAPED;
    }
    return;
  }

  if (dist > maxR && dist > 0.01) {
    const nx = dx / dist;
    const ny = dy / dist;
    data[base] = DOME_CX + nx * maxR;
    data[base + 1] = DOME_CY + ny * maxR;
    const dot = at(data, base + 2) * nx + at(data, base + 3) * ny;
    if (dot > 0) {
      data[base + 2] = at(data, base + 2) - (1 + DAMPING) * dot * nx;
      data[base + 3] = at(data, base + 3) - (1 + DAMPING) * dot * ny;
    }
  }

  if (!gateOpen && by + r > HOLE_Y - 1) {
    data[base + 1] = HOLE_Y - 1 - r;
    if (at(data, base + 3) > 0) data[base + 3] = -at(data, base + 3) * DAMPING * 0.4;
  }
}

function ballCollision(data: number[], a: number, b: number): void {
  const ba = a * BALL_STRIDE;
  const bb = b * BALL_STRIDE;
  const dx = at(data, bb) - at(data, ba);
  const dy = at(data, bb + 1) - at(data, ba + 1);
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minD = at(data, ba + 4) + at(data, bb + 4);
  if (dist >= minD || dist < 0.01) return;

  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = minD - dist;
  data[ba] = at(data, ba) - nx * overlap * 0.5;
  data[ba + 1] = at(data, ba + 1) - ny * overlap * 0.5;
  data[bb] = at(data, bb) + nx * overlap * 0.5;
  data[bb + 1] = at(data, bb + 1) + ny * overlap * 0.5;

  const relativeVx = at(data, ba + 2) - at(data, bb + 2);
  const relativeVy = at(data, ba + 3) - at(data, bb + 3);
  const relativeDot = relativeVx * nx + relativeVy * ny;
  if (relativeDot > 0) {
    const impulse = relativeDot * 0.5 * (1 + DAMPING);
    data[ba + 2] = at(data, ba + 2) - impulse * nx;
    data[ba + 3] = at(data, ba + 3) - impulse * ny;
    data[bb + 2] = at(data, bb + 2) + impulse * nx;
    data[bb + 3] = at(data, bb + 3) + impulse * ny;
  }
}

function physicsTick(
  data: number[],
  dt: number,
  gateOpen: boolean,
  applyGravity: boolean,
  chuteHalfWidth: number,
): void {
  for (let i = 0; i < NUM_BALLS; i++) {
    const base = i * BALL_STRIDE;
    if (hasFlag(at(data, base + 5), F_ON_FLOOR)) continue;
    if (applyGravity) data[base + 3] = at(data, base + 3) + GRAVITY * dt;
    data[base] = at(data, base) + at(data, base + 2) * dt;
    data[base + 1] = at(data, base + 1) + at(data, base + 3) * dt;
    data[base + 2] = at(data, base + 2) * FRICTION;
    data[base + 3] = at(data, base + 3) * FRICTION;
  }

  for (let pass = 0; pass < COLLISION_PASSES; pass++) {
    for (let i = 0; i < NUM_BALLS; i++) {
      for (let j = i + 1; j < NUM_BALLS; j++) {
        ballCollision(data, i, j);
      }
    }
  }

  for (let i = 0; i < NUM_BALLS; i++) {
    const flags = at(data, i * BALL_STRIDE + 5);
    if (!hasFlag(flags, F_ESCAPED) && !hasFlag(flags, F_ON_FLOOR)) {
      constrainToDome(data, i, gateOpen);
    }
  }

  for (let i = 0; i < NUM_BALLS; i++) {
    const base = i * BALL_STRIDE;
    const flags = at(data, base + 5);
    if (!hasFlag(flags, F_ESCAPED) || hasFlag(flags, F_ON_FLOOR)) continue;
    const bx = at(data, base);
    const by = at(data, base + 1);
    const r = at(data, base + 4);

    if (by < CHUTE_BOT + r && by > HOLE_Y) {
      if (bx < HOLE_CX - chuteHalfWidth + r) {
        data[base] = HOLE_CX - chuteHalfWidth + r;
        data[base + 2] = Math.abs(at(data, base + 2)) * 0.3;
      }
      if (bx > HOLE_CX + chuteHalfWidth - r) {
        data[base] = HOLE_CX + chuteHalfWidth - r;
        data[base + 2] = -Math.abs(at(data, base + 2)) * 0.3;
      }
    }

    if (by >= CHUTE_BOT) {
      if (bx < r + 20) {
        data[base] = r + 20;
        data[base + 2] = Math.abs(at(data, base + 2)) * 0.3;
      }
      if (bx > REF_W - r - 20) {
        data[base] = REF_W - r - 20;
        data[base + 2] = -Math.abs(at(data, base + 2)) * 0.3;
      }
    }

    if (by + r > FLOOR_Y) {
      data[base + 1] = FLOOR_Y - r;
      if (Math.abs(at(data, base + 3)) < 25) {
        data[base + 3] = 0;
        data[base + 2] = 0;
        data[base + 5] = at(data, base + 5) | F_ON_FLOOR;
      } else {
        data[base + 3] = -at(data, base + 3) * 0.4;
        data[base + 2] = at(data, base + 2) * 0.7;
      }
    }
  }
}

function settledBalls(): number[] {
  const data = new Array<number>(NUM_BALLS * BALL_STRIDE).fill(0);
  for (let i = 0; i < NUM_BALLS; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (DOME_R - BALL_R - 10);
    const base = i * BALL_STRIDE;
    data[base] = DOME_CX + Math.cos(angle) * dist;
    data[base + 1] = DOME_CY + Math.sin(angle) * dist;
    data[base + 4] = BALL_R;
  }
  for (let frame = 0; frame < 300; frame++) {
    physicsTick(data, 1 / 60, false, true, HOLE_HALF_W);
    for (let i = 0; i < NUM_BALLS; i++) {
      constrainToDome(data, i, false);
      data[i * BALL_STRIDE + 5] = 0;
    }
  }
  return data;
}

/**
 * The machine's simulation. `step` advances one frame; the renderer reads the public state.
 * `onPhaseChange` fires once per phase transition, from inside `step` or the controls.
 */
export class GachaPhysics {
  phase: Phase = PHASE.IDLE;
  balls = settledBalls();
  gateOpen = false;
  flashAlpha = 0;
  shakeX = 0;
  shakeY = 0;
  shellPieces: number[] = [];
  sparkles: number[] = [];

  private phaseTimer = 0;
  private multiMode = false;
  private multiCount = 0;
  private droppedBallIndices: number[] = [];
  private multiOpenIndex = 0;
  private multiOpenTimer = 0;
  private capsuleBallIndex = -1;
  private autoOpenTimer = 0;
  private revealTimer = 0;
  private resultsReady = false;
  private resultRarities: number[] = [];
  private openedCount = 0;

  constructor(private readonly onPhaseChange: (phase: Phase) => void) {}

  /** True while frames change the picture; an idle or finished machine is a still frame. */
  get running(): boolean {
    return this.phase !== PHASE.IDLE && this.phase !== PHASE.DONE;
  }

  /** Re-settles the dome and starts the tumble for a draw of `count` capsules. */
  start(count: number): void {
    this.balls = settledBalls();
    this.multiMode = count > 1;
    this.multiCount = count;
    this.droppedBallIndices = [];
    this.multiOpenIndex = 0;
    this.multiOpenTimer = 0;
    this.capsuleBallIndex = -1;
    this.autoOpenTimer = 0;
    this.revealTimer = 0;
    this.resultsReady = false;
    this.resultRarities = [];
    this.openedCount = 0;
    this.shellPieces = [];
    this.sparkles = [];
    this.flashAlpha = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.gateOpen = false;
    this.phaseTimer = 0;
    this.setPhase(PHASE.TUMBLING);
  }

  /** Releases the gate once the tumble settles; sparkle colours follow `rarities` in order. */
  setResults(rarities: readonly Rarity[]): void {
    this.resultRarities = rarities.map((rarity) => RARITY_INDEX[rarity]);
    this.resultsReady = true;
  }

  cancel(): void {
    this.setPhase(PHASE.IDLE);
  }

  /** Advances one frame of `elapsedMs`; transitions use the phase at the start of the frame. */
  step(elapsedMs: number): void {
    const phase = this.phase;
    if (!this.running) return;
    const dt = Math.min(elapsedMs / 1000, 0.033);
    this.phaseTimer += dt;
    const data = this.balls;

    if (phase === PHASE.TUMBLING) this.tumble(data, dt);
    if (phase === PHASE.SETTLING) {
      this.damp(data, 0.95);
      if (this.phaseTimer > SETTLE_DURATION) {
        if (this.resultsReady) this.goToGatePhase(data);
        else this.enterPhase(PHASE.WAITING_RESULTS);
      }
    }
    if (phase === PHASE.WAITING_RESULTS) {
      this.damp(data, 0.98);
      if (this.resultsReady) this.goToGatePhase(data);
    }
    if (phase === PHASE.GATE_OPEN) this.releaseSingle(data);
    if (phase === PHASE.DROPPING) {
      const capsule = this.capsuleBallIndex;
      if (capsule >= 0 && hasFlag(at(data, capsule * BALL_STRIDE + 5), F_ON_FLOOR)) {
        this.autoOpenTimer = 0;
        this.enterPhase(PHASE.AUTO_OPEN_WAIT);
      }
    }
    if (phase === PHASE.AUTO_OPEN_WAIT) {
      this.autoOpenTimer += dt;
      if (this.autoOpenTimer > 0.5) {
        this.triggerOpen(data, this.capsuleBallIndex);
        this.revealTimer = 0;
        this.enterPhase(PHASE.SINGLE_REVEALING);
      }
    }
    if (phase === PHASE.SINGLE_REVEALING) {
      this.revealTimer += dt;
      if (this.revealTimer > 2.0) this.setPhase(PHASE.DONE);
    }
    if (phase === PHASE.MULTI_GATE_OPEN) this.releaseMulti(data, dt);
    if (phase === PHASE.MULTI_DROPPING) {
      const allLanded = this.droppedBallIndices.every((index) => {
        const flags = at(data, index * BALL_STRIDE + 5);
        return hasFlag(flags, F_ON_FLOOR) || hasFlag(flags, F_OPENED);
      });
      if (allLanded) {
        this.multiOpenIndex = 0;
        this.multiOpenTimer = 0;
        this.enterPhase(PHASE.MULTI_OPENING);
      }
    }
    if (phase === PHASE.MULTI_OPENING) this.openNextCapsule(data, dt);

    const chuteHalfWidth = this.multiMode && this.multiCount > 1 ? 40 : HOLE_HALF_W;
    physicsTick(data, dt, this.gateOpen, phase !== PHASE.TUMBLING, chuteHalfWidth);

    this.shakeX *= 0.88;
    this.shakeY *= 0.88;
    this.flashAlpha *= 0.9;
    this.stepParticles(dt);
  }

  private setPhase(phase: Phase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.onPhaseChange(phase);
  }

  private enterPhase(phase: Phase): void {
    this.phaseTimer = 0;
    this.setPhase(phase);
  }

  private damp(data: number[], factor: number): void {
    for (let i = 0; i < NUM_BALLS; i++) {
      const base = i * BALL_STRIDE;
      if (!hasFlag(at(data, base + 5), F_ESCAPED)) {
        data[base + 2] = at(data, base + 2) * factor;
        data[base + 3] = at(data, base + 3) * factor;
      }
    }
  }

  private tumble(data: number[], dt: number): void {
    const progress = this.phaseTimer / TUMBLE_DURATION;
    let strength: number;
    if (progress < 0.15) strength = progress / 0.15;
    else if (progress < 0.65) strength = 1.0;
    else {
      strength = 1 - (progress - 0.65) / 0.35;
      strength = Math.max(0, strength * strength);
    }
    const spinDirection = Math.sin(this.phaseTimer * 1.5) > 0 ? 1 : -1;
    for (let i = 0; i < NUM_BALLS; i++) {
      const base = i * BALL_STRIDE;
      if (hasFlag(at(data, base + 5), F_ESCAPED)) continue;
      const dx = at(data, base) - DOME_CX;
      const dy = at(data, base + 1) - DOME_CY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const tangentX = (-dy / dist) * spinDirection;
      const tangentY = (dx / dist) * spinDirection;
      data[base + 2] =
        at(data, base + 2) +
        tangentX * TUMBLE_FORCE * strength * dt +
        (Math.random() - 0.5) * 800 * strength * dt;
      data[base + 3] =
        at(data, base + 3) +
        tangentY * TUMBLE_FORCE * strength * dt +
        (Math.random() - 0.5) * 800 * strength * dt;
      data[base + 2] = at(data, base + 2) - (dx / dist) * 150 * dt * strength;
      data[base + 3] = at(data, base + 3) - (dy / dist) * 150 * dt * strength;
    }
    this.shakeX += (Math.random() - 0.5) * 4 * strength;
    this.shakeY += (Math.random() - 0.5) * 4 * strength;
    if (this.phaseTimer >= TUMBLE_DURATION) this.enterPhase(PHASE.SETTLING);
  }

  /** Dome balls, lowest first. */
  private ballsByDepth(data: number[]): number[] {
    const indices: number[] = [];
    for (let i = 0; i < NUM_BALLS; i++) {
      if (!hasFlag(at(data, i * BALL_STRIDE + 5), F_ESCAPED)) indices.push(i);
    }
    return indices.sort((a, b) => at(data, b * BALL_STRIDE + 1) - at(data, a * BALL_STRIDE + 1));
  }

  private goToGatePhase(data: number[]): void {
    this.gateOpen = true;
    const sorted = this.ballsByDepth(data);
    if (this.multiMode) {
      for (const index of sorted.slice(0, this.multiCount + 2)) {
        const base = index * BALL_STRIDE;
        data[base + 3] = at(data, base + 3) + 40 + Math.random() * 30;
        data[base] = at(data, base) + (HOLE_CX - at(data, base)) * 0.3;
        data[base + 2] = at(data, base + 2) + (Math.random() - 0.5) * 30;
      }
      this.enterPhase(PHASE.MULTI_GATE_OPEN);
    } else {
      for (const index of sorted.slice(0, 3)) {
        const base = index * BALL_STRIDE;
        data[base + 3] = at(data, base + 3) + 50;
        data[base] = at(data, base) + (HOLE_CX - at(data, base)) * 0.4;
      }
      this.enterPhase(PHASE.GATE_OPEN);
    }
  }

  /** Forces the lowest dome ball (optionally skipping floor balls) through the gate. */
  private forceOut(data: number[], skipFloor: boolean): number {
    let lowest = -1;
    let lowestY = -9999;
    for (let i = 0; i < NUM_BALLS; i++) {
      const base = i * BALL_STRIDE;
      const flags = at(data, base + 5);
      if (hasFlag(flags, F_ESCAPED) || (skipFloor && hasFlag(flags, F_ON_FLOOR))) continue;
      if (at(data, base + 1) > lowestY) {
        lowestY = at(data, base + 1);
        lowest = i;
      }
    }
    return lowest;
  }

  private releaseSingle(data: number[]): void {
    let found = -1;
    for (let i = 0; i < NUM_BALLS; i++) {
      const flags = at(data, i * BALL_STRIDE + 5);
      if (hasFlag(flags, F_ESCAPED) && !hasFlag(flags, F_OPENED)) {
        found = i;
        break;
      }
    }
    if (found < 0 && this.phaseTimer > 2.5) {
      found = this.forceOut(data, false);
      if (found >= 0) {
        const base = found * BALL_STRIDE;
        data[base] = HOLE_CX;
        data[base + 3] = 120;
        data[base + 5] = at(data, base + 5) | F_ESCAPED;
      }
    }
    if (found >= 0) {
      data[found * BALL_STRIDE + 4] = BALL_R_SINGLE;
      this.capsuleBallIndex = found;
      this.gateOpen = false;
      this.setPhase(PHASE.DROPPING);
    }
  }

  private releaseMulti(data: number[], dt: number): void {
    const indices = this.droppedBallIndices;
    for (let i = 0; i < NUM_BALLS && indices.length < this.multiCount; i++) {
      const base = i * BALL_STRIDE;
      if (hasFlag(at(data, base + 5), F_ESCAPED) && !indices.includes(i)) {
        data[base + 4] = BALL_R_MULTI;
        data[base + 2] = at(data, base + 2) + (Math.random() - 0.5) * 200;
        indices.push(i);
      }
    }
    if (indices.length >= this.multiCount) {
      this.gateOpen = false;
      this.enterPhase(PHASE.MULTI_DROPPING);
      return;
    }
    if (this.phaseTimer > 4) {
      while (indices.length < this.multiCount) {
        const lowest = this.forceOut(data, true);
        if (lowest < 0) break;
        const base = lowest * BALL_STRIDE;
        data[base] = HOLE_CX + (Math.random() - 0.5) * 20;
        data[base + 3] = 120;
        data[base + 5] = at(data, base + 5) | F_ESCAPED;
        data[base + 4] = BALL_R_MULTI;
        data[base + 2] = (Math.random() - 0.5) * 200;
        indices.push(lowest);
      }
      this.gateOpen = false;
      this.enterPhase(PHASE.MULTI_DROPPING);
      return;
    }
    if (this.phaseTimer > 0.5) {
      for (let i = 0; i < NUM_BALLS; i++) {
        const base = i * BALL_STRIDE;
        const flags = at(data, base + 5);
        if (!hasFlag(flags, F_ESCAPED) && !hasFlag(flags, F_ON_FLOOR)) {
          data[base] = at(data, base) + (HOLE_CX - at(data, base)) * 0.02;
          data[base + 3] = at(data, base + 3) + 10 * dt * 60;
        }
      }
    }
  }

  private openNextCapsule(data: number[], dt: number): void {
    this.multiOpenTimer += dt;
    const indices = this.droppedBallIndices;
    if (this.multiOpenTimer > 0.25 && this.multiOpenIndex < indices.length) {
      const index = indices[this.multiOpenIndex];
      if (index !== undefined && !hasFlag(at(data, index * BALL_STRIDE + 5), F_OPENED)) {
        this.triggerOpen(data, index);
      }
      this.multiOpenIndex += 1;
      this.multiOpenTimer = 0;
    }
    if (this.multiOpenIndex >= indices.length && this.multiOpenTimer > 0.6) {
      this.setPhase(PHASE.DONE);
    }
  }

  private triggerOpen(data: number[], index: number): void {
    if (index < 0) return;
    const base = index * BALL_STRIDE;
    const bx = at(data, base);
    const by = at(data, base + 1);
    const radius = at(data, base + 4);
    data[base + 5] = at(data, base + 5) | F_OPENED;

    this.flashAlpha = this.multiMode ? 0.25 : 0.6;
    this.shakeX += (Math.random() - 0.5) * (this.multiMode ? 4 : 12);
    this.shakeY += (Math.random() - 0.5) * (this.multiMode ? 4 : 12);

    const rarity = this.resultRarities[this.openedCount] ?? 0;
    this.openedCount += 1;

    const colorIndex = index % BALL_COLORS.length;
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10 + (Math.random() - 0.5) * 0.4;
      const speed = 100 + Math.random() * 140;
      this.shellPieces.push(
        bx,
        by,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 60,
        radius * (0.2 + Math.random() * 0.3),
        0,
        (Math.random() - 0.5) * 10,
        1,
        i < 5 ? -1 : colorIndex,
      );
    }
    const sparkleCount = this.multiMode ? 10 : 28;
    for (let i = 0; i < sparkleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      this.sparkles.push(
        bx,
        by,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        1,
        2 + Math.random() * 4,
        rarity,
      );
    }
  }

  private stepParticles(dt: number): void {
    const shells = this.shellPieces;
    for (let i = shells.length - SHELL_STRIDE; i >= 0; i -= SHELL_STRIDE) {
      shells[i] = at(shells, i) + at(shells, i + 2) * dt;
      shells[i + 1] = at(shells, i + 1) + at(shells, i + 3) * dt;
      shells[i + 3] = at(shells, i + 3) + 300 * dt;
      shells[i + 5] = at(shells, i + 5) + at(shells, i + 6) * dt * 10;
      shells[i + 7] = at(shells, i + 7) - 0.8 * dt;
      if (at(shells, i + 7) <= 0) shells.splice(i, SHELL_STRIDE);
    }
    const sparkles = this.sparkles;
    for (let i = sparkles.length - SPARKLE_STRIDE; i >= 0; i -= SPARKLE_STRIDE) {
      sparkles[i] = at(sparkles, i) + at(sparkles, i + 2) * dt;
      sparkles[i + 1] = at(sparkles, i + 1) + at(sparkles, i + 3) * dt;
      sparkles[i + 2] = at(sparkles, i + 2) * 0.96;
      sparkles[i + 3] = at(sparkles, i + 3) * 0.96;
      sparkles[i + 4] = at(sparkles, i + 4) - 1.2 * dt;
      if (at(sparkles, i + 4) <= 0) sparkles.splice(i, SPARKLE_STRIDE);
    }
  }
}
