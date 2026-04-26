/** Props shared by all seat entrance animation components */
export interface SeatAnimationProps {
  /** Tile inner size (px) — matches SeatTile playerTile width/height */
  size: number;
  /** Border radius of the tile (matches SeatTile playerTile) */
  borderRadius: number;
  /** Called once when the entrance animation completes. SeatTile uses this to exit animation mode. */
  onComplete: () => void;
  /** Avatar/frame/badge content to wrap. The animation reveals these children. */
  children: React.ReactNode;
}
