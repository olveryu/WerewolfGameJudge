/** FibKing-owned root route extensions. */

import type { StandardConfigRouteParams } from '@/features/navigation/model/standardRouteParsers';

export type FibConfigRouteParams = StandardConfigRouteParams<'fibking'>;

export interface FibGuideRouteParams {
  readonly gameType: 'fibking';
  readonly roomCode?: string;
}
