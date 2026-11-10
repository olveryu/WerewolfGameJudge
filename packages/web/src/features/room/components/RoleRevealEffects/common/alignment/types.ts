import type { AlignmentTheme } from '../../themes';
import type { ViewRect } from '../useAnchorRect';

/** What every faction effect draws from: the card rect, its layer order and the faction palette. */
export interface AlignmentEffectProps {
  readonly rect: ViewRect;
  readonly zIndex: number;
  readonly theme: AlignmentTheme;
}
