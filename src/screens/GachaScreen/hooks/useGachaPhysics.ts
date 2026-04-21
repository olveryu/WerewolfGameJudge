/**
 * useGachaPhysics — 扭蛋机物理引擎 (Reanimated 4 worklet)
 *
 * 28 球在圆罩内碰撞。搅拌 → 沉降 → 开闸 → 掉落 → 弹跳落地。
 * 全部在 UI 线程运行（useFrameCallback），零桥接延迟。
 * 从 gacha-capsule-v5.html 原型 1:1 移植物理参数。
 */
import { useCallback, useEffect } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

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
} from '../gachaConstants';

// ─── Ball data: flat array [x, y, vx, vy, r, flags] per ball ───────────
// flags: bit0 = escaped, bit1 = onFloor, bit2 = opened
const STRIDE = 6;
const F_ESCAPED = 1;
const F_ON_FLOOR = 2;
const F_OPENED = 4;

function hasFlag(flags: number, flag: number): boolean {
  'worklet';
  return (flags & flag) !== 0;
}

// ─── Physics worklet functions ──────────────────────────────────────────

function constrainToDome(data: number[], i: number, gateOpen: boolean, s: number): void {
  'worklet';
  const base = i * STRIDE;
  const bx = data[base];
  const by = data[base + 1];
  const r = data[base + 4];
  const flags = data[base + 5];
  if (hasFlag(flags, F_ESCAPED)) return;

  const cx = DOME_CX * s;
  const cy = DOME_CY * s;
  const domeR = DOME_R * s;
  const holeY = HOLE_Y * s;
  const holeCx = HOLE_CX * s;
  const holeHW = HOLE_HALF_W * s;

  const dx = bx - cx;
  const dy = by - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxR = domeR - r - 1;

  // Gate check
  if (gateOpen && Math.abs(bx - holeCx) < holeHW && by + r > holeY - 6 * s) {
    if (by > holeY + r * 0.5) {
      data[base + 5] |= F_ESCAPED;
    }
    return;
  }

  // Dome wall
  if (dist > maxR && dist > 0.01) {
    const nx = dx / dist;
    const ny = dy / dist;
    data[base] = cx + nx * maxR;
    data[base + 1] = cy + ny * maxR;
    const dot = data[base + 2] * nx + data[base + 3] * ny;
    if (dot > 0) {
      data[base + 2] -= (1 + DAMPING) * dot * nx;
      data[base + 3] -= (1 + DAMPING) * dot * ny;
    }
  }

  // Floor of dome (no gate)
  if (!gateOpen && by + r > holeY - 1 * s) {
    data[base + 1] = holeY - 1 * s - r;
    if (data[base + 3] > 0) data[base + 3] = -data[base + 3] * DAMPING * 0.4;
  }
}

function ballCollision(data: number[], a: number, b: number): void {
  'worklet';
  const ba = a * STRIDE;
  const bb = b * STRIDE;
  const dx = data[bb] - data[ba];
  const dy = data[bb + 1] - data[ba + 1];
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minD = data[ba + 4] + data[bb + 4];
  if (dist >= minD || dist < 0.01) return;

  const nx = dx / dist;
  const ny = dy / dist;
  const ov = minD - dist;
  data[ba] -= nx * ov * 0.5;
  data[ba + 1] -= ny * ov * 0.5;
  data[bb] += nx * ov * 0.5;
  data[bb + 1] += ny * ov * 0.5;

  const rv = data[ba + 2] - data[bb + 2];
  const rvy = data[ba + 3] - data[bb + 3];
  const rd = rv * nx + rvy * ny;
  if (rd > 0) {
    const imp = rd * 0.5 * (1 + DAMPING);
    data[ba + 2] -= imp * nx;
    data[ba + 3] -= imp * ny;
    data[bb + 2] += imp * nx;
    data[bb + 3] += imp * ny;
  }
}

function physicsTick(
  data: number[],
  n: number,
  dt: number,
  gateOpen: boolean,
  applyGravity: boolean,
  multiMode: boolean,
  multiCount: number,
  s: number,
): void {
  'worklet';
  const gravity = GRAVITY * s;
  const floorY = FLOOR_Y * s;
  const chuteBot = CHUTE_BOT * s;
  const holeCx = HOLE_CX * s;
  const holeY = HOLE_Y * s;
  const chuteHW = (multiMode && multiCount > 1 ? 40 : HOLE_HALF_W) * s;

  // Integrate
  for (let i = 0; i < n; i++) {
    const base = i * STRIDE;
    const flags = data[base + 5];
    if (hasFlag(flags, F_ON_FLOOR)) continue;
    if (applyGravity) data[base + 3] += gravity * dt;
    data[base] += data[base + 2] * dt;
    data[base + 1] += data[base + 3] * dt;
    data[base + 2] *= FRICTION;
    data[base + 3] *= FRICTION;
  }

  // Collision (multi-pass)
  for (let p = 0; p < COLLISION_PASSES; p++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        ballCollision(data, i, j);
      }
    }
  }

  // Dome constraint
  for (let i = 0; i < n; i++) {
    if (!hasFlag(data[i * STRIDE + 5], F_ESCAPED) && !hasFlag(data[i * STRIDE + 5], F_ON_FLOOR)) {
      constrainToDome(data, i, gateOpen, s);
    }
  }

  // Chute walls + floor
  for (let i = 0; i < n; i++) {
    const base = i * STRIDE;
    const flags = data[base + 5];
    if (!hasFlag(flags, F_ESCAPED) || hasFlag(flags, F_ON_FLOOR)) continue;
    const bx = data[base];
    const by = data[base + 1];
    const r = data[base + 4];

    // Chute walls
    if (by < chuteBot + r && by > holeY) {
      if (bx < holeCx - chuteHW + r) {
        data[base] = holeCx - chuteHW + r;
        data[base + 2] = Math.abs(data[base + 2]) * 0.3;
      }
      if (bx > holeCx + chuteHW - r) {
        data[base] = holeCx + chuteHW - r;
        data[base + 2] = -Math.abs(data[base + 2]) * 0.3;
      }
    }

    // Below chute — spread freely but constrain to canvas
    if (by >= chuteBot) {
      if (bx < r + 20 * s) {
        data[base] = r + 20 * s;
        data[base + 2] = Math.abs(data[base + 2]) * 0.3;
      }
      if (bx > REF_W * s - r - 20 * s) {
        data[base] = REF_W * s - r - 20 * s;
        data[base + 2] = -Math.abs(data[base + 2]) * 0.3;
      }
    }

    // Floor bounce
    if (by + r > floorY) {
      data[base + 1] = floorY - r;
      if (Math.abs(data[base + 3]) < 25 * s) {
        data[base + 3] = 0;
        data[base + 2] = 0;
        data[base + 5] |= F_ON_FLOOR;
      } else {
        data[base + 3] = -data[base + 3] * 0.4;
        data[base + 2] *= 0.7;
      }
    }
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────

export function useGachaPhysics(scale: number) {
  const s = scale;

  // State
  const phase = useSharedValue<number>(PHASE.IDLE);
  const phaseTimer = useSharedValue(0);
  const ballData = useSharedValue<number[]>(new Array(NUM_BALLS * STRIDE).fill(0));
  const gateOpen = useSharedValue(0);
  const dialAngle = useSharedValue(0);
  const renderTick = useSharedValue(0);

  // Flash / shake
  const flashAlpha = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const shakeY = useSharedValue(0);

  // Multi-pull tracking
  const multiMode = useSharedValue(0);
  const multiCount = useSharedValue(0);
  const droppedCount = useSharedValue(0);
  const multiOpenIndex = useSharedValue(0);
  const multiOpenTimer = useSharedValue(0);

  // Single-pull capsule (index into ballData of the escaped ball)
  const capsuleBallIndex = useSharedValue(-1);
  const autoOpenTimer = useSharedValue(0);
  const revealAlpha = useSharedValue(0);
  const revealTimer = useSharedValue(0);

  // Results available flag (set from JS after API responds)
  const resultsReady = useSharedValue(0);
  const resultRarities = useSharedValue<number[]>([]);

  // Opened ball positions for rarity glow (x, y, rarityIndex per opened ball)
  const openedBalls = useSharedValue<number[]>([]);

  // Shell fragment particles: [x, y, vx, vy, size, rotation, vrot, alpha, colorIdx] × 9 stride
  const shellPieces = useSharedValue<number[]>([]);
  // Sparkle particles: [x, y, vx, vy, life, size, rarityIdx] × 7 stride
  const sparkles = useSharedValue<number[]>([]);

  // Track ball assignment to results
  const droppedBallIndices = useSharedValue<number[]>([]);

  // Whether the animation was cancelled
  const cancelled = useSharedValue(0);

  // Init balls in dome
  const initBalls = useCallback(() => {
    const data = new Array(NUM_BALLS * STRIDE).fill(0);
    for (let i = 0; i < NUM_BALLS; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (DOME_R * s - BALL_R * s - 10 * s);
      const base = i * STRIDE;
      data[base] = DOME_CX * s + Math.cos(angle) * dist;
      data[base + 1] = DOME_CY * s + Math.sin(angle) * dist;
      data[base + 2] = 0; // vx
      data[base + 3] = 0; // vy
      data[base + 4] = BALL_R * s; // radius
      data[base + 5] = 0; // flags
    }
    return data;
  }, [s]);

  // Pre-settle balls (run physics without forces to let them rest)
  const preSettle = useCallback(() => {
    const data = initBalls();
    for (let f = 0; f < 300; f++) {
      physicsTick(data, NUM_BALLS, 1 / 60, false, true, false, 0, s);
      for (let i = 0; i < NUM_BALLS; i++) {
        constrainToDome(data, i, false, s);
        // Reset escaped/floor flags during pre-settle
        data[i * STRIDE + 5] = 0;
      }
    }
    return data;
  }, [initBalls, s]);

  // Pre-fill balls on mount so they're visible immediately
  useEffect(() => {
    ballData.value = preSettle();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ballData.value is a Reanimated SharedValue (stable ref)
  }, [preSettle]);

  // ── Helper: trigger ball open ─────────────────────────────────────────

  function triggerOpen(data: number[], bi: number): void {
    'worklet';
    if (bi < 0) return;
    const bx = data[bi * STRIDE];
    const by = data[bi * STRIDE + 1];
    const br = data[bi * STRIDE + 4];
    data[bi * STRIDE + 5] |= F_OPENED;

    // Flash + shake
    flashAlpha.value = multiMode.value === 1 ? 0.25 : 0.6;
    shakeX.value += (Math.random() - 0.5) * (multiMode.value === 1 ? 4 : 12);
    shakeY.value += (Math.random() - 0.5) * (multiMode.value === 1 ? 4 : 12);

    // Track opened position + rarity
    const ob = openedBalls.value;
    const rarIdx = ob.length / 3;
    const rar = rarIdx < resultRarities.value.length ? resultRarities.value[rarIdx] : 0;
    ob.push(bx, by, rar);
    openedBalls.value = ob;

    // Spawn shell fragments (10 pieces)
    const sp = shellPieces.value;
    const colorIdx = bi % BALL_COLORS.length;
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10 + (Math.random() - 0.5) * 0.4;
      const speed = 100 + Math.random() * 140;
      sp.push(
        bx, // x
        by, // y
        Math.cos(a) * speed, // vx
        Math.sin(a) * speed - 60, // vy (bias upward)
        br * (0.2 + Math.random() * 0.3), // size
        0, // rotation
        (Math.random() - 0.5) * 10, // vrot
        1, // alpha
        i < 5 ? -1 : colorIdx, // colorIdx (-1 = white shell)
      );
    }
    shellPieces.value = sp;

    // Spawn sparkles (rarity-colored cross particles)
    const sk = sparkles.value;
    const nSparkles = multiMode.value === 1 ? 10 : 28;
    for (let i = 0; i < nSparkles; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      sk.push(
        bx, // x
        by, // y
        Math.cos(a) * speed, // vx
        Math.sin(a) * speed, // vy
        1, // life
        2 + Math.random() * 4, // size
        rar, // rarityIdx
      );
    }
    sparkles.value = sk;
  }

  // ── Helper: transition to gate phase ──────────────────────────────────

  function goToGatePhase(data: number[], isMulti: boolean, mc: number): void {
    'worklet';
    gateOpen.value = 1;
    phaseTimer.value = 0;

    if (isMulti) {
      phase.value = PHASE.MULTI_GATE_OPEN;
      // Nudge bottom balls toward hole
      const sorted: number[] = [];
      for (let i = 0; i < NUM_BALLS; i++) {
        if (!hasFlag(data[i * STRIDE + 5], F_ESCAPED)) sorted.push(i);
      }
      sorted.sort((a, b) => data[b * STRIDE + 1] - data[a * STRIDE + 1]);
      const nudgeCount = Math.min(mc + 2, sorted.length);
      for (let i = 0; i < nudgeCount; i++) {
        const base = sorted[i] * STRIDE;
        data[base + 3] += (40 + Math.random() * 30) * s;
        data[base] += (HOLE_CX * s - data[base]) * 0.3;
        data[base + 2] += (Math.random() - 0.5) * 30 * s;
      }
    } else {
      phase.value = PHASE.GATE_OPEN;
      // Nudge bottom balls toward hole
      const sorted: number[] = [];
      for (let i = 0; i < NUM_BALLS; i++) {
        if (!hasFlag(data[i * STRIDE + 5], F_ESCAPED)) sorted.push(i);
      }
      sorted.sort((a, b) => data[b * STRIDE + 1] - data[a * STRIDE + 1]);
      const nudgeCount = Math.min(3, sorted.length);
      for (let i = 0; i < nudgeCount; i++) {
        const base = sorted[i] * STRIDE;
        data[base + 3] += 50 * s;
        data[base] += (HOLE_CX * s - data[base]) * 0.4;
      }
    }
  }

  // ── Frame callback: physics loop ──────────────────────────────────────

  useFrameCallback((fi) => {
    'worklet';
    const p = phase.value;
    if (p === PHASE.IDLE || p === PHASE.DONE || cancelled.value === 1) return;

    const dt = Math.min(((fi.timeSincePreviousFrame as number | undefined) ?? 16) / 1000, 0.033);
    phaseTimer.value += dt;

    const data = ballData.value;
    const isMulti = multiMode.value === 1;
    const mc = multiCount.value;

    // ── Phase: Tumbling ──
    if (p === PHASE.TUMBLING) {
      const progress = phaseTimer.value / TUMBLE_DURATION;
      let strength: number;
      if (progress < 0.15) strength = progress / 0.15;
      else if (progress < 0.65) strength = 1.0;
      else {
        strength = 1 - (progress - 0.65) / 0.35;
        strength = Math.max(0, strength * strength);
      }
      const time = phaseTimer.value;
      const spinDir = Math.sin(time * 1.5) > 0 ? 1 : -1;
      for (let i = 0; i < NUM_BALLS; i++) {
        const base = i * STRIDE;
        if (hasFlag(data[base + 5], F_ESCAPED)) continue;
        const dx = data[base] - DOME_CX * s;
        const dy = data[base + 1] - DOME_CY * s;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const tx = (-dy / dist) * spinDir;
        const ty = (dx / dist) * spinDir;
        data[base + 2] +=
          tx * TUMBLE_FORCE * s * strength * dt + (Math.random() - 0.5) * 800 * s * strength * dt;
        data[base + 3] +=
          ty * TUMBLE_FORCE * s * strength * dt + (Math.random() - 0.5) * 800 * s * strength * dt;
        // Centripetal
        data[base + 2] -= (dx / dist) * 150 * s * dt * strength;
        data[base + 3] -= (dy / dist) * 150 * s * dt * strength;
      }
      dialAngle.value += 12 * dt * strength;
      shakeX.value += (Math.random() - 0.5) * 4 * strength;
      shakeY.value += (Math.random() - 0.5) * 4 * strength;

      if (phaseTimer.value >= TUMBLE_DURATION) {
        phase.value = PHASE.SETTLING;
        phaseTimer.value = 0;
      }
    }

    // ── Phase: Settling ──
    if (p === PHASE.SETTLING) {
      for (let i = 0; i < NUM_BALLS; i++) {
        const base = i * STRIDE;
        if (!hasFlag(data[base + 5], F_ESCAPED)) {
          data[base + 2] *= 0.95;
          data[base + 3] *= 0.95;
        }
      }
      if (phaseTimer.value > SETTLE_DURATION) {
        if (resultsReady.value === 0) {
          phase.value = PHASE.WAITING_RESULTS;
          phaseTimer.value = 0;
        } else {
          goToGatePhase(data, isMulti, mc);
        }
      }
    }

    // ── Phase: Waiting for API results ──
    if (p === PHASE.WAITING_RESULTS) {
      // Gentle damping while waiting
      for (let i = 0; i < NUM_BALLS; i++) {
        const base = i * STRIDE;
        if (!hasFlag(data[base + 5], F_ESCAPED)) {
          data[base + 2] *= 0.98;
          data[base + 3] *= 0.98;
        }
      }
      if (resultsReady.value === 1) {
        goToGatePhase(data, isMulti, mc);
      }
    }

    // ── Phase: Gate open (single) ──
    if (p === PHASE.GATE_OPEN) {
      // Find first escaped ball
      let found = -1;
      for (let i = 0; i < NUM_BALLS; i++) {
        if (hasFlag(data[i * STRIDE + 5], F_ESCAPED) && !hasFlag(data[i * STRIDE + 5], F_OPENED)) {
          found = i;
          break;
        }
      }
      if (found >= 0) {
        data[found * STRIDE + 4] = BALL_R_SINGLE * s;
        capsuleBallIndex.value = found;
        phase.value = PHASE.DROPPING;
        gateOpen.value = 0;
      }
      // Timeout: force a ball out
      if (phaseTimer.value > 2.5 && found < 0) {
        let low = -1;
        let lowY = -9999;
        for (let i = 0; i < NUM_BALLS; i++) {
          const base = i * STRIDE;
          if (!hasFlag(data[base + 5], F_ESCAPED) && data[base + 1] > lowY) {
            lowY = data[base + 1];
            low = i;
          }
        }
        if (low >= 0) {
          data[low * STRIDE] = HOLE_CX * s;
          data[low * STRIDE + 3] = 120 * s;
          data[low * STRIDE + 5] |= F_ESCAPED;
          data[low * STRIDE + 4] = BALL_R_SINGLE * s;
          capsuleBallIndex.value = low;
          phase.value = PHASE.DROPPING;
          gateOpen.value = 0;
        }
      }
    }

    // ── Phase: Dropping (single) ──
    if (p === PHASE.DROPPING) {
      const ci = capsuleBallIndex.value;
      if (ci >= 0 && hasFlag(data[ci * STRIDE + 5], F_ON_FLOOR)) {
        phase.value = PHASE.AUTO_OPEN_WAIT;
        phaseTimer.value = 0;
        autoOpenTimer.value = 0;
      }
    }

    // ── Phase: Auto open wait (single) ──
    if (p === PHASE.AUTO_OPEN_WAIT) {
      autoOpenTimer.value += dt;
      if (autoOpenTimer.value > 0.5) {
        triggerOpen(data, capsuleBallIndex.value);
        phase.value = PHASE.SINGLE_REVEALING;
        phaseTimer.value = 0;
        revealAlpha.value = 0;
        revealTimer.value = 0;
      }
    }

    // ── Phase: Single revealing ──
    if (p === PHASE.SINGLE_REVEALING) {
      revealAlpha.value = Math.min(1, revealAlpha.value + 3 * dt);
      revealTimer.value += dt;
      if (revealTimer.value > 2.0) {
        phase.value = PHASE.DONE;
      }
    }

    // ── Phase: Multi gate open ──
    if (p === PHASE.MULTI_GATE_OPEN) {
      // Track newly escaped
      let dc = droppedCount.value;
      const indices = droppedBallIndices.value;
      for (let i = 0; i < NUM_BALLS; i++) {
        if (hasFlag(data[i * STRIDE + 5], F_ESCAPED) && !indices.includes(i) && dc < mc) {
          data[i * STRIDE + 4] = BALL_R_MULTI * s;
          data[i * STRIDE + 2] += (Math.random() - 0.5) * 200 * s;
          indices.push(i);
          dc++;
        }
      }
      droppedCount.value = dc;
      droppedBallIndices.value = indices;

      if (dc >= mc) {
        gateOpen.value = 0;
        phase.value = PHASE.MULTI_DROPPING;
        phaseTimer.value = 0;
      }

      // Safety: force balls out if stuck
      if (phaseTimer.value > 4) {
        while (dc < mc) {
          let low = -1;
          let lowY = -9999;
          for (let i = 0; i < NUM_BALLS; i++) {
            const base = i * STRIDE;
            if (
              !hasFlag(data[base + 5], F_ESCAPED) &&
              !hasFlag(data[base + 5], F_ON_FLOOR) &&
              data[base + 1] > lowY
            ) {
              lowY = data[base + 1];
              low = i;
            }
          }
          if (low < 0) break;
          data[low * STRIDE] = HOLE_CX * s + (Math.random() - 0.5) * 20 * s;
          data[low * STRIDE + 3] = 120 * s;
          data[low * STRIDE + 5] |= F_ESCAPED;
          data[low * STRIDE + 4] = BALL_R_MULTI * s;
          data[low * STRIDE + 2] = (Math.random() - 0.5) * 200 * s;
          indices.push(low);
          dc++;
        }
        droppedCount.value = dc;
        droppedBallIndices.value = indices;
        gateOpen.value = 0;
        phase.value = PHASE.MULTI_DROPPING;
        phaseTimer.value = 0;
      }

      // Nudge dome balls toward hole
      if (phaseTimer.value > 0.5 && dc < mc) {
        for (let i = 0; i < NUM_BALLS; i++) {
          const base = i * STRIDE;
          if (!hasFlag(data[base + 5], F_ESCAPED) && !hasFlag(data[base + 5], F_ON_FLOOR)) {
            data[base] += (HOLE_CX * s - data[base]) * 0.02;
            data[base + 3] += 10 * dt * 60;
          }
        }
      }
    }

    // ── Phase: Multi dropping — wait for all to land ──
    if (p === PHASE.MULTI_DROPPING) {
      const indices = droppedBallIndices.value;
      let allLanded = true;
      for (let i = 0; i < indices.length; i++) {
        const bi = indices[i];
        const flags = data[bi * STRIDE + 5];
        if (!hasFlag(flags, F_ON_FLOOR) && !hasFlag(flags, F_OPENED)) {
          allLanded = false;
          break;
        }
      }
      if (allLanded) {
        phase.value = PHASE.MULTI_OPENING;
        multiOpenIndex.value = 0;
        multiOpenTimer.value = 0;
        phaseTimer.value = 0;
      }
    }

    // ── Phase: Multi opening — open one by one ──
    if (p === PHASE.MULTI_OPENING) {
      multiOpenTimer.value += dt;
      const indices = droppedBallIndices.value;
      if (multiOpenTimer.value > 0.25 && multiOpenIndex.value < indices.length) {
        const bi = indices[multiOpenIndex.value];
        if (!hasFlag(data[bi * STRIDE + 5], F_OPENED)) {
          triggerOpen(data, bi);
        }
        multiOpenIndex.value += 1;
        multiOpenTimer.value = 0;
      }
      if (multiOpenIndex.value >= indices.length && multiOpenTimer.value > 0.6) {
        phase.value = PHASE.DONE;
      }
    }

    // ── Physics step ──
    physicsTick(data, NUM_BALLS, dt, gateOpen.value === 1, p !== PHASE.TUMBLING, isMulti, mc, s);

    // ── Decay effects ──
    shakeX.value *= 0.88;
    shakeY.value *= 0.88;
    flashAlpha.value *= 0.9;

    // ── Update shell pieces ──
    const sp = shellPieces.value;
    if (sp.length > 0) {
      const SHELL_STRIDE = 9;
      let changed = false;
      for (let i = sp.length - SHELL_STRIDE; i >= 0; i -= SHELL_STRIDE) {
        sp[i] += sp[i + 2] * dt; // x += vx * dt
        sp[i + 1] += sp[i + 3] * dt; // y += vy * dt
        sp[i + 3] += 300 * dt; // gravity
        sp[i + 5] += sp[i + 6] * dt * 10; // rotation
        sp[i + 7] -= 0.8 * dt; // alpha decay
        if (sp[i + 7] <= 0) {
          sp.splice(i, SHELL_STRIDE);
          changed = true;
        }
      }
      if (changed || sp.length > 0) shellPieces.value = sp;
    }

    // ── Update sparkles ──
    const sk = sparkles.value;
    if (sk.length > 0) {
      const SPARK_STRIDE = 7;
      let changed = false;
      for (let i = sk.length - SPARK_STRIDE; i >= 0; i -= SPARK_STRIDE) {
        sk[i] += sk[i + 2] * dt; // x += vx * dt
        sk[i + 1] += sk[i + 3] * dt; // y += vy * dt
        sk[i + 2] *= 0.96; // drag
        sk[i + 3] *= 0.96;
        sk[i + 4] -= 1.2 * dt; // life decay
        if (sk[i + 4] <= 0) {
          sk.splice(i, SPARK_STRIDE);
          changed = true;
        }
      }
      if (changed || sk.length > 0) sparkles.value = sk;
    }

    ballData.value = data;
    renderTick.value += 1;
  });

  // ── JS-callable controls ──────────────────────────────────────────────

  const startAnimation = useCallback(
    (drawType: 'normal' | 'golden', count: number) => {
      const data = preSettle();
      ballData.value = data;
      multiMode.value = count > 1 ? 1 : 0;
      multiCount.value = count;
      droppedCount.value = 0;
      droppedBallIndices.value = [];
      multiOpenIndex.value = 0;
      multiOpenTimer.value = 0;
      capsuleBallIndex.value = -1;
      autoOpenTimer.value = 0;
      revealAlpha.value = 0;
      revealTimer.value = 0;
      resultsReady.value = 0;
      resultRarities.value = [];
      openedBalls.value = [];
      shellPieces.value = [];
      sparkles.value = [];
      flashAlpha.value = 0;
      shakeX.value = 0;
      shakeY.value = 0;
      cancelled.value = 0;
      phase.value = PHASE.TUMBLING;
      phaseTimer.value = 0;
    },
    [
      preSettle,
      ballData,
      multiMode,
      multiCount,
      droppedCount,
      droppedBallIndices,
      multiOpenIndex,
      multiOpenTimer,
      capsuleBallIndex,
      autoOpenTimer,
      revealAlpha,
      revealTimer,
      resultsReady,
      resultRarities,
      openedBalls,
      shellPieces,
      sparkles,
      flashAlpha,
      shakeX,
      shakeY,
      cancelled,
      phase,
      phaseTimer,
    ],
  );

  const setResults = useCallback(
    (rarities: string[]) => {
      // Encode rarities as numbers: common=0, rare=1, epic=2, legendary=3
      const RARITY_MAP: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
      resultRarities.value = rarities.map((r) => RARITY_MAP[r] ?? 0);
      resultsReady.value = 1;
    },
    [resultRarities, resultsReady],
  );

  const cancelAnimation = useCallback(() => {
    cancelled.value = 1;
    phase.value = PHASE.IDLE;
  }, [cancelled, phase]);

  return {
    // Shared values for rendering
    phase,
    ballData,
    renderTick,
    dialAngle,
    gateOpen,
    flashAlpha,
    shakeX,
    shakeY,
    capsuleBallIndex,
    revealAlpha,
    multiOpenIndex,
    openedBalls,
    droppedBallIndices,
    shellPieces,
    sparkles,
    // Controls
    startAnimation,
    setResults,
    cancelAnimation,
  };
}
