/**
 * 解码战路由解析；导航宿主收到校验过的游戏参数。
 */

import { defineGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import {
  createStandardConfigRouteParser,
  createStandardGuideRouteParser,
  type StandardConfigRouteParams,
} from '@/features/navigation/model/standardRouteParsers';

export type DecryptoConfigRouteParams = StandardConfigRouteParams<'decrypto'>;

/** 只解析创建或活跃房间的设置编辑路由。 */
export const parseDecryptoConfigRouteParams = createStandardConfigRouteParser({
  gameType: 'decrypto',
  displayName: 'Decrypto',
});

const parseGuide = createStandardGuideRouteParser({
  gameType: 'decrypto',
  displayName: 'Decrypto',
});

export const decryptoGameNavigation = defineGameNavigation({
  gameType: 'decrypto',
  config: { kind: 'screen', parseParams: parseDecryptoConfigRouteParams },
  guide: { kind: 'screen', parseParams: parseGuide },
  notepad: { kind: 'unsupported' },
});
