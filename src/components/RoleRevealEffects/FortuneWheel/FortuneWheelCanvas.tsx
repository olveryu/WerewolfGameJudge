'use dom';

/**
 * FortuneWheelCanvas — Canvas 2D 命运转盘 + 交互
 *
 * 绘制宝石色扇形转盘 + 金色外圈 + 指针 + 星空背景。
 * 自管理拖拽旋转 + 减速动画 + 宝石脉冲。
 * 不 import service，不含业务逻辑。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Constants ────────────────────────────────────────────────────────

const SEGMENT_FILLS = [
  '#4B3F9E',
  '#2E8B7A',
  '#C0392B',
  '#2471A3',
  '#7D3C98',
  '#D4AC0D',
  '#1E8449',
  '#BA4A00',
  '#5B4FBE',
  '#3CB371',
  '#E74C3C',
  '#3498DB',
];

const GEM_COLORS = ['#ff3366', '#33ccff', '#ffcc00', '#66ff66', '#cc66ff', '#ff6633'];

const GOLD = '#FFD700';
const GOLD_DARK = '#B8860B';
const SEGMENT_DIVIDER = 'rgba(255, 215, 0, 0.5)';
const CENTER_FILL = '#1a1a2e';
const POINTER_FILL = '#E74C3C';
const POINTER_STROKE = '#FFD700';

const RIM_RATIO = 0.04;
const DOT_R = 3;

// ─── Helpers ──────────────────────────────────────────────────────────

function createStars(w: number, h: number) {
  return Array.from({ length: 25 }, (_, i) => ({
    x: (((i * 73 + 17) % 100) / 100) * w,
    y: (((i * 41 + 31) % 100) / 100) * h,
    r: 0.5 + (((i * 59 + 7) % 100) / 100) * 1,
  }));
}

// ─── Component ────────────────────────────────────────────────────────

interface Segment {
  id: string;
  name: string;
}

interface FortuneWheelCanvasProps {
  dom?: import('expo/dom').DOMProps;
  width: number;
  height: number;
  segments: Segment[];
  targetIndex: number;
  phase: 'appear' | 'idle' | 'spinning' | 'stopped' | 'hidden';
  onSpinStart?: () => void;
  onSpinComplete?: () => void;
}

export default function FortuneWheelCanvas({
  width,
  height,
  segments,
  targetIndex,
  phase,
  onSpinStart,
  onSpinComplete,
}: FortuneWheelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const starsRef = useRef(createStars(width, height));
  const [internalPhase, setInternalPhase] = useState(phase);

  // Rotation state
  const rotationRef = useRef(0);
  const velocityRef = useRef(0);
  const targetRotationRef = useRef<number | null>(null);
  const spinStartTimeRef = useRef(0);
  const spinDurationRef = useRef(0);
  const spinStartRotRef = useRef(0);

  // Gesture state
  const dragRef = useRef({
    active: false,
    startAngle: 0,
    startRotation: 0,
    lastAngle: 0,
    lastTime: 0,
  });

  // Appear animation
  const scaleRef = useRef(0);
  const opacityRef = useRef(0);
  const appearStartRef = useRef(0);

  // Gem pulse
  const gemPhaseRef = useRef(0);

  // Pointer tick glow
  const pointerGlowRef = useRef(0);

  // Victory arch
  const victoryRef = useRef({ opacity: 0, scale: 0.8 });

  const cx = width / 2;
  const cy = height / 2;
  const wheelR = Math.min(width, height) * 0.38;
  const innerR = wheelR * (1 - RIM_RATIO);
  const centerR = wheelR * 0.18;
  const segmentCount = segments.length;
  const segmentAngle = (Math.PI * 2) / segmentCount;

  // Sync phase from parent
  useEffect(() => {
    if (phase === 'appear') {
      appearStartRef.current = performance.now();
      scaleRef.current = 0;
      opacityRef.current = 0;
    }
    setInternalPhase(phase);
  }, [phase]);

  // Compute target rotation for spin landing
  const computeTargetRotation = useCallback(
    (currentRotation: number) => {
      const targetMidOffset = targetIndex * segmentAngle + segmentAngle / 2;
      const extraSpins = 4 + Math.floor(Math.random() * 3);
      const baseTarget = Math.PI * 2 * extraSpins - targetMidOffset;
      const normalizedCurrent = currentRotation % (Math.PI * 2);
      const finalRotation = currentRotation - normalizedCurrent + baseTarget;
      const jitter = (Math.random() - 0.5) * segmentAngle * 0.3;
      return finalRotation + jitter;
    },
    [targetIndex, segmentAngle],
  );

  const startDeceleration = useCallback(() => {
    setInternalPhase('spinning');
    onSpinStart?.();
    const target = computeTargetRotation(rotationRef.current);
    targetRotationRef.current = target;
    spinStartTimeRef.current = performance.now();
    spinDurationRef.current = 2500 + Math.random() * 1000;
    spinStartRotRef.current = rotationRef.current;
    velocityRef.current = 0;
  }, [computeTargetRotation, onSpinStart]);

  // ── Touch handlers ──
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (internalPhase !== 'idle') return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const angle = Math.atan2(py - cy, px - cx);
      dragRef.current = {
        active: true,
        startAngle: angle,
        startRotation: rotationRef.current,
        lastAngle: angle,
        lastTime: performance.now(),
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [internalPhase, cx, cy],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!dragRef.current.active) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const angle = Math.atan2(py - cy, px - cx);
      const delta = angle - dragRef.current.startAngle;
      rotationRef.current = dragRef.current.startRotation + delta;
      dragRef.current.lastAngle = angle;
      dragRef.current.lastTime = performance.now();
    },
    [cx, cy],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      // Calculate angular velocity from last move
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const finalAngle = Math.atan2(py - cy, px - cx);
      const dt = performance.now() - dragRef.current.lastTime;
      if (dt > 0 && dt < 200) {
        const angularV = (finalAngle - dragRef.current.lastAngle) / (dt / 1000);
        if (Math.abs(angularV) > 1.5) {
          // Apply momentum then decelerate to target
          rotationRef.current += angularV * 0.05;
          startDeceleration();
        }
      }
    },
    [cx, cy, startDeceleration],
  );

  // ── Main draw loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    starsRef.current = createStars(width, height);

    function easeOutCubic(t: number) {
      return 1 - Math.pow(1 - t, 3);
    }

    function draw(now: number) {
      ctx!.clearRect(0, 0, width, height);

      // ── Appear animation ──
      if (internalPhase === 'appear') {
        const elapsed = now - appearStartRef.current;
        const duration = 800;
        const t = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        scaleRef.current = eased;
        opacityRef.current = Math.min(1, t * 2);
        if (t >= 1) {
          setInternalPhase('idle');
        }
      }

      // ── Spin deceleration ──
      if (internalPhase === 'spinning' && targetRotationRef.current !== null) {
        const elapsed = now - spinStartTimeRef.current;
        const t = Math.min(1, elapsed / spinDurationRef.current);
        const eased = easeOutCubic(t);
        rotationRef.current =
          spinStartRotRef.current + (targetRotationRef.current - spinStartRotRef.current) * eased;

        // Pointer tick glow
        pointerGlowRef.current = Math.abs(Math.sin(elapsed * 0.04)) * (1 - t);

        if (t >= 1) {
          targetRotationRef.current = null;
          setInternalPhase('stopped');
          onSpinComplete?.();
        }
      }

      // Gem pulse
      gemPhaseRef.current = (now / 3000) * Math.PI * 2;

      const scale = internalPhase === 'appear' ? scaleRef.current : 1;
      const opacity = internalPhase === 'appear' ? opacityRef.current : 1;
      if (internalPhase === 'hidden') {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // ── Starfield ──
      ctx!.globalAlpha = 0.6;
      for (const star of starsRef.current) {
        ctx!.fillStyle = '#ccccff';
        ctx!.globalAlpha = 0.8;
        ctx!.beginPath();
        ctx!.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx!.fill();
        // Glow
        ctx!.globalAlpha = 0.3;
        ctx!.filter = 'blur(4px)';
        ctx!.fillStyle = '#aaaaff';
        ctx!.beginPath();
        ctx!.arc(star.x, star.y, star.r * 4, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.filter = 'none';
      }
      ctx!.globalAlpha = opacity;

      // ── Draw wheel (apply scale + rotation) ──
      ctx!.save();
      ctx!.translate(cx, cy);
      ctx!.scale(scale, scale);
      ctx!.rotate(rotationRef.current);

      // Gold outer rim
      ctx!.beginPath();
      ctx!.arc(0, 0, wheelR, 0, Math.PI * 2);
      ctx!.fillStyle = GOLD_DARK;
      ctx!.fill();
      ctx!.strokeStyle = GOLD;
      ctx!.lineWidth = 3;
      ctx!.stroke();

      // Sector fills
      for (let i = 0; i < segmentCount; i++) {
        const startA = i * segmentAngle - Math.PI / 2;
        const endA = startA + segmentAngle;
        ctx!.beginPath();
        ctx!.moveTo(0, 0);
        ctx!.arc(0, 0, innerR, startA, endA);
        ctx!.closePath();
        ctx!.fillStyle = SEGMENT_FILLS[i % SEGMENT_FILLS.length]!;
        ctx!.fill();
      }

      // Divider lines + dots
      for (let i = 0; i < segmentCount; i++) {
        const angle = i * segmentAngle - Math.PI / 2;
        const edgeX = innerR * Math.cos(angle);
        const edgeY = innerR * Math.sin(angle);

        // Divider line
        ctx!.beginPath();
        ctx!.moveTo(0, 0);
        ctx!.lineTo(edgeX, edgeY);
        ctx!.strokeStyle = SEGMENT_DIVIDER;
        ctx!.lineWidth = 1.5;
        ctx!.stroke();

        // Rim dot
        const dotX = (wheelR - DOT_R * 2.5) * Math.cos(angle);
        const dotY = (wheelR - DOT_R * 2.5) * Math.sin(angle);
        ctx!.beginPath();
        ctx!.arc(dotX, dotY, DOT_R, 0, Math.PI * 2);
        ctx!.fillStyle = GOLD;
        ctx!.fill();
      }

      // Inner edge circle
      ctx!.beginPath();
      ctx!.arc(0, 0, innerR, 0, Math.PI * 2);
      ctx!.strokeStyle = GOLD_DARK;
      ctx!.lineWidth = 1.5;
      ctx!.stroke();

      // Gem bulbs (pulsing)
      for (let i = 0; i < segmentCount; i++) {
        const angle = i * segmentAngle - Math.PI / 2;
        const dotX = (wheelR - DOT_R * 2.5) * Math.cos(angle);
        const dotY = (wheelR - DOT_R * 2.5) * Math.sin(angle);
        const gemAlpha = 0.5 + Math.sin(gemPhaseRef.current + (i * Math.PI) / 3) * 0.3;
        ctx!.globalAlpha = gemAlpha * opacity;
        ctx!.filter = 'blur(3px)';
        ctx!.fillStyle = GEM_COLORS[i % GEM_COLORS.length]!;
        ctx!.beginPath();
        ctx!.arc(dotX, dotY, DOT_R + 2, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.filter = 'none';
      }
      ctx!.globalAlpha = opacity;

      // Segment labels (text)
      ctx!.font = '800 15px system-ui, sans-serif';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillStyle = '#FFFFFF';
      ctx!.shadowColor = 'rgba(0,0,0,0.8)';
      ctx!.shadowBlur = 3;
      ctx!.shadowOffsetY = 1;
      for (let i = 0; i < segmentCount; i++) {
        const startA = i * segmentAngle - Math.PI / 2;
        const midAngle = startA + segmentAngle / 2;
        const dist = wheelR * 0.62;
        const lx = dist * Math.cos(midAngle);
        const ly = dist * Math.sin(midAngle);
        const label =
          segments[i]!.name.length > 4 ? segments[i]!.name.slice(0, 4) : segments[i]!.name;

        ctx!.save();
        ctx!.translate(lx, ly);
        // Make label readable (not upside down)
        const labelAngle = midAngle + Math.PI / 2;
        const normalizedDeg = ((((labelAngle * 180) / Math.PI) % 360) + 360) % 360;
        const flipLabel = normalizedDeg > 90 && normalizedDeg < 270;
        ctx!.rotate(flipLabel ? labelAngle + Math.PI : labelAngle);
        ctx!.fillText(label, 0, 0);
        ctx!.restore();
      }
      ctx!.shadowColor = 'transparent';
      ctx!.shadowBlur = 0;
      ctx!.shadowOffsetY = 0;

      ctx!.restore(); // End wheel rotation transform

      // ── Static elements (center hub, pointer) ──
      ctx!.save();
      ctx!.translate(cx, cy);
      ctx!.scale(scale, scale);

      // Center hub
      ctx!.beginPath();
      ctx!.arc(0, 0, centerR, 0, Math.PI * 2);
      ctx!.fillStyle = CENTER_FILL;
      ctx!.fill();
      ctx!.strokeStyle = GOLD;
      ctx!.lineWidth = 3;
      ctx!.stroke();

      // Inner ring
      ctx!.beginPath();
      ctx!.arc(0, 0, centerR * 0.7, 0, Math.PI * 2);
      ctx!.strokeStyle = GOLD_DARK;
      ctx!.lineWidth = 1;
      ctx!.stroke();

      // Center gem (radial gradient)
      const gemGrad = ctx!.createRadialGradient(-2, -2, 0, 0, 0, centerR * 0.35);
      gemGrad.addColorStop(0, '#ff6666');
      gemGrad.addColorStop(0.5, '#cc0033');
      gemGrad.addColorStop(1, '#660019');
      ctx!.beginPath();
      ctx!.arc(0, 0, centerR * 0.35, 0, Math.PI * 2);
      ctx!.fillStyle = gemGrad;
      ctx!.fill();

      // Highlight dot
      ctx!.globalAlpha = 0.4 * opacity;
      ctx!.filter = 'blur(1px)';
      ctx!.fillStyle = '#ffffff';
      ctx!.beginPath();
      ctx!.arc(-3, -3, 3, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.filter = 'none';
      ctx!.globalAlpha = opacity;

      // "?" text
      ctx!.font = '900 22px system-ui, sans-serif';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillStyle = GOLD;
      ctx!.shadowColor = 'rgba(0,0,0,0.5)';
      ctx!.shadowBlur = 2;
      ctx!.fillText('?', 0, 0);
      ctx!.shadowColor = 'transparent';
      ctx!.shadowBlur = 0;

      ctx!.restore();

      // ── Pointer (top, doesn't rotate) ──
      ctx!.save();
      ctx!.translate(cx, cy);
      ctx!.scale(scale, scale);

      const pointerTipY = -wheelR - 20 + 26;
      const pointerTopY = -wheelR - 20;
      const halfW = 26 * 0.55;

      ctx!.beginPath();
      ctx!.moveTo(0, pointerTipY);
      ctx!.lineTo(-halfW, pointerTopY);
      ctx!.lineTo(halfW, pointerTopY);
      ctx!.closePath();
      ctx!.fillStyle = POINTER_FILL;
      ctx!.fill();
      ctx!.strokeStyle = POINTER_STROKE;
      ctx!.lineWidth = 2;
      ctx!.stroke();

      // Pointer tick glow
      if (pointerGlowRef.current > 0.01) {
        ctx!.globalAlpha = pointerGlowRef.current * 0.6;
        ctx!.filter = 'blur(4px)';
        const glowGrad = ctx!.createRadialGradient(0, pointerTipY, 0, 0, pointerTipY, 8);
        glowGrad.addColorStop(0, '#ff666680');
        glowGrad.addColorStop(1, '#ff660000');
        ctx!.fillStyle = glowGrad;
        ctx!.beginPath();
        ctx!.arc(0, pointerTipY, 8, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.filter = 'none';
        ctx!.globalAlpha = opacity;
      }

      ctx!.restore();

      // ── Victory arch (after stopped) ──
      if (internalPhase === 'stopped') {
        const v = victoryRef.current;
        const elapsed = now - spinStartTimeRef.current - spinDurationRef.current;
        if (elapsed > 400) {
          v.opacity = Math.min(0.8, ((elapsed - 400) / 500) * 0.8);
          v.scale = 0.8 + Math.min(0.2, ((elapsed - 400) / 600) * 0.2);
        }
        if (v.opacity > 0.01) {
          ctx!.save();
          ctx!.translate(cx, cy);
          ctx!.scale(v.scale, v.scale);
          ctx!.globalAlpha = v.opacity;

          // Radial glow ring
          const archR = wheelR * 0.7;
          const archGrad = ctx!.createRadialGradient(0, 0, archR * 0.6, 0, 0, archR);
          archGrad.addColorStop(0, '#FFD70000');
          archGrad.addColorStop(0.5, '#FFD70030');
          archGrad.addColorStop(1, '#FFD70000');
          ctx!.fillStyle = archGrad;
          ctx!.beginPath();
          ctx!.arc(0, 0, archR, 0, Math.PI * 2);
          ctx!.fill();

          // Ray lines
          ctx!.filter = 'blur(3px)';
          ctx!.strokeStyle = GOLD;
          ctx!.lineWidth = 2;
          for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            const ir = wheelR * 0.45;
            const or = wheelR * 0.65;
            ctx!.beginPath();
            ctx!.moveTo(Math.cos(angle) * ir, Math.sin(angle) * ir);
            ctx!.lineTo(Math.cos(angle) * or, Math.sin(angle) * or);
            ctx!.stroke();
          }
          ctx!.filter = 'none';
          ctx!.restore();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [
    width,
    height,
    cx,
    cy,
    wheelR,
    innerR,
    centerR,
    segmentCount,
    segmentAngle,
    segments,
    internalPhase,
    onSpinComplete,
  ]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        width,
        height,
        display: 'block',
        touchAction: 'none',
        pointerEvents: internalPhase === 'idle' || internalPhase === 'appear' ? 'auto' : 'none',
      }}
    />
  );
}
