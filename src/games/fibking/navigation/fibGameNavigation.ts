/** FibKing root-navigation definition and strict route parsers. */

import {
  defineGameNavigation,
  type UnsupportedGameNavigationRoute,
} from '@/features/navigation/model/GameNavigationContribution';
import {
  createStandardConfigRouteParser,
  createStandardGuideRouteParser,
} from '@/features/navigation/model/standardRouteParsers';

export const parseFibConfigRouteParams = createStandardConfigRouteParser({
  gameType: 'fibking',
  displayName: 'FibKing',
});

const parseFibGuideRouteParams = createStandardGuideRouteParser({
  gameType: 'fibking',
  displayName: 'FibKing',
});

const unsupportedRoute: UnsupportedGameNavigationRoute = { kind: 'unsupported' };

export const fibGameNavigation = defineGameNavigation({
  gameType: 'fibking',
  config: {
    kind: 'screen',
    parseParams: parseFibConfigRouteParams,
  },
  guide: {
    kind: 'screen',
    parseParams: parseFibGuideRouteParams,
  },
  notepad: unsupportedRoute,
});
