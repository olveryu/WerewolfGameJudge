/** Pictionary-owned root route extensions. */

import type { StandardConfigRouteParams } from '@/features/navigation/model/standardRouteParsers';

export type PictionaryConfigRouteParams = StandardConfigRouteParams<'pictionary'>;

export interface PictionaryGuideRouteParams {
  readonly gameType: 'pictionary';
  readonly roomCode?: string;
}
