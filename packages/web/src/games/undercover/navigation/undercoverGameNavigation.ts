/** Strict Undercover-owned route parsers; shared navigation hosts consume this definition. */
import { defineGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import {
  createStandardConfigRouteParser,
  createStandardGuideRouteParser,
  type StandardConfigRouteParams,
} from '@/features/navigation/model/standardRouteParsers';

export type UndercoverConfigRouteParams = StandardConfigRouteParams<'undercover'>;

export const parseUndercoverConfigRouteParams = createStandardConfigRouteParser({
  gameType: 'undercover',
  displayName: 'Undercover',
});

const parseUndercoverGuideRouteParams = createStandardGuideRouteParser({
  gameType: 'undercover',
  displayName: 'Undercover',
});

export const undercoverGameNavigation = defineGameNavigation({
  gameType: 'undercover',
  config: { kind: 'screen', parseParams: parseUndercoverConfigRouteParams },
  guide: { kind: 'screen', parseParams: parseUndercoverGuideRouteParams },
  notepad: { kind: 'unsupported' },
});
