/**
 * EncyclopediaScreen — the werewolf guide over the shared encyclopedia: engine-spec role source,
 * the gameplay segment (reads this room's public config), and the boards segment with its
 * header search and tag filter actions.
 */
import {
  type GameState,
  getAllRoleIds,
  PRESET_TEMPLATES,
} from '@game-judge/game-engine/games/werewolf/public';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';

import { IconButton } from '@/components/IconButton';
import type { EncyclopediaRoleDetailExtra } from '@/features/encyclopedia/EncyclopediaRoleDetailSheet';
import { EncyclopediaRolesContent } from '@/features/encyclopedia/EncyclopediaRolesContent';
import { EncyclopediaRolesHeaderActions } from '@/features/encyclopedia/EncyclopediaRolesHeaderActions';
import {
  type EncyclopediaSegment,
  EncyclopediaShell,
} from '@/features/encyclopedia/EncyclopediaShell';
import { useEncyclopediaRolesState } from '@/features/encyclopedia/useEncyclopediaRolesState';
import { useRoomLinkSnapshot } from '@/features/room/controllers/useRoomLinkSnapshot';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import { parseWerewolfGuideRouteParams } from '@/games/werewolf/navigation/werewolfGameNavigation';
import { TESTIDS } from '@/testids';
import IconClose from '~icons/ion/close';
import IconFilter from '~icons/ion/filter';
import IconSearch from '~icons/ion/search';

import { BoardsGuideContent } from './BoardsGuideContent';
import { WEREWOLF_ENCYCLOPEDIA_SOURCE } from './werewolfEncyclopediaSource';
import { WerewolfGameplayContent } from './WerewolfGameplayContent';
import { WerewolfRoleDetailExtra } from './WerewolfRoleDetailExtra';

const renderRoleDetailExtra: EncyclopediaRoleDetailExtra = (entry, onClose) => (
  <WerewolfRoleDetailExtra entry={entry} onClose={onClose} />
);

const GUIDE_SEGMENTS: readonly EncyclopediaSegment[] = [
  { key: 'gameplay', label: '玩法' },
  { key: 'roles', label: `角色 · ${getAllRoleIds().length}` },
  { key: 'boards', label: `板子 · ${PRESET_TEMPLATES.length}` },
];

/** The guide's own search params; path params come from the route. */
const GUIDE_SEARCH_KEYS = ['roleId', 'initialTab'] as const;

function useWerewolfGuideRouteParams() {
  const pathParams = useParams();
  const [searchParams] = useSearchParams();
  const searchFields: Record<string, string> = {};
  for (const key of GUIDE_SEARCH_KEYS) {
    const value = searchParams.get(key);
    if (value !== null) searchFields[key] = value;
  }
  return parseWerewolfGuideRouteParams({ ...pathParams, ...searchFields });
}

/** Role encyclopedia / board guide screen. */
export function EncyclopediaScreen({ session }: { readonly session: WerewolfRoomSession }) {
  const routeParams = useWerewolfGuideRouteParams();
  const room = useRoomLinkSnapshot(session);
  const gameState: GameState | null =
    room.phase === 'ready' && room.identity.room.roomCode === routeParams.roomCode
      ? room.room.state
      : null;
  const isHost =
    room.phase === 'ready' && gameState !== null && gameState.hostUserId === room.identity.userId;
  const initialTab =
    routeParams.initialTab ?? (routeParams.roleId === undefined ? 'gameplay' : 'roles');

  const rolesState = useEncyclopediaRolesState(WEREWOLF_ENCYCLOPEDIA_SOURCE, routeParams.roleId);

  // Lifted so the boards segment's header actions can drive its search and tag filter.
  const [boardsSearchVisible, setBoardsSearchVisible] = useState(false);
  const [boardsSearchQuery, setBoardsSearchQuery] = useState('');
  const [boardsTagFilterVisible, setBoardsTagFilterVisible] = useState(false);
  const [boardsTagFilter, setBoardsTagFilter] = useState<string | null>(null);

  const toggleBoardsSearch = () => {
    if (boardsSearchVisible) setBoardsSearchQuery('');
    setBoardsSearchVisible(!boardsSearchVisible);
  };

  const boardsHeaderActions = (
    <>
      <IconButton
        label="标签筛选"
        icon={<IconFilter aria-hidden />}
        className="encyclopedia-header-button"
        data-active={boardsTagFilter !== null}
        onClick={() => setBoardsTagFilterVisible(true)}
      />
      <IconButton
        label="搜索板子"
        icon={boardsSearchVisible ? <IconClose aria-hidden /> : <IconSearch aria-hidden />}
        className="encyclopedia-header-button"
        onClick={toggleBoardsSearch}
      />
    </>
  );

  const renderSegment = (segmentKey: string) => {
    if (segmentKey === 'roles') {
      return (
        <EncyclopediaRolesContent
          source={WEREWOLF_ENCYCLOPEDIA_SOURCE}
          state={rolesState}
          roleDetailHeaderExtra={renderRoleDetailExtra}
        />
      );
    }
    if (segmentKey === 'boards') {
      return (
        <BoardsGuideContent
          searchVisible={boardsSearchVisible}
          searchQuery={boardsSearchQuery}
          setSearchQuery={setBoardsSearchQuery}
          tagFilter={boardsTagFilter}
          setTagFilter={setBoardsTagFilter}
          tagFilterDropdownVisible={boardsTagFilterVisible}
          setTagFilterDropdownVisible={setBoardsTagFilterVisible}
        />
      );
    }
    return (
      <WerewolfGameplayContent
        gameState={gameState}
        isHost={isHost}
        hasRoomContext={routeParams.roomCode !== undefined}
      />
    );
  };

  return (
    <EncyclopediaShell
      title="狼人杀玩法"
      testId={TESTIDS.encyclopediaScreenRoot}
      parentPath={routeParams.roomCode === undefined ? '/' : `/room/${routeParams.roomCode}`}
      segments={GUIDE_SEGMENTS}
      initialTab={initialTab}
      renderSegment={renderSegment}
      segmentHeaderActions={{
        roles: (
          <EncyclopediaRolesHeaderActions
            source={WEREWOLF_ENCYCLOPEDIA_SOURCE}
            state={rolesState}
          />
        ),
        boards: boardsHeaderActions,
      }}
    />
  );
}
