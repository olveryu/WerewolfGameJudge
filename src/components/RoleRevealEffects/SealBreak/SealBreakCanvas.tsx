'use dom';

/**
 * SealBreakCanvas — 封印解除视觉层（Canvas 2D）
 *
 * 深红蜡封圆盘 + 旋转符文环 + 裂纹 + 能量粒子 + 碎片 + 进度环 +
 * 能量光束 + 火焰余烬 + 雾气 + 古文字环。
 * 受 `isPressed` 驱动蓄力，满能后调 `onShatter()`。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Constants ────────────────────────────────────────────────────────

const COLORS = {
  waxDark: '#8B1A1A',
  waxMid: '#B22222',
  waxLight: '#CD5C5C',
  rune: '#FFD700',
  runeGlow: 'rgba(255, 215, 0, 0.4)',
  crack: '#FFE4B5',
  crackGlow: 'rgba(255, 228, 181, 0.6)',
  shardColors: ['#8B1A1A', '#B22222', '#CD5C5C', '#A52A2A', '#DC143C'],
  auraInner: 'rgba(255, 215, 0, 0.3)',
  progressRing: '#FFD700',
  progressRingBg: 'rgba(255, 215, 0, 0.15)',
  energyParticle: 'rgba(255, 215, 0, 0.6)',
  fogColor: 'rgba(20, 10, 30, 0.6)',
  emberCore: '#FF6B00',
  energyBeam: 'rgba(255, 215, 0, 0.5)',
  chainColor: 'rgba(160, 160, 160, 0.6)',
  ancientText: 'rgba(180, 160, 120, 0.4)',
  waxDrip: '#6B1010',
  sealPulse: 'rgba(255, 215, 0, 0.2)',
};

// Energy beam angles — 8 radial beams
const ENERGY_BEAM_ANGLES = Array.from({ length: 8 }, (_, i) => ((Math.PI * 2) / 8) * i);

// Chain positions (6 around outer ring)
const CHAIN_POSITIONS = Array.from({ length: 6 }, (_, i) => ({
  angle: ((Math.PI * 2) / 6) * i + Math.PI / 6,
}));

// Ancient text symbols
const ANCIENT_SYMBOLS = ['𐤀', '𐤁', '𐤂', '𐤃', '𐤄', '𐤅', '𐤆', '𐤇', '𐤈', '𐤉'];

// Inner rune symbols
const INNER_RUNES = ['\u263D', '\u2726', '\u269D', '\u25C8', '\u2727', '\u263F'];

// Outer rune symbols
const OUTER_RUNES = [
  '\u16A0',
  '\u16A2',
  '\u16A6',
  '\u16A8',
  '\u16B1',
  '\u16B2',
  '\u16B7',
  '\u16B9',
  '\u16BA',
  '\u16BE',
  '\u16C1',
  '\u16C3',
];

// Wax drips
const WAX_DRIPS = Array.from({ length: 5 }, (_, i) => {
  const angle = Math.PI * 0.3 + ((Math.PI * 0.4) / 4) * i;
  return { angle, length: 12 + ((i * 37 + 13) % 18) };
});

// Shards
const SHARDS = Array.from({ length: 16 }, (_, i) => ({
  angle: ((Math.PI * 2) / 16) * i + (((i * 37 + 5) % 10) / 10 - 0.5) * 0.4,
  distance: 120 + ((i * 53 + 7) % 200),
  size: 6 + ((i * 41 + 3) % 12),
  color: COLORS.shardColors[i % COLORS.shardColors.length]!,
}));

// Energy particles
const ENERGY_PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  startAngle: ((Math.PI * 2) / 12) * i,
  speed: 0.8 + ((i * 37) % 40) / 100,
  radiusOffset: ((i * 53) % 30) / 100,
}));

// Fire embers
function createEmbers(w: number, h: number) {
  return Array.from({ length: 14 }, (_, i) => ({
    startX: w * 0.3 + (((i * 73 + 17) % 100) / 100) * w * 0.4,
    startY: h * 0.5 + (((i * 41 + 31) % 100) / 100) * h * 0.15,
    drift: (((i * 59 + 7) % 100) / 100 - 0.5) * 30,
    size: 2 + ((i * 83 + 11) % 25) / 10,
  }));
}

// Fog circles
function createFogCircles(w: number, h: number) {
  return [
    { x: 0, y: h * 0.65, r: 130 },
    { x: w, y: h * 0.7, r: 110 },
    { x: w * 0.3, y: h, r: 150 },
    { x: w * 0.7, y: h * 0.95, r: 120 },
  ];
}

// Crack paths (pre-computed directions)
function buildCracks(cx: number, cy: number, radius: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const baseAngle = ((Math.PI * 2) / count) * i;
    const segments: Array<{ x: number; y: number }> = [{ x: cx, y: cy }];
    for (let s = 1; s <= 4; s++) {
      const frac = s / 4;
      const driftSeed = (i * 73 + s * 37 + 5) % 100;
      const drift = (driftSeed / 100 - 0.5) * radius * 0.15;
      segments.push({
        x: cx + Math.cos(baseAngle) * radius * frac + Math.cos(baseAngle + Math.PI / 2) * drift,
        y: cy + Math.sin(baseAngle) * radius * frac + Math.sin(baseAngle + Math.PI / 2) * drift,
      });
    }
    return segments;
  });
}

// ─── Component ────────────────────────────────────────────────────────

interface SealBreakCanvasProps {
  dom?: import('expo/dom').DOMProps;
  width: number;
  height: number;
  phase: 'appear' | 'idle' | 'charging' | 'shatter' | 'hidden';
  isPressed: boolean;
  sealRadiusRatio: number;
  chargeDuration: number;
  decayRate: number;
  shatterDuration: number;
  onShatter?: () => void;
  onChargeUpdate?: (percent: number) => void;
}

export default function SealBreakCanvas({
  width,
  height,
  phase,
  isPressed,
  sealRadiusRatio,
  chargeDuration,
  decayRate: decayRateProp,
  shatterDuration,
  onShatter,
  onChargeUpdate,
}: SealBreakCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const [internalPhase, setInternalPhase] = useState(phase);

  const cx = width / 2;
  const cy = height / 2;
  const sealRadius = width * sealRadiusRatio;
  const chargeRate = 1 / chargeDuration;
  const decayRate = decayRateProp / 1000;

  // Animation state refs
  const chargeRef = useRef(0);
  const isPressedRef = useRef(isPressed);
  const shatteredRef = useRef(false);
  const shatterStartRef = useRef(0);
  const t0Ref = useRef(0);
  const lastChargeReportRef = useRef(0);

  // Pre-computed geometry
  const embersRef = useRef(createEmbers(width, height));
  const fogRef = useRef(createFogCircles(width, height));
  const cracksRef = useRef(buildCracks(cx, cy, sealRadius, 8));

  useEffect(() => {
    embersRef.current = createEmbers(width, height);
    fogRef.current = createFogCircles(width, height);
    cracksRef.current = buildCracks(cx, cy, sealRadius, 8);
  }, [width, height, cx, cy, sealRadius]);

  useEffect(() => {
    isPressedRef.current = isPressed;
  }, [isPressed]);

  useEffect(() => {
    setInternalPhase(phase);
    if (phase === 'idle') t0Ref.current = performance.now();
    if (phase === 'shatter') shatterStartRef.current = performance.now();
  }, [phase]);

  // Notify parent of charge changes (throttled)
  const reportCharge = useCallback(
    (now: number, charge: number) => {
      if (now - lastChargeReportRef.current > 50) {
        lastChargeReportRef.current = now;
        onChargeUpdate?.(Math.floor(charge * 100));
      }
    },
    [onChargeUpdate],
  );

  // Main draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let lastDrawTime = 0;

    function draw(now: number) {
      const dt = lastDrawTime > 0 ? Math.min(now - lastDrawTime, 33) : 16;
      lastDrawTime = now;
      ctx!.clearRect(0, 0, width, height);
      const t = (now - t0Ref.current) / 1000;

      // ── Update charge ──
      if ((internalPhase === 'idle' || internalPhase === 'charging') && !shatteredRef.current) {
        if (isPressedRef.current) {
          chargeRef.current = Math.min(1, chargeRef.current + chargeRate * dt);
        } else {
          chargeRef.current = Math.max(0, chargeRef.current - decayRate * dt);
        }
        reportCharge(now, chargeRef.current);

        if (chargeRef.current >= 1 && !shatteredRef.current) {
          shatteredRef.current = true;
          shatterStartRef.current = now;
          setInternalPhase('shatter');
          onShatter?.();
          // Don't return - continue drawing this frame
        }
      }

      const charge = chargeRef.current;
      const runeAngle = t * 0.5;
      const energyAngle = t * 1.2;

      // ── Fog ──
      const fogOpacity = 0.3 + Math.sin(t * 0.25) * 0.1;
      ctx!.filter = 'blur(40px)';
      for (const fog of fogRef.current) {
        ctx!.globalAlpha = fogOpacity;
        ctx!.fillStyle = COLORS.fogColor;
        ctx!.beginPath();
        ctx!.arc(fog.x, fog.y, fog.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.filter = 'none';

      // ── Background aura ──
      const auraR = sealRadius * 1.6;
      const auraGrad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, auraR);
      auraGrad.addColorStop(0, COLORS.auraInner);
      auraGrad.addColorStop(1, 'transparent');
      ctx!.globalAlpha = 0.6;
      ctx!.fillStyle = auraGrad;
      ctx!.beginPath();
      ctx!.arc(cx, cy, auraR, 0, Math.PI * 2);
      ctx!.fill();

      // ── Seal pulse ring ──
      const pulseScale = 1 + Math.sin(t * 1.5) * 0.04;
      ctx!.globalAlpha = 0.3;
      ctx!.strokeStyle = COLORS.sealPulse;
      ctx!.lineWidth = 6;
      ctx!.filter = 'blur(8px)';
      ctx!.beginPath();
      ctx!.arc(cx, cy, sealRadius * 1.15 * pulseScale, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.filter = 'none';

      // ── Seal disc ──
      ctx!.globalAlpha = 1;
      const sealGrad = ctx!.createLinearGradient(
        cx - sealRadius,
        cy - sealRadius,
        cx + sealRadius,
        cy + sealRadius,
      );
      sealGrad.addColorStop(0, COLORS.waxLight);
      sealGrad.addColorStop(1, COLORS.waxDark);
      ctx!.fillStyle = sealGrad;
      ctx!.beginPath();
      ctx!.arc(cx, cy, sealRadius, 0, Math.PI * 2);
      ctx!.fill();

      // Seal rim
      ctx!.strokeStyle = COLORS.waxDark;
      ctx!.lineWidth = 4;
      ctx!.beginPath();
      ctx!.arc(cx, cy, sealRadius - 2, 0, Math.PI * 2);
      ctx!.stroke();

      // Inner rune circle
      ctx!.globalAlpha = 0.3;
      ctx!.strokeStyle = COLORS.rune;
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      ctx!.arc(cx, cy, sealRadius * 0.85, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.beginPath();
      ctx!.arc(cx, cy, sealRadius * 0.5, 0, Math.PI * 2);
      ctx!.stroke();

      // ── Wax drips ──
      ctx!.globalAlpha = 1;
      ctx!.fillStyle = COLORS.waxDrip;
      for (const drip of WAX_DRIPS) {
        const dx = cx + Math.cos(drip.angle) * sealRadius;
        const dy = cy + Math.sin(drip.angle) * sealRadius;
        ctx!.beginPath();
        ctx!.arc(dx, dy + drip.length * 0.5, 4, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(dx, dy + drip.length, 3, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(dx, dy + drip.length * 0.25, 3.5, 0, Math.PI * 2);
        ctx!.fill();
      }

      // ── Decorative cross ──
      ctx!.globalAlpha = 1;
      ctx!.strokeStyle = COLORS.rune;
      ctx!.lineWidth = 3;
      ctx!.beginPath();
      ctx!.moveTo(cx - sealRadius * 0.3, cy);
      ctx!.lineTo(cx + sealRadius * 0.3, cy);
      ctx!.stroke();
      ctx!.beginPath();
      ctx!.moveTo(cx, cy - sealRadius * 0.3);
      ctx!.lineTo(cx, cy + sealRadius * 0.3);
      ctx!.stroke();

      // ── Inner rune symbols ──
      ctx!.globalAlpha = 1;
      ctx!.font = '20px system-ui, sans-serif';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillStyle = COLORS.rune;
      ctx!.shadowColor = COLORS.runeGlow;
      ctx!.shadowBlur = 8;
      for (let i = 0; i < INNER_RUNES.length; i++) {
        const angle = ((Math.PI * 2) / INNER_RUNES.length) * i - Math.PI / 2;
        const r = sealRadius * 0.65;
        const rx = cx + Math.cos(angle) * r;
        const ry = cy + Math.sin(angle) * r;
        ctx!.fillText(INNER_RUNES[i]!, rx, ry);
      }
      ctx!.shadowBlur = 0;

      // ── Outer rune ring (rotating) ──
      ctx!.globalAlpha = 0.5;
      ctx!.font = '16px system-ui, sans-serif';
      ctx!.fillStyle = COLORS.rune;
      ctx!.shadowColor = COLORS.runeGlow;
      ctx!.shadowBlur = 6;
      const orbitR = sealRadius * 1.45;
      for (let i = 0; i < OUTER_RUNES.length; i++) {
        const angle = ((Math.PI * 2) / OUTER_RUNES.length) * i + runeAngle;
        const rx = cx + Math.cos(angle) * orbitR;
        const ry = cy + Math.sin(angle) * orbitR;
        ctx!.fillText(OUTER_RUNES[i]!, rx, ry);
      }
      ctx!.shadowBlur = 0;

      // ── Ancient text ring (counter-rotating) ──
      ctx!.globalAlpha = 0.4;
      ctx!.font = '12px system-ui, sans-serif';
      ctx!.fillStyle = COLORS.ancientText;
      const ancientR = sealRadius * 1.05;
      for (let i = 0; i < ANCIENT_SYMBOLS.length; i++) {
        const angle = ((Math.PI * 2) / ANCIENT_SYMBOLS.length) * i - runeAngle * 0.6;
        const ax = cx + Math.cos(angle) * ancientR;
        const ay = cy + Math.sin(angle) * ancientR;
        ctx!.fillText(ANCIENT_SYMBOLS[i]!, ax, ay);
      }

      // ── Chain symbols (rattle during charge) ──
      ctx!.globalAlpha = 0.6;
      ctx!.font = '20px system-ui, sans-serif';
      ctx!.fillStyle = COLORS.chainColor;
      const chainR = sealRadius * 1.7;
      for (const pos of CHAIN_POSITIONS) {
        const rattle = charge > 0 ? Math.sin(t * Math.PI * 6) * 3 * charge : 0;
        const chx = cx + Math.cos(pos.angle) * chainR;
        const chy = cy + Math.sin(pos.angle) * chainR + rattle;
        ctx!.fillText('⛓', chx, chy);
      }

      // ── Progress ring ──
      const ringR = sealRadius * 1.2;
      const segCount = 36;
      const segAngle = (Math.PI * 2) / segCount;
      const gap = 0.02;
      ctx!.lineCap = 'round';
      for (let i = 0; i < segCount; i++) {
        const startA = i * segAngle + gap - Math.PI / 2;
        const endA = (i + 1) * segAngle - gap - Math.PI / 2;
        const threshold = i / segCount;

        // Background segment
        ctx!.globalAlpha = 0.15;
        ctx!.strokeStyle = COLORS.progressRingBg;
        ctx!.lineWidth = 4;
        ctx!.beginPath();
        ctx!.arc(cx, cy, ringR, startA, endA);
        ctx!.stroke();

        // Active segment
        if (charge > threshold) {
          const intensity = Math.min(1, ((charge - threshold) / 0.05) * 0.5 + 0.5);
          ctx!.globalAlpha = intensity;
          ctx!.strokeStyle = COLORS.progressRing;
          ctx!.lineWidth = 4;
          ctx!.beginPath();
          ctx!.arc(cx, cy, ringR, startA, endA);
          ctx!.stroke();
        }
      }
      ctx!.lineCap = 'butt';

      // ── Energy beams (above 30% charge) ──
      if (charge > 0.3) {
        const beamOpacity = (charge - 0.3) / 0.7;
        ctx!.globalAlpha = beamOpacity * 0.5;
        ctx!.strokeStyle = COLORS.energyBeam;
        ctx!.lineWidth = 2;
        for (const angle of ENERGY_BEAM_ANGLES) {
          ctx!.beginPath();
          ctx!.moveTo(
            cx + Math.cos(angle) * sealRadius * 0.5,
            cy + Math.sin(angle) * sealRadius * 0.5,
          );
          ctx!.lineTo(
            cx + Math.cos(angle) * sealRadius * 1.8,
            cy + Math.sin(angle) * sealRadius * 1.8,
          );
          ctx!.stroke();
        }
      }

      // ── Crack lines ──
      if (charge > 0) {
        const cracks = cracksRef.current;
        for (const segments of cracks) {
          const drawCount = Math.ceil(segments.length * charge);
          // Glow layer
          ctx!.globalAlpha = 0.5 * charge;
          ctx!.strokeStyle = COLORS.crackGlow;
          ctx!.lineWidth = 6;
          ctx!.lineCap = 'round';
          ctx!.beginPath();
          ctx!.moveTo(segments[0]!.x, segments[0]!.y);
          for (let s = 1; s < drawCount && s < segments.length; s++) {
            ctx!.lineTo(segments[s]!.x, segments[s]!.y);
          }
          ctx!.stroke();

          // Main crack
          ctx!.globalAlpha = charge;
          ctx!.strokeStyle = COLORS.crack;
          ctx!.lineWidth = 2.5;
          ctx!.beginPath();
          ctx!.moveTo(segments[0]!.x, segments[0]!.y);
          for (let s = 1; s < drawCount && s < segments.length; s++) {
            ctx!.lineTo(segments[s]!.x, segments[s]!.y);
          }
          ctx!.stroke();
          ctx!.lineCap = 'butt';
        }
      }

      // ── Energy particles ──
      if (charge > 0.1) {
        ctx!.fillStyle = COLORS.energyParticle;
        for (const p of ENERGY_PARTICLES) {
          const angle = p.startAngle + energyAngle * p.speed;
          const dist =
            sealRadius * (1.4 + p.radiusOffset) - charge * sealRadius * (0.5 + p.radiusOffset);
          const px = cx + Math.cos(angle) * dist;
          const py = cy + Math.sin(angle) * dist;
          ctx!.globalAlpha = Math.min(0.9, charge * 1.5);
          ctx!.beginPath();
          ctx!.arc(px, py, 3, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      // ── Fire embers ──
      if (charge > 0) {
        const cycle = (t % 3) / 3;
        for (const ember of embersRef.current) {
          const ey = ember.startY - cycle * 180;
          const ex = ember.startX + Math.sin(cycle * Math.PI * 2) * ember.drift;
          let opacity: number;
          if (cycle < 0.2) opacity = cycle / 0.2;
          else if (cycle < 0.7) opacity = 0.8;
          else opacity = (1 - cycle) / 0.3;
          opacity *= charge;
          if (opacity > 0) {
            ctx!.globalAlpha = opacity;
            ctx!.fillStyle = COLORS.emberCore;
            ctx!.beginPath();
            ctx!.arc(ex, ey, ember.size, 0, Math.PI * 2);
            ctx!.fill();
            // Glow
            ctx!.filter = 'blur(4px)';
            ctx!.globalAlpha = opacity * 0.3;
            ctx!.beginPath();
            ctx!.arc(ex, ey, ember.size * 2, 0, Math.PI * 2);
            ctx!.fill();
            ctx!.filter = 'none';
          }
        }
      }

      // ── Shatter shards ──
      if (internalPhase === 'shatter') {
        const elapsed = now - shatterStartRef.current;
        const rawSp = Math.min(1, elapsed / shatterDuration);
        // Ease out cubic for natural deceleration
        const sp = 1 - Math.pow(1 - rawSp, 3);
        for (const shard of SHARDS) {
          const sx = cx + Math.cos(shard.angle) * shard.distance * sp - shard.size / 2;
          const sy = cy + Math.sin(shard.angle) * shard.distance * sp - shard.size / 2;
          let alpha: number;
          if (sp < 0.5) alpha = 1;
          else alpha = Math.max(0, 1 - (sp - 0.5) * 2);
          if (alpha > 0) {
            ctx!.globalAlpha = alpha;
            ctx!.fillStyle = shard.color;
            ctx!.fillRect(sx, sy, shard.size, shard.size);
          }
        }
      }

      ctx!.globalAlpha = 1;

      if (internalPhase !== 'hidden') {
        rafRef.current = requestAnimationFrame(draw);
      }
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [
    width,
    height,
    cx,
    cy,
    sealRadius,
    internalPhase,
    chargeRate,
    decayRate,
    shatterDuration,
    reportCharge,
    onShatter,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        display: 'block',
        pointerEvents: 'none',
        touchAction: 'none',
      }}
    />
  );
}
