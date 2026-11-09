import { type CSSProperties, useEffect, useRef } from 'react';

import { Easing, withRepeat, withSequence, withTiming } from '@/scene/timeline';

import { useRevealFrame, useSharedValue, useViewportSize } from '../runtime';

const AMBIENT_PARTICLES = Array.from({ length: 12 }, (_, i) => {
  const r1 = ((i * 73 + 17) % 100) / 100;
  const r2 = ((i * 41 + 31) % 100) / 100;
  const r3 = ((i * 59 + 7) % 100) / 100;
  return {
    xRatio: r1,
    yRatio: r2,
    radius: 2 + r3 * 4,
    driftX: (r1 - 0.5) * 30,
    driftY: -15 - r2 * 25,
    phase: ((i * 83 + 11) % 628) / 100,
  };
});

const FILL_STYLE: CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };

interface AtmosphericBackgroundProps {
  readonly color: string;
  readonly animate: boolean;
}

/** A slow center glow and drifting motes behind an effect's cards. */
export function AtmosphericBackground({ color, animate }: AtmosphericBackgroundProps) {
  return animate ? <Atmosphere color={color} /> : null;
}

function Atmosphere({ color }: { readonly color: string }) {
  const { width, height } = useViewportSize();
  const cycle = useSharedValue(0);
  const glowPulse = useSharedValue(0);
  const glowRef = useRef<HTMLDivElement>(null);
  const particleRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    cycle.animate(withRepeat(withTiming(Math.PI * 2, { duration: 8000, easing: Easing.linear })));
    glowPulse.animate(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.quad) }),
        ),
      ),
    );
  }, [cycle, glowPulse]);

  useRevealFrame(() => {
    if (glowRef.current) glowRef.current.style.opacity = String(0.06 + glowPulse.get() * 0.04);
    const c = cycle.get();
    AMBIENT_PARTICLES.forEach((particle, index) => {
      const element = particleRefs.current[index];
      if (!element) return;
      const dx = particle.driftX * Math.sin(c + particle.phase);
      const dy = particle.driftY * Math.sin(c * 0.7 + particle.phase);
      element.style.transform = `translate(${dx}px, ${dy}px)`;
      element.style.opacity = String(0.15 + 0.15 * Math.sin(c * 1.3 + particle.phase));
    });
  });

  const glowRadius = width * 0.6;
  return (
    <div style={FILL_STYLE}>
      <div
        ref={glowRef}
        style={{
          position: 'absolute',
          left: width / 2 - glowRadius,
          top: height * 0.45 - glowRadius,
          width: glowRadius * 2,
          height: glowRadius * 2,
          borderRadius: '50%',
          backgroundColor: color,
          opacity: 0.06,
        }}
      />
      {AMBIENT_PARTICLES.map((particle, index) => (
        <div
          key={index}
          ref={(element) => {
            particleRefs.current[index] = element;
          }}
          style={{
            position: 'absolute',
            left: particle.xRatio * width - particle.radius,
            top: particle.yRatio * height - particle.radius,
            width: particle.radius * 2,
            height: particle.radius * 2,
            borderRadius: '50%',
            backgroundColor: color,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}
