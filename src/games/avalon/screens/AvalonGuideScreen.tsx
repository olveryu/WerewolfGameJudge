/**
 * AvalonGuideScreen — 阿瓦隆图鉴绑定层。
 *
 * 分段壳、角色段机器与详情 sheet 都是共享件（@/features/encyclopedia），
 * 与狼人杀共用同一份图鉴实现；本文件只注入阿瓦隆数据源与玩法段。
 * 路由 roleId 深链直达角色段并打开该角色详情（对齐狼人杀 guide 语义）。
 */
import { AVALON_ROLES } from '@game-judge/game-engine/games/avalon/public';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { useCallback } from 'react';

import { EncyclopediaRolesContent } from '@/features/encyclopedia/EncyclopediaRolesContent';
import { EncyclopediaRolesHeaderActions } from '@/features/encyclopedia/EncyclopediaRolesHeaderActions';
import {
  type EncyclopediaSegment,
  EncyclopediaShell,
} from '@/features/encyclopedia/EncyclopediaShell';
import { useEncyclopediaRolesState } from '@/features/encyclopedia/useEncyclopediaRolesState';
import { parseAvalonGuideRouteParams } from '@/games/avalon/navigation/avalonGameNavigation';
import type { RootStackParamList } from '@/navigation/types';

import { AVALON_ENCYCLOPEDIA_SOURCE } from './avalonEncyclopediaSource';
import { AvalonGameplayContent } from './AvalonGameplayContent';

const GUIDE_SEGMENTS: readonly EncyclopediaSegment[] = [
  { key: 'gameplay', label: '玩法' },
  { key: 'roles', label: `角色 · ${AVALON_ROLES.length}` },
];

export const AvalonGuideScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GameGuide'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GameGuide'>>();
  const routeParams = parseAvalonGuideRouteParams(route.params);
  const rolesState = useEncyclopediaRolesState(AVALON_ENCYCLOPEDIA_SOURCE, routeParams.roleId);

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [navigation]);

  const renderSegment = useCallback(
    (segmentKey: string) => {
      if (segmentKey === 'roles') {
        return <EncyclopediaRolesContent source={AVALON_ENCYCLOPEDIA_SOURCE} state={rolesState} />;
      }
      return <AvalonGameplayContent />;
    },
    [rolesState],
  );

  return (
    <EncyclopediaShell
      title="阿瓦隆玩法"
      testID="avalon-guide"
      onBack={handleGoBack}
      segments={GUIDE_SEGMENTS}
      initialTab={routeParams.roleId ? 'roles' : 'gameplay'}
      renderSegment={renderSegment}
      segmentHeaderActions={{
        roles: (
          <EncyclopediaRolesHeaderActions source={AVALON_ENCYCLOPEDIA_SOURCE} state={rolesState} />
        ),
      }}
    />
  );
};
