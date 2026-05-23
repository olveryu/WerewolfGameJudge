/** Draw function signature for all seat animation overlay effects */
export type OverlayDrawFn = (
  ctx: CanvasRenderingContext2D,
  /** Progress 0→1 (eased) */
  progress: number,
  /** Canvas size (px) */
  size: number,
  /** Primary color (rgb string) */
  color: string,
  /** Secondary/accent color (rgb string) */
  accentColor: string,
  /** Extra config (parsed from JSON props) */
  params: Record<string, unknown>,
) => void;
