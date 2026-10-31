/** Props for all seat pet animation components */
export interface PetProps {
  /** Pet display size (px) — typically ~tileSize * 0.32 */
  size: number;
}

/** Pets are authored in a 72 × 72 viewBox. */
export const PET_VIEWBOX = 72;

/** Converts a pet viewBox coordinate to px for a pet rendered at `size`. */
export function petUnitsToPx(units: number, size: number): number {
  return (units * size) / PET_VIEWBOX;
}
