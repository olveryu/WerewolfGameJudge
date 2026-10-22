/** Pictionary root-navigation definition and strict route parsers. */

import {
  defineGameNavigation,
  type UnsupportedGameNavigationRoute,
} from '@/features/navigation/model/GameNavigationContribution';
import {
  createStandardConfigRouteParser,
  createStandardGuideRouteParser,
} from '@/features/navigation/model/standardRouteParsers';

export const parsePictionaryConfigRouteParams = createStandardConfigRouteParser({
  gameType: 'pictionary',
  displayName: 'Pictionary',
});

const parsePictionaryGuideRouteParams = createStandardGuideRouteParser({
  gameType: 'pictionary',
  displayName: 'Pictionary',
});

const unsupportedRoute: UnsupportedGameNavigationRoute = { kind: 'unsupported' };

export const pictionaryGameNavigation = defineGameNavigation({
  gameType: 'pictionary',
  config: { kind: 'screen', parseParams: parsePictionaryConfigRouteParams },
  guide: { kind: 'screen', parseParams: parsePictionaryGuideRouteParams },
  notepad: unsupportedRoute,
});
