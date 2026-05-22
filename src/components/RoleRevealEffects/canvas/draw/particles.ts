/**
 * particles — Canvas 2D 粒子系统绘制工具
 *
 * 提供粒子批量绘制、径向爆发粒子、萤火虫等通用粒子效果。
 * 纯 Web Canvas 2D API，不依赖 React Native。
 */

export interface Particle {
  x: number;
  y: number;
  r: number;
  color: string;
  opacity: number;
}

/** Draw a batch of filled circles as particles */
export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    if (p.opacity <= 0) continue;
    ctx.globalAlpha = p.opacity;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Draw particles with a soft glow (blur filter) */
export function drawGlowParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  blurRadius: number,
): void {
  const prevFilter = ctx.filter;
  ctx.filter = `blur(${blurRadius}px)`;
  drawParticles(ctx, particles);
  ctx.filter = prevFilter;
}

/** Draw a radial burst of particles from a center point */
export function drawRadialBurst(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  particles: ReadonlyArray<{ angle: number; dist: number; size: number; color?: string }>,
  progress: number,
  color: string,
  opacity: number,
): void {
  if (opacity <= 0) return;
  ctx.globalAlpha = opacity;
  for (const p of particles) {
    const x = cx + Math.cos(p.angle) * p.dist * progress;
    const y = cy + Math.sin(p.angle) * p.dist * progress;
    ctx.beginPath();
    ctx.arc(x, y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = p.color ?? color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export interface FireflyState {
  cx: number;
  cy: number;
  radius: number;
  color: string;
  driftRadius: number;
  driftPhase: number;
  baseOpacity: number;
}

/** Draw animated fireflies based on elapsed time */
export function drawFireflies(
  ctx: CanvasRenderingContext2D,
  fireflies: FireflyState[],
  elapsed: number,
  masterOpacity: number,
  blurRadius: number,
): void {
  if (masterOpacity <= 0) return;
  const prevFilter = ctx.filter;
  ctx.filter = `blur(${blurRadius}px)`;
  for (const f of fireflies) {
    const phase = (elapsed / 3000) * Math.PI * 2 + f.driftPhase;
    const x = f.cx + Math.cos(phase) * f.driftRadius;
    const y = f.cy + Math.sin(phase) * f.driftRadius;
    const flicker = 0.5 + Math.sin((elapsed / 500) * Math.PI * 2 + f.driftPhase) * 0.5;
    const opacity = masterOpacity * flicker * f.baseOpacity;
    if (opacity <= 0.01) continue;
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.arc(x, y, f.radius * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = f.color;
    ctx.fill();
    // Core dot
    ctx.beginPath();
    ctx.arc(x, y, f.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.filter = prevFilter;
}
