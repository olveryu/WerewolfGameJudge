/**
 * AvalonGuideScreen — 阿瓦隆图鉴绑定层。
 *
 * 分段壳、角色段机器与详情 sheet 都是共享件（@/features/encyclopedia），
 * 与狼人杀共用同一份图鉴实现；本文件只注入阿瓦隆数据源与玩法段。
 * 路由 roleId 深链直达角色段并打开该角色详情（对齐狼人杀 guide 语义）。
 */
import { AVALON_ROLES } from '@game-judge/game-engine/games/avalon/public';
import { useParams, useSearchParams } from 'react-router';

import { EncyclopediaRolesContent } from '@/features/encyclopedia/EncyclopediaRolesContent';
import { EncyclopediaRolesHeaderActions } from '@/features/encyclopedia/EncyclopediaRolesHeaderActions';
import {
  type EncyclopediaSegment,
  EncyclopediaShell,
} from '@/features/encyclopedia/EncyclopediaShell';
import { useEncyclopediaRolesState } from '@/features/encyclopedia/useEncyclopediaRolesState';
import { parseAvalonGuideRouteParams } from '@/games/avalon/navigation/avalonGameNavigation';

import { AVALON_ENCYCLOPEDIA_SOURCE } from './avalonEncyclopediaSource';
import { AvalonGameplayContent } from './AvalonGameplayContent';

const GUIDE_SEGMENTS: readonly EncyclopediaSegment[] = [
  { key: 'gameplay', label: '玩法' },
  { key: 'roles', label: `角色 · ${AVALON_ROLES.length}` },
];

/** Path params come from the route; the deep-linked role comes from the search string. */
function useAvalonGuideRouteParams() {
  const pathParams = useParams();
  const [searchParams] = useSearchParams();
  const roleId = searchParams.get('roleId');
  return parseAvalonGuideRouteParams(roleId === null ? pathParams : { ...pathParams, roleId });
}

/** 阿瓦隆图鉴：玩法段 + 共享角色段。 */
export function AvalonGuideScreen() {
  const routeParams = useAvalonGuideRouteParams();
  const rolesState = useEncyclopediaRolesState(AVALON_ENCYCLOPEDIA_SOURCE, routeParams.roleId);

  const renderSegment = (segmentKey: string) => {
    if (segmentKey === 'roles') {
      return <EncyclopediaRolesContent source={AVALON_ENCYCLOPEDIA_SOURCE} state={rolesState} />;
    }
    return <AvalonGameplayContent />;
  };

  return (
    <EncyclopediaShell
      title="阿瓦隆玩法"
      testId="avalon-guide"
      parentPath={routeParams.roomCode === undefined ? '/' : `/room/${routeParams.roomCode}`}
      segments={GUIDE_SEGMENTS}
      initialTab={routeParams.roleId === undefined ? 'gameplay' : 'roles'}
      renderSegment={renderSegment}
      segmentHeaderActions={{
        roles: (
          <EncyclopediaRolesHeaderActions source={AVALON_ENCYCLOPEDIA_SOURCE} state={rolesState} />
        ),
      }}
    />
  );
}
