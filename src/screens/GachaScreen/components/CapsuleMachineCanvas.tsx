'use dom';

/**
 * CapsuleMachineCanvas — 扭蛋机物理 + 渲染一体化（Canvas 2D）
 *
 * 内含 28 球碰撞物理 + 完整场景绘制。
 * 通过 props 接收命令（startTrigger/cancelTrigger/results），
 * 通过 onPhaseChange 回调通知父组件阶段变化。
 */
import { useEffect, useRef } from 'react';

// ─── Constants ───────────────────────────────────────────────────────────

const PHASE_IDLE = 0, PHASE_TUMBLING = 1, PHASE_SETTLING = 2, PHASE_WAITING = 3;
const PHASE_GATE_OPEN = 4, PHASE_DROPPING = 5, PHASE_AUTO_OPEN = 6, PHASE_SINGLE_REVEAL = 7;
const PHASE_MULTI_GATE = 8, PHASE_MULTI_DROPPING = 9, PHASE_MULTI_OPENING = 10, PHASE_DONE = 11;

const GRAVITY = 500, DAMPING = 0.7, FRICTION = 0.985, NUM_BALLS = 28;
const BALL_R = 14, BALL_R_SINGLE = 18, BALL_R_MULTI = 16;
const COLLISION_PASSES = 3, TUMBLE_DURATION = 2.2, SETTLE_DURATION = 0.4, TUMBLE_FORCE = 3000;
const REF_W = 400, REF_H = 600;
const DOME_CX = 200, DOME_CY = 165, DOME_R = 125;
const HOLE_CX = 200, HOLE_Y = 290, HOLE_HALF_W = 16;
const BODY_L = 60, BODY_R_X = 340, BODY_T = 290, BODY_B = 400;
const CHUTE_TOP = 400, CHUTE_BOT = 445, FLOOR_Y = 540, DIAL_Y = 345;

const STRIDE = 6, F_ESCAPED = 1, F_ON_FLOOR = 2, F_OPENED = 4;

const BALL_COLORS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#e67e22','#1abc9c','#e84393','#00b894','#6c5ce7','#fdcb6e','#fab1a0','#74b9ff','#a29bfe','#fd79a8','#55efc4','#ff7675','#0984e3','#d63031','#ffeaa7','#00cec9','#e17055','#81ecec','#636e72','#b2bec3','#dfe6e9','#fd79a8','#ffeaa7'];

const MC = { bg: '#F2F2F7', bgLight: '#E8E8F0', body: '#5B4FA0', bodyMid: '#6B5FB5', bodyEdge: 'rgba(255,255,255,0.25)', dome: 'rgba(100,130,200,0.06)', domeStroke: 'rgba(90,90,150,0.35)', chute: '#4A3F8A', chuteStroke: 'rgba(255,255,255,0.15)', floor: 'rgba(0,0,0,0.03)', floorLine: 'rgba(0,0,0,0.06)', shadow: 'rgba(0,0,0,0.12)', dialBody: '#7A70B0', dialHighlight: '#9A92CC', dialKnob: '#B0A8D8', dialStroke: 'rgba(255,255,255,0.3)', gate: 'rgba(255,200,50,0.4)' };

const RARITY_GLOW = ['rgba(158,158,158,0.5)','rgba(74,144,217,0.6)','rgba(155,89,182,0.7)','rgba(245,166,35,0.8)'];

// ─── State interface ─────────────────────────────────────────────────────

interface MachineState {
  phase: number; phaseTimer: number; ballData: number[]; gateOpen: boolean;
  dialAngle: number; flashAlpha: number; shakeX: number; shakeY: number;
  multiMode: boolean; multiCount: number; droppedCount: number;
  capsuleIdx: number; autoOpenTimer: number; revealTimer: number;
  resultsReady: boolean; resultRarities: number[];
  droppedIndices: number[]; multiOpenIdx: number; multiOpenTimer: number;
  shellPieces: number[]; sparkles: number[]; cancelled: boolean;
  lastPhaseReported: number;
}

// ─── Physics helpers ─────────────────────────────────────────────────────

function rd(arr: number[], i: number): number { return arr[i] as number; }

function constrainToDome(data: number[], i: number, gateOpen: boolean, s: number): void {
  const base = i * STRIDE;
  const bx = rd(data, base), by = rd(data, base + 1), r = rd(data, base + 4), flags = rd(data, base + 5);
  if ((flags & F_ESCAPED) !== 0) return;
  const cx = DOME_CX * s, cy = DOME_CY * s, domeR2 = DOME_R * s;
  const holeY2 = HOLE_Y * s, holeCx = HOLE_CX * s, holeHW = HOLE_HALF_W * s;
  const dx = bx - cx, dy = by - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxR = domeR2 - r - 1;
  if (gateOpen && Math.abs(bx - holeCx) < holeHW && by + r > holeY2 - 6 * s) {
    if (by > holeY2 + r * 0.5) data[base + 5] = flags | F_ESCAPED;
    return;
  }
  if (dist > maxR && dist > 0.01) {
    const nx = dx / dist, ny = dy / dist;
    data[base] = cx + nx * maxR;
    data[base + 1] = cy + ny * maxR;
    const dot = rd(data, base + 2) * nx + rd(data, base + 3) * ny;
    if (dot > 0) { data[base + 2] = rd(data, base + 2) - (1 + DAMPING) * dot * nx; data[base + 3] = rd(data, base + 3) - (1 + DAMPING) * dot * ny; }
  }
  if (!gateOpen && by + r > holeY2 - 1 * s) {
    data[base + 1] = holeY2 - 1 * s - r;
    if (rd(data, base + 3) > 0) data[base + 3] = -rd(data, base + 3) * DAMPING * 0.4;
  }
}

function ballCollision(data: number[], a: number, b: number): void {
  const ba = a * STRIDE, bb = b * STRIDE;
  const dx = rd(data, bb) - rd(data, ba), dy = rd(data, bb + 1) - rd(data, ba + 1);
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minD = rd(data, ba + 4) + rd(data, bb + 4);
  if (dist >= minD || dist < 0.01) return;
  const nx = dx / dist, ny = dy / dist, ov = minD - dist;
  data[ba] = rd(data, ba) - nx * ov * 0.5; data[ba + 1] = rd(data, ba + 1) - ny * ov * 0.5;
  data[bb] = rd(data, bb) + nx * ov * 0.5; data[bb + 1] = rd(data, bb + 1) + ny * ov * 0.5;
  const rv = rd(data, ba + 2) - rd(data, bb + 2), rvy = rd(data, ba + 3) - rd(data, bb + 3);
  const rDot = rv * nx + rvy * ny;
  if (rDot > 0) {
    const imp = rDot * 0.5 * (1 + DAMPING);
    data[ba + 2] = rd(data, ba + 2) - imp * nx; data[ba + 3] = rd(data, ba + 3) - imp * ny;
    data[bb + 2] = rd(data, bb + 2) + imp * nx; data[bb + 3] = rd(data, bb + 3) + imp * ny;
  }
}

function physicsTick(data: number[], n: number, dt: number, gateOpen: boolean, applyGravity: boolean, multiMode: boolean, multiCount: number, s: number): void {
  const gravity = GRAVITY * s, floorY2 = FLOOR_Y * s, chuteBot = CHUTE_BOT * s;
  const holeCx = HOLE_CX * s, holeY2 = HOLE_Y * s;
  const chuteHW = (multiMode && multiCount > 1 ? 40 : HOLE_HALF_W) * s;
  for (let i = 0; i < n; i++) {
    const base = i * STRIDE;
    if ((rd(data, base + 5) & F_ON_FLOOR) !== 0) continue;
    if (applyGravity) data[base + 3] = rd(data, base + 3) + gravity * dt;
    data[base] = rd(data, base) + rd(data, base + 2) * dt;
    data[base + 1] = rd(data, base + 1) + rd(data, base + 3) * dt;
    data[base + 2] = rd(data, base + 2) * FRICTION;
    data[base + 3] = rd(data, base + 3) * FRICTION;
  }
  for (let p = 0; p < COLLISION_PASSES; p++) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) ballCollision(data, i, j);
  }
  for (let i = 0; i < n; i++) {
    const f = rd(data, i * STRIDE + 5);
    if (!(f & F_ESCAPED) && !(f & F_ON_FLOOR)) constrainToDome(data, i, gateOpen, s);
  }
  for (let i = 0; i < n; i++) {
    const base = i * STRIDE, flags = rd(data, base + 5);
    if (!(flags & F_ESCAPED) || (flags & F_ON_FLOOR)) continue;
    const bx = rd(data, base), by = rd(data, base + 1), r = rd(data, base + 4);
    if (by < chuteBot + r && by > holeY2) {
      if (bx < holeCx - chuteHW + r) { data[base] = holeCx - chuteHW + r; data[base + 2] = Math.abs(rd(data, base + 2)) * 0.3; }
      if (bx > holeCx + chuteHW - r) { data[base] = holeCx + chuteHW - r; data[base + 2] = -Math.abs(rd(data, base + 2)) * 0.3; }
    }
    if (by >= chuteBot) {
      if (bx < r + 20 * s) { data[base] = r + 20 * s; data[base + 2] = Math.abs(rd(data, base + 2)) * 0.3; }
      if (bx > REF_W * s - r - 20 * s) { data[base] = REF_W * s - r - 20 * s; data[base + 2] = -Math.abs(rd(data, base + 2)) * 0.3; }
    }
    if (by + r > floorY2) {
      data[base + 1] = floorY2 - r;
      if (Math.abs(rd(data, base + 3)) < 25 * s) { data[base + 3] = 0; data[base + 2] = 0; data[base + 5] = rd(data, base + 5) | F_ON_FLOOR; }
      else { data[base + 3] = -rd(data, base + 3) * 0.4; data[base + 2] = rd(data, base + 2) * 0.7; }
    }
  }
}

function preSettle(s: number): number[] {
  const data = new Array<number>(NUM_BALLS * STRIDE).fill(0);
  for (let i = 0; i < NUM_BALLS; i++) {
    const angle = ((i * 137.5) % 360) * Math.PI / 180;
    const dist2 = ((i * 23 + 7) % 100) / 100 * (DOME_R * s - BALL_R * s - 10 * s);
    const base = i * STRIDE;
    data[base] = DOME_CX * s + Math.cos(angle) * dist2;
    data[base + 1] = DOME_CY * s + Math.sin(angle) * dist2;
    data[base + 4] = BALL_R * s;
  }
  for (let f = 0; f < 300; f++) {
    physicsTick(data, NUM_BALLS, 1 / 60, false, true, false, 0, s);
    for (let i = 0; i < NUM_BALLS; i++) { constrainToDome(data, i, false, s); data[i * STRIDE + 5] = 0; }
  }
  return data;
}

// ─── Props ───────────────────────────────────────────────────────────────

interface CapsuleMachineCanvasProps {
  dom?: import('expo/dom').DOMProps;
  width: number;
  height: number;
  drawType: 'normal' | 'golden';
  startTrigger: number;
  drawCount: number;
  results: string | null;
  cancelTrigger: number;
  onPhaseChange: (phase: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────

export default function CapsuleMachineCanvas({
  width, height, drawType, startTrigger, drawCount, results, cancelTrigger, onPhaseChange,
}: CapsuleMachineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const stateRef = useRef<MachineState | null>(null);
  const scale = Math.min(width / REF_W, height / REF_H);
  const canvasW = REF_W * scale;
  const canvasH = REF_H * scale;

  function initState(): MachineState {
    return {
      phase: PHASE_IDLE, phaseTimer: 0, ballData: preSettle(scale),
      gateOpen: false, dialAngle: 0, flashAlpha: 0, shakeX: 0, shakeY: 0,
      multiMode: false, multiCount: 0, droppedCount: 0,
      capsuleIdx: -1, autoOpenTimer: 0, revealTimer: 0,
      resultsReady: false, resultRarities: [],
      droppedIndices: [], multiOpenIdx: 0, multiOpenTimer: 0,
      shellPieces: [], sparkles: [], cancelled: false, lastPhaseReported: -1,
    };
  }

  // Handle startTrigger
  const startRef = useRef(startTrigger);
  useEffect(() => {
    if (startTrigger === startRef.current) return;
    startRef.current = startTrigger;
    if (startTrigger === 0) return;
    const st = initState();
    st.phase = PHASE_TUMBLING;
    st.multiMode = drawCount > 1;
    st.multiCount = drawCount;
    stateRef.current = st;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTrigger, drawCount]);

  // Handle results
  useEffect(() => {
    if (!results || !stateRef.current) return;
    const rarities: string[] = JSON.parse(results) as string[];
    const RMAP: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
    stateRef.current.resultRarities = rarities.map(r => RMAP[r] ?? 0);
    stateRef.current.resultsReady = true;
  }, [results]);

  // Handle cancelTrigger
  const cancelRef = useRef(cancelTrigger);
  useEffect(() => {
    if (cancelTrigger === cancelRef.current) return;
    cancelRef.current = cancelTrigger;
    if (stateRef.current) { stateRef.current.cancelled = true; stateRef.current.phase = PHASE_IDLE; }
  }, [cancelTrigger]);

  // Main animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    ctx.scale(dpr, dpr);
    if (!stateRef.current) stateRef.current = initState();
    let lastTime = performance.now();

    function frame(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.033);
      lastTime = now;
      const s = scale;
      const st = stateRef.current!;
      const data = st.ballData;

      // ── Physics ──
      if (st.phase !== PHASE_IDLE && st.phase !== PHASE_DONE && !st.cancelled) {
        st.phaseTimer += dt;

        if (st.phase === PHASE_TUMBLING) {
          const progress = st.phaseTimer / TUMBLE_DURATION;
          let strength: number;
          if (progress < 0.15) strength = progress / 0.15;
          else if (progress < 0.65) strength = 1.0;
          else { strength = 1 - (progress - 0.65) / 0.35; strength = Math.max(0, strength * strength); }
          const time = st.phaseTimer;
          const spinDir = Math.sin(time * 1.5) > 0 ? 1 : -1;
          for (let i = 0; i < NUM_BALLS; i++) {
            const base = i * STRIDE;
            if (rd(data, base + 5) & F_ESCAPED) continue;
            const dx = rd(data, base) - DOME_CX * s, dy = rd(data, base + 1) - DOME_CY * s;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const tx = (-dy / dist) * spinDir, ty = (dx / dist) * spinDir;
            data[base + 2] = rd(data, base + 2) + tx * TUMBLE_FORCE * s * strength * dt + Math.sin(i * 7 + time * 3) * 400 * s * strength * dt;
            data[base + 3] = rd(data, base + 3) + ty * TUMBLE_FORCE * s * strength * dt + Math.cos(i * 5 + time * 2) * 400 * s * strength * dt;
            data[base + 2] = rd(data, base + 2) - (dx / dist) * 150 * s * dt * strength;
            data[base + 3] = rd(data, base + 3) - (dy / dist) * 150 * s * dt * strength;
          }
          st.dialAngle += 12 * dt * strength;
          st.shakeX += Math.sin(now * 0.01) * 2 * strength;
          st.shakeY += Math.cos(now * 0.013) * 2 * strength;
          if (st.phaseTimer >= TUMBLE_DURATION) { st.phase = PHASE_SETTLING; st.phaseTimer = 0; }
        }

        if (st.phase === PHASE_SETTLING) {
          for (let i = 0; i < NUM_BALLS; i++) { const b = i * STRIDE; if (!(rd(data, b + 5) & F_ESCAPED)) { data[b + 2] = rd(data, b + 2) * 0.95; data[b + 3] = rd(data, b + 3) * 0.95; } }
          if (st.phaseTimer > SETTLE_DURATION) {
            if (!st.resultsReady) { st.phase = PHASE_WAITING; st.phaseTimer = 0; }
            else { goGate(st, data, s); }
          }
        }

        if (st.phase === PHASE_WAITING) {
          for (let i = 0; i < NUM_BALLS; i++) { const b = i * STRIDE; if (!(rd(data, b + 5) & F_ESCAPED)) { data[b + 2] = rd(data, b + 2) * 0.98; data[b + 3] = rd(data, b + 3) * 0.98; } }
          if (st.resultsReady) goGate(st, data, s);
        }

        if (st.phase === PHASE_GATE_OPEN) {
          let found = -1;
          for (let i = 0; i < NUM_BALLS; i++) { const f = rd(data, i * STRIDE + 5); if ((f & F_ESCAPED) && !(f & F_OPENED)) { found = i; break; } }
          if (found >= 0) { data[found * STRIDE + 4] = BALL_R_SINGLE * s; st.capsuleIdx = found; st.phase = PHASE_DROPPING; st.gateOpen = false; }
          if (st.phaseTimer > 2.5 && found < 0) { forceBallOut(data, s, BALL_R_SINGLE, st); st.phase = PHASE_DROPPING; st.gateOpen = false; }
        }

        if (st.phase === PHASE_DROPPING) {
          if (st.capsuleIdx >= 0 && (rd(data, st.capsuleIdx * STRIDE + 5) & F_ON_FLOOR)) { st.phase = PHASE_AUTO_OPEN; st.phaseTimer = 0; st.autoOpenTimer = 0; }
        }

        if (st.phase === PHASE_AUTO_OPEN) {
          st.autoOpenTimer += dt;
          if (st.autoOpenTimer > 0.5) { triggerOpen(st, st.capsuleIdx); st.phase = PHASE_SINGLE_REVEAL; st.phaseTimer = 0; st.revealTimer = 0; }
        }

        if (st.phase === PHASE_SINGLE_REVEAL) { st.revealTimer += dt; if (st.revealTimer > 2.0) st.phase = PHASE_DONE; }

        if (st.phase === PHASE_MULTI_GATE) {
          let dc = st.droppedCount;
          for (let i = 0; i < NUM_BALLS; i++) {
            const f = rd(data, i * STRIDE + 5);
            if ((f & F_ESCAPED) && !st.droppedIndices.includes(i) && dc < st.multiCount) {
              data[i * STRIDE + 4] = BALL_R_MULTI * s;
              data[i * STRIDE + 2] = rd(data, i * STRIDE + 2) + Math.sin(i * 3) * 100 * s;
              st.droppedIndices.push(i); dc++;
            }
          }
          st.droppedCount = dc;
          if (dc >= st.multiCount) { st.gateOpen = false; st.phase = PHASE_MULTI_DROPPING; st.phaseTimer = 0; }
          if (st.phaseTimer > 4) { forceMultiOut(data, s, st); st.gateOpen = false; st.phase = PHASE_MULTI_DROPPING; st.phaseTimer = 0; }
          if (st.phaseTimer > 0.5 && dc < st.multiCount) {
            for (let i = 0; i < NUM_BALLS; i++) { const b = i * STRIDE; if (!(rd(data, b + 5) & F_ESCAPED) && !(rd(data, b + 5) & F_ON_FLOOR)) { data[b] = rd(data, b) + (HOLE_CX * s - rd(data, b)) * 0.02; data[b + 3] = rd(data, b + 3) + 10 * dt * 60; } }
          }
        }

        if (st.phase === PHASE_MULTI_DROPPING) {
          let allLanded = true;
          for (const bi of st.droppedIndices) { const f = rd(data, bi * STRIDE + 5); if (!(f & F_ON_FLOOR) && !(f & F_OPENED)) { allLanded = false; break; } }
          if (allLanded) { st.phase = PHASE_MULTI_OPENING; st.multiOpenIdx = 0; st.multiOpenTimer = 0; st.phaseTimer = 0; }
        }

        if (st.phase === PHASE_MULTI_OPENING) {
          st.multiOpenTimer += dt;
          if (st.multiOpenTimer > 0.25 && st.multiOpenIdx < st.droppedIndices.length) {
            const bi = st.droppedIndices[st.multiOpenIdx]!;
            if (!(rd(data, bi * STRIDE + 5) & F_OPENED)) triggerOpen(st, bi);
            st.multiOpenIdx++; st.multiOpenTimer = 0;
          }
          if (st.multiOpenIdx >= st.droppedIndices.length && st.multiOpenTimer > 0.6) st.phase = PHASE_DONE;
        }

        physicsTick(data, NUM_BALLS, dt, st.gateOpen, st.phase !== PHASE_TUMBLING, st.multiMode, st.multiCount, s);
        st.shakeX *= 0.88; st.shakeY *= 0.88; st.flashAlpha *= 0.9;

        // Shell pieces (stride 9)
        for (let i = st.shellPieces.length - 9; i >= 0; i -= 9) {
          st.shellPieces[i] = rd(st.shellPieces, i) + rd(st.shellPieces, i + 2) * dt;
          st.shellPieces[i + 1] = rd(st.shellPieces, i + 1) + rd(st.shellPieces, i + 3) * dt;
          st.shellPieces[i + 3] = rd(st.shellPieces, i + 3) + 300 * dt;
          st.shellPieces[i + 5] = rd(st.shellPieces, i + 5) + rd(st.shellPieces, i + 6) * dt * 10;
          st.shellPieces[i + 7] = rd(st.shellPieces, i + 7) - 0.8 * dt;
          if (rd(st.shellPieces, i + 7) <= 0) st.shellPieces.splice(i, 9);
        }
        // Sparkles (stride 7)
        for (let i = st.sparkles.length - 7; i >= 0; i -= 7) {
          st.sparkles[i] = rd(st.sparkles, i) + rd(st.sparkles, i + 2) * dt;
          st.sparkles[i + 1] = rd(st.sparkles, i + 1) + rd(st.sparkles, i + 3) * dt;
          st.sparkles[i + 2] = rd(st.sparkles, i + 2) * 0.96;
          st.sparkles[i + 3] = rd(st.sparkles, i + 3) * 0.96;
          st.sparkles[i + 4] = rd(st.sparkles, i + 4) - 1.2 * dt;
          if (rd(st.sparkles, i + 4) <= 0) st.sparkles.splice(i, 7);
        }
      }

      // Phase change reporting
      if (st.phase !== st.lastPhaseReported) { st.lastPhaseReported = st.phase; onPhaseChange(st.phase); }

      // ── Render ──
      ctx!.clearRect(0, 0, canvasW, canvasH);
      ctx!.save();
      ctx!.translate(st.shakeX, st.shakeY);

      // Background
      ctx!.fillStyle = MC.bg; ctx!.fillRect(0, 0, canvasW, canvasH);
      const grd = ctx!.createRadialGradient(canvasW / 2, canvasH * 0.32, 0, canvasW / 2, canvasH * 0.32, canvasH * 0.55);
      grd.addColorStop(0, 'rgba(232,232,240,0.35)'); grd.addColorStop(1, 'rgba(232,232,240,0)');
      ctx!.fillStyle = grd; ctx!.fillRect(0, 0, canvasW, canvasH);

      // Floor
      ctx!.fillStyle = MC.floor; ctx!.fillRect(0, FLOOR_Y * s, canvasW, canvasH - FLOOR_Y * s);
      ctx!.strokeStyle = MC.floorLine; ctx!.lineWidth = 1;
      ctx!.beginPath(); ctx!.moveTo(30 * s, FLOOR_Y * s); ctx!.lineTo(canvasW - 30 * s, FLOOR_Y * s); ctx!.stroke();

      // Shadow
      ctx!.fillStyle = MC.shadow;
      ctx!.beginPath(); ctx!.ellipse(canvasW / 2, BODY_B * s + 24 * s, 148 * s, 14 * s, 0, 0, Math.PI * 2); ctx!.fill();

      // Machine body
      ctx!.fillStyle = MC.bodyMid;
      roundRect(ctx!, BODY_L * s, BODY_T * s, (BODY_R_X - BODY_L) * s, (BODY_B - BODY_T) * s, 6 * s); ctx!.fill();
      ctx!.strokeStyle = MC.bodyEdge; ctx!.lineWidth = 2;
      roundRect(ctx!, BODY_L * s, BODY_T * s, (BODY_R_X - BODY_L) * s, (BODY_B - BODY_T) * s, 6 * s); ctx!.stroke();

      // Balls inside dome (clipped)
      ctx!.save();
      ctx!.beginPath(); ctx!.arc(DOME_CX * s, DOME_CY * s, DOME_R * s, 0, Math.PI * 2); ctx!.clip();
      for (let i = 0; i < NUM_BALLS; i++) {
        const base = i * STRIDE, flags = rd(data, base + 5);
        if ((flags & F_ESCAPED) || (flags & F_OPENED)) continue;
        drawBall(ctx!, rd(data, base), rd(data, base + 1), rd(data, base + 4), i);
      }
      ctx!.restore();

      // Dome glass
      ctx!.strokeStyle = MC.domeStroke; ctx!.lineWidth = 3;
      ctx!.beginPath(); ctx!.arc(DOME_CX * s, DOME_CY * s, DOME_R * s, 0, Math.PI * 2); ctx!.stroke();
      ctx!.fillStyle = MC.dome;
      ctx!.beginPath(); ctx!.arc(DOME_CX * s, DOME_CY * s, DOME_R * s, 0, Math.PI * 2); ctx!.fill();
      // Highlight
      ctx!.fillStyle = 'rgba(255,255,255,0.13)';
      ctx!.beginPath(); ctx!.ellipse(DOME_CX * s - 55 * s, DOME_CY * s, 16 * s, 72 * s, 0, 0, Math.PI * 2); ctx!.fill();

      // Gate
      if (st.gateOpen) { ctx!.fillStyle = MC.gate; ctx!.fillRect(HOLE_CX * s - HOLE_HALF_W * s, HOLE_Y * s - 4 * s, HOLE_HALF_W * 2 * s, 8 * s); }

      // Chute
      const chuteHW = (st.gateOpen ? 40 : 28) * s;
      ctx!.fillStyle = MC.chute;
      ctx!.beginPath();
      ctx!.moveTo(canvasW / 2 - chuteHW, CHUTE_TOP * s);
      ctx!.lineTo(canvasW / 2 - chuteHW + 4 * s, CHUTE_BOT * s);
      ctx!.quadraticCurveTo(canvasW / 2, CHUTE_BOT * s + 12 * s, canvasW / 2 + chuteHW - 4 * s, CHUTE_BOT * s);
      ctx!.lineTo(canvasW / 2 + chuteHW, CHUTE_TOP * s);
      ctx!.closePath(); ctx!.fill();
      ctx!.strokeStyle = MC.chuteStroke; ctx!.lineWidth = 1.5; ctx!.stroke();

      // Dial
      const dialX = canvasW / 2, dialY2 = DIAL_Y * s, dialR = 32 * s;
      ctx!.fillStyle = MC.dialBody;
      ctx!.beginPath(); ctx!.arc(dialX, dialY2, dialR, 0, Math.PI * 2); ctx!.fill();
      ctx!.strokeStyle = MC.dialStroke; ctx!.lineWidth = 2; ctx!.stroke();
      ctx!.fillStyle = MC.dialHighlight;
      ctx!.beginPath(); ctx!.arc(dialX, dialY2 - 23 * s, 8 * s, 0, Math.PI * 2); ctx!.fill();
      ctx!.fillStyle = MC.dialKnob;
      ctx!.beginPath(); ctx!.arc(dialX - 1 * s, dialY2 - 22 * s, 3 * s, 0, Math.PI * 2); ctx!.fill();
      // Crosshair
      ctx!.strokeStyle = 'rgba(255,255,255,0.12)'; ctx!.lineWidth = 2;
      ctx!.beginPath(); ctx!.moveTo(dialX - 9 * s, dialY2); ctx!.lineTo(dialX + 9 * s, dialY2); ctx!.stroke();
      ctx!.beginPath(); ctx!.moveTo(dialX, dialY2 - 9 * s); ctx!.lineTo(dialX, dialY2 + 9 * s); ctx!.stroke();

      // Base feet
      ctx!.fillStyle = MC.body;
      roundRect(ctx!, BODY_L * s + 18 * s, BODY_B * s, 28 * s, 22 * s, 3 * s); ctx!.fill();
      roundRect(ctx!, BODY_R_X * s - 46 * s, BODY_B * s, 28 * s, 22 * s, 3 * s); ctx!.fill();

      // Escaped balls
      for (let i = 0; i < NUM_BALLS; i++) {
        const base = i * STRIDE, flags = rd(data, base + 5);
        if (!(flags & F_ESCAPED) || (flags & F_OPENED)) continue;
        drawBall(ctx!, rd(data, base), rd(data, base + 1), rd(data, base + 4), i);
      }

      // Shell fragments
      for (let i = 0; i < st.shellPieces.length; i += 9) {
        const alpha = rd(st.shellPieces, i + 7); if (alpha <= 0) continue;
        ctx!.globalAlpha = alpha;
        const ci = rd(st.shellPieces, i + 8);
        ctx!.fillStyle = ci < 0 ? '#FFFFFF' : (BALL_COLORS[ci % BALL_COLORS.length] ?? '#FFFFFF');
        ctx!.beginPath(); ctx!.arc(rd(st.shellPieces, i), rd(st.shellPieces, i + 1), rd(st.shellPieces, i + 4), 0, Math.PI * 2); ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      // Sparkles
      for (let i = 0; i < st.sparkles.length; i += 7) {
        const life = rd(st.sparkles, i + 4); if (life <= 0) continue;
        const sx = rd(st.sparkles, i), sy = rd(st.sparkles, i + 1);
        const sz = rd(st.sparkles, i + 5) * life;
        const ri = rd(st.sparkles, i + 6);
        const color = RARITY_GLOW[ri] ?? RARITY_GLOW[0]!;
        ctx!.globalAlpha = life; ctx!.fillStyle = color;
        ctx!.beginPath(); ctx!.arc(sx, sy, sz * 0.5, 0, Math.PI * 2); ctx!.fill();
        ctx!.strokeStyle = color; ctx!.lineWidth = 1;
        const arm = sz * 1.8;
        ctx!.beginPath(); ctx!.moveTo(sx - arm, sy); ctx!.lineTo(sx + arm, sy); ctx!.stroke();
        ctx!.beginPath(); ctx!.moveTo(sx, sy - arm); ctx!.lineTo(sx, sy + arm); ctx!.stroke();
      }
      ctx!.globalAlpha = 1;

      // Flash
      if (st.flashAlpha > 0.01) { ctx!.globalAlpha = st.flashAlpha; ctx!.fillStyle = '#FFFFFF'; ctx!.fillRect(0, 0, canvasW, canvasH); ctx!.globalAlpha = 1; }

      // Label
      ctx!.fillStyle = drawType === 'golden' ? 'rgba(245,200,80,0.7)' : 'rgba(200,200,240,0.5)';
      ctx!.font = `900 ${12 * s}px sans-serif`; ctx!.textAlign = 'center';
      ctx!.fillText(drawType === 'golden' ? '\u2605 GOLDEN GACHA \u2605' : '\u2726 GACHA \u2726', canvasW / 2, (BODY_T + 24) * s);

      ctx!.restore();
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasW, canvasH, scale]);

  return <canvas ref={canvasRef} style={{ width: canvasW, height: canvasH, display: 'block' }} />;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function goGate(st: MachineState, data: number[], s: number): void {
  st.gateOpen = true; st.phaseTimer = 0;
  const isMulti = st.multiMode;
  if (isMulti) {
    st.phase = PHASE_MULTI_GATE;
    const sorted: number[] = [];
    for (let i = 0; i < NUM_BALLS; i++) { if (!(rd(data, i * STRIDE + 5) & F_ESCAPED)) sorted.push(i); }
    sorted.sort((a, b) => rd(data, b * STRIDE + 1) - rd(data, a * STRIDE + 1));
    const nudge = Math.min(st.multiCount + 2, sorted.length);
    for (let i = 0; i < nudge; i++) {
      const base = sorted[i]! * STRIDE;
      data[base + 3] = rd(data, base + 3) + (40 + (i * 17 % 30)) * s;
      data[base] = rd(data, base) + (HOLE_CX * s - rd(data, base)) * 0.3;
      data[base + 2] = rd(data, base + 2) + (Math.sin(i * 7) * 0.5) * 30 * s;
    }
  } else {
    st.phase = PHASE_GATE_OPEN;
    const sorted: number[] = [];
    for (let i = 0; i < NUM_BALLS; i++) { if (!(rd(data, i * STRIDE + 5) & F_ESCAPED)) sorted.push(i); }
    sorted.sort((a, b) => rd(data, b * STRIDE + 1) - rd(data, a * STRIDE + 1));
    const nudge = Math.min(3, sorted.length);
    for (let i = 0; i < nudge; i++) {
      const base = sorted[i]! * STRIDE;
      data[base + 3] = rd(data, base + 3) + 50 * s;
      data[base] = rd(data, base) + (HOLE_CX * s - rd(data, base)) * 0.4;
    }
  }
}

function forceBallOut(data: number[], s: number, ballR: number, st: MachineState): void {
  let low = -1, lowY = -9999;
  for (let i = 0; i < NUM_BALLS; i++) { const b = i * STRIDE; if (!(rd(data, b + 5) & F_ESCAPED) && rd(data, b + 1) > lowY) { lowY = rd(data, b + 1); low = i; } }
  if (low >= 0) { data[low * STRIDE] = HOLE_CX * s; data[low * STRIDE + 3] = 120 * s; data[low * STRIDE + 5] = rd(data, low * STRIDE + 5) | F_ESCAPED; data[low * STRIDE + 4] = ballR * s; st.capsuleIdx = low; }
}

function forceMultiOut(data: number[], s: number, st: MachineState): void {
  let dc = st.droppedCount;
  while (dc < st.multiCount) {
    let low = -1, lowY = -9999;
    for (let i = 0; i < NUM_BALLS; i++) { const b = i * STRIDE; if (!(rd(data, b + 5) & F_ESCAPED) && !(rd(data, b + 5) & F_ON_FLOOR) && rd(data, b + 1) > lowY) { lowY = rd(data, b + 1); low = i; } }
    if (low < 0) break;
    data[low * STRIDE] = HOLE_CX * s + Math.sin(dc * 7) * 10 * s; data[low * STRIDE + 3] = 120 * s;
    data[low * STRIDE + 5] = rd(data, low * STRIDE + 5) | F_ESCAPED; data[low * STRIDE + 4] = BALL_R_MULTI * s;
    data[low * STRIDE + 2] = Math.sin(dc * 5) * 100 * s;
    st.droppedIndices.push(low); dc++;
  }
  st.droppedCount = dc;
}

function triggerOpen(st: MachineState, bi: number): void {
  if (bi < 0) return;
  const data = st.ballData;
  const bx = rd(data, bi * STRIDE), by = rd(data, bi * STRIDE + 1), br = rd(data, bi * STRIDE + 4);
  data[bi * STRIDE + 5] = rd(data, bi * STRIDE + 5) | F_OPENED;
  st.flashAlpha = st.multiMode ? 0.25 : 0.6;
  st.shakeX += Math.sin(bi * 7) * (st.multiMode ? 4 : 12);
  st.shakeY += Math.cos(bi * 5) * (st.multiMode ? 4 : 12);
  const openedSoFar = Math.floor(st.shellPieces.length / 90);
  const rar = openedSoFar < st.resultRarities.length ? (st.resultRarities[openedSoFar] ?? 0) : 0;
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * 2 * i) / 10 + Math.sin(i * 3) * 0.4;
    const speed = 100 + ((i * 53 + 7) % 140);
    st.shellPieces.push(bx, by, Math.cos(a) * speed, Math.sin(a) * speed - 60, br * (0.2 + ((i * 37 + 3) % 30) / 100), 0, Math.sin(i * 11) * 5, 1, i < 5 ? -1 : bi % BALL_COLORS.length);
  }
  const nSparkles = st.multiMode ? 10 : 28;
  for (let i = 0; i < nSparkles; i++) {
    const a = ((i * 137.5) % 360) * Math.PI / 180;
    const speed = 40 + ((i * 53 + 7) % 120);
    st.sparkles.push(bx, by, Math.cos(a) * speed, Math.sin(a) * speed, 1, 2 + ((i * 41 + 3) % 4), rar);
  }
}

function drawBall(ctx: CanvasRenderingContext2D, bx: number, by: number, r: number, i: number): void {
  const color = BALL_COLORS[i % BALL_COLORS.length] ?? '#e74c3c';
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(bx, by, r, Math.PI, 0); ctx.lineTo(bx - r, by); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI); ctx.lineTo(bx + r, by); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(bx - r, by); ctx.lineTo(bx + r, by); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath(); ctx.arc(bx - r * 0.28, by - r * 0.35, r * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(bx, by - r * 0.08, r * 0.28, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.stroke();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
