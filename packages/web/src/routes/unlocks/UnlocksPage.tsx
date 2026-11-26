import './UnlocksPage.css';

import { useQuery } from '@tanstack/react-query';
import { type RefObject, Suspense, use, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';

import { Avatar } from '@/components/avatar/Avatar';
import { AVATAR_CONCENTRIC_CLASS } from '@/components/avatar/avatarConcentric';
import { makeBuiltinAvatarUrl } from '@/components/avatar/avatarSources';
import { Button } from '@/components/Button';
import { IonIcon, type IoniconName } from '@/components/icons/IonIcon';
import { NameStyleText } from '@/components/nameStyles/NameStyleText';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Spinner } from '@/components/Spinner';
import { getRarityCellStyle } from '@/config/rarityVisual';
import { useAuthContext } from '@/contexts/AuthContext';
import { userUnlocksOptions } from '@/features/account/queries/accountQueryOptions';
import { useUserStatsQuery } from '@/features/account/queries/useUserStatsQuery';
import {
  type CosmeticTab,
  CosmeticTabBar,
  cosmeticTabId,
  type RarityFilter,
  RarityFilterBar,
} from '@/features/product/components/CosmeticTabs';
import { RarityCellBg } from '@/features/product/components/RarityCellBg';
import {
  ResidentAvatarTile,
  ResidentSceneLayer,
} from '@/features/product/components/ResidentPreview';
import { loadClientProductUi } from '@/features/product/loadClientProductUi';
import type { ClientProductUi } from '@/features/product/model/ClientProductUi';
import { roomPath } from '@/features/room/navigation/roomFlowNavigation';
import {
  type ResidentDecorations,
  resolveResidentDecorations,
  wearsFrame,
} from '@/scene/residentDecorations';
import { TESTIDS } from '@/testids';
import IconCheckmark from '~icons/ion/checkmark';
import IconLockClosed from '~icons/ion/lock-closed';

import {
  buildUnlockedSet,
  buildUnlockItems,
  filterUnlockItems,
  summarizeProgress,
  type UnlockItem,
} from './unlockItems';

const TAB_ID_PREFIX = 'unlocks';
const PANEL_ID = 'unlocks-panel';
/** The previous client dimmed a locked cell to 0.5 and its thumbnail to 0.4 within it. */
const LOCKED_THUMB_OPACITY = 0.2;
/** Built-in previews wear the wolf-paw default, keyed like the previous client. */
const PREVIEW_USER_ID = 'preview';

interface ThumbProps {
  readonly item: UnlockItem;
  readonly tab: CosmeticTab;
  readonly productUi: ClientProductUi;
  readonly sceneHostRef: RefObject<HTMLDivElement | null>;
  readonly scrollRootRef: RefObject<HTMLElement | null>;
}

function residentsOf(tab: CosmeticTab, id: string): ResidentDecorations | null {
  switch (tab) {
    case 'frame':
      return resolveResidentDecorations({ avatarFrame: id });
    case 'flair':
      return resolveResidentDecorations({ seatFlair: id });
    case 'seatAnimation':
      return resolveResidentDecorations({ seatAnimation: id });
    default:
      return null;
  }
}

/** What a cell previews: an avatar, a resident tile (an avatar wearing the item), or neither. */
type ThumbContent =
  | { readonly kind: 'avatar' }
  | { readonly kind: 'tile'; readonly residents: ResidentDecorations | null }
  | { readonly kind: 'text' }
  | { readonly kind: 'icon'; readonly icon: IoniconName };

function thumbContentOf(
  item: UnlockItem,
  tab: CosmeticTab,
  productUi: ClientProductUi,
): ThumbContent {
  switch (tab) {
    case 'avatar':
      return { kind: 'avatar' };
    case 'nameStyle':
      return { kind: 'text' };
    case 'effect': {
      const presentation = productUi.getRevealEffectPresentation(item.id);
      return presentation.petName !== null
        ? { kind: 'tile', residents: resolveResidentDecorations({ seatPetId: item.id }) }
        : { kind: 'icon', icon: presentation.icon };
    }
    case 'frame':
    case 'flair':
    case 'seatAnimation':
      return { kind: 'tile', residents: residentsOf(tab, item.id) };
  }
}

function UnlockThumb({
  item,
  content,
  sceneHostRef,
  scrollRootRef,
}: ThumbProps & { readonly content: ThumbContent }) {
  const thumbOpacity = item.unlocked ? 1 : LOCKED_THUMB_OPACITY;
  switch (content.kind) {
    case 'avatar':
      return (
        <span className="unlocks-thumb" style={{ opacity: thumbOpacity }}>
          <Avatar userId={item.id} avatarUrl={makeBuiltinAvatarUrl(item.id)} size="fill" />
        </span>
      );
    case 'text':
      return (
        <span className="unlocks-thumb unlocks-thumb-text" style={{ opacity: thumbOpacity }}>
          <NameStyleText styleId={item.id}>{item.displayName}</NameStyleText>
        </span>
      );
    case 'icon':
      return (
        <span className="unlocks-thumb unlocks-thumb-icon" data-locked={!item.unlocked}>
          <IonIcon name={content.icon} />
        </span>
      );
    case 'tile':
      return (
        <ResidentAvatarTile
          userId={PREVIEW_USER_ID}
          avatarUrl={null}
          residents={content.residents}
          sceneHostRef={sceneHostRef}
          scrollRootRef={scrollRootRef}
          opacity={thumbOpacity}
        />
      );
  }
}

/** A cell previewing an avatar (bare or in a tile): its corners are concentric with it. */
const AVATAR_CELL_FRAME_CLASS = `unlocks-cell-frame ${AVATAR_CONCENTRIC_CLASS}`;

function UnlockCell(props: ThumbProps) {
  const { item, tab, productUi } = props;
  const content = thumbContentOf(item, tab, productUi);
  const holdsAvatar = content.kind === 'avatar' || content.kind === 'tile';
  return (
    <li className="unlocks-cell" aria-label={item.unlocked ? item.displayName : '未解锁'}>
      <span
        className={holdsAvatar ? AVATAR_CELL_FRAME_CLASS : 'unlocks-cell-frame'}
        data-tile-border={content.kind === 'tile' && !wearsFrame(content.residents)}
        data-locked={!item.unlocked}
        style={item.unlocked ? getRarityCellStyle(item.rarity) : undefined}
      >
        {item.unlocked && <RarityCellBg rarity={item.rarity} />}
        <UnlockThumb {...props} content={content} />
        <span className="unlocks-cell-badge" data-locked={!item.unlocked} aria-hidden>
          {item.unlocked ? <IconCheckmark /> : <IconLockClosed />}
        </span>
      </span>
      <span className="unlocks-cell-name" data-locked={!item.unlocked} aria-hidden>
        {tab === 'nameStyle' && item.unlocked ? (
          <NameStyleText styleId={item.id}>{item.displayName}</NameStyleText>
        ) : item.unlocked ? (
          item.displayName
        ) : (
          '???'
        )}
      </span>
    </li>
  );
}

function SummaryCard({
  items,
  isViewer,
}: {
  readonly items: readonly UnlockItem[];
  readonly isViewer: boolean;
}) {
  const { unlockedCount, totalCount, percent } = summarizeProgress(items);
  return (
    <section className="unlocks-summary" aria-label={isViewer ? 'TA的收藏' : '收藏进度'}>
      <div className="unlocks-summary-ring">
        <span>
          <span className="unlocks-summary-count">{unlockedCount}</span>
          <span className="unlocks-summary-total">/{totalCount}</span>
        </span>
      </div>
      <div className="unlocks-summary-body">
        <h2 className="unlocks-summary-title">{isViewer ? 'TA的收藏' : '收藏进度'}</h2>
        <div
          className="unlocks-summary-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="收集进度"
        >
          <span className="unlocks-summary-fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="unlocks-summary-subtitle">
          {isViewer ? `已收集 ${percent}%` : `已收集 ${percent}%，继续游玩解锁更多`}
        </p>
      </div>
    </section>
  );
}

interface UnlocksContentProps {
  readonly unlockedItems: readonly string[];
  readonly isViewer: boolean;
}

function UnlocksContent({ unlockedItems, isViewer }: UnlocksContentProps) {
  const productUi = use(loadClientProductUi());
  const [activeTab, setActiveTab] = useState<CosmeticTab>('avatar');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const sceneHostRef = useRef<HTMLDivElement>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const items = buildUnlockItems(activeTab, buildUnlockedSet(unlockedItems), productUi);

  const changeTab = (tab: CosmeticTab) => {
    setActiveTab(tab);
    setRarityFilter('all');
  };

  return (
    <div className="unlocks-body">
      <ResidentSceneLayer hostRef={sceneHostRef} />
      <div ref={scrollRootRef} className="unlocks-scroll">
        <SummaryCard items={items} isViewer={isViewer} />
        <CosmeticTabBar
          activeTab={activeTab}
          onChange={changeTab}
          idPrefix={TAB_ID_PREFIX}
          panelId={PANEL_ID}
        />
        <RarityFilterBar value={rarityFilter} onChange={setRarityFilter} />
        <ul
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={cosmeticTabId(TAB_ID_PREFIX, activeTab)}
          className="unlocks-grid"
        >
          {filterUnlockItems(items, rarityFilter).map((item) => (
            <UnlockCell
              key={item.id}
              item={item}
              tab={activeTab}
              productUi={productUi}
              sceneHostRef={sceneHostRef}
              scrollRootRef={scrollRootRef}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="unlocks-status">
      <Spinner label="正在加载收藏" />
    </div>
  );
}

interface UnlocksQueryState {
  readonly unlockedItems: readonly string[] | undefined;
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly refetch: () => unknown;
}

/** Waits for the unlock list, then shows the collection. */
function UnlocksLoader({
  query,
  isViewer,
}: {
  readonly query: UnlocksQueryState;
  readonly isViewer: boolean;
}) {
  if (query.unlockedItems === undefined) {
    return query.isError ? (
      <div className="unlocks-status">
        <p role="alert">加载失败</p>
        <Button loading={query.isFetching} onClick={() => void query.refetch()}>
          重试
        </Button>
      </div>
    ) : (
      <LoadingState />
    );
  }
  return (
    <Suspense fallback={<LoadingState />}>
      <UnlocksContent unlockedItems={query.unlockedItems} isViewer={isViewer} />
    </Suspense>
  );
}

/** Another player's collection, opened from their profile card in a room. */
function ViewerUnlocks({ userId }: { readonly userId: string }) {
  const query = useQuery(userUnlocksOptions(userId));
  return (
    <UnlocksLoader
      query={{
        unlockedItems: query.data?.unlockedItems,
        isError: query.isError,
        isFetching: query.isFetching,
        refetch: query.refetch,
      }}
      isViewer
    />
  );
}

/** The signed-in player's own collection; guests see only the free items. */
function SelfUnlocks() {
  const { user, loading } = useAuthContext();
  const stats = useUserStatsQuery();
  // The stats query never runs for guests, as in `useAuthenticatedQuery`.
  const isGuest = !loading && (user === null || user.isAnonymous);
  return (
    <UnlocksLoader
      query={{
        unlockedItems: isGuest ? [] : stats.data?.unlockedItems,
        isError: stats.isError,
        isFetching: stats.isFetching,
        refetch: stats.refetch,
      }}
      isViewer={false}
    />
  );
}

/**
 * Unlocks: every collection item by category with the owned share. Without a `userId` it shows
 * the signed-in player's own collection (back to settings); with `userId` and `displayName`
 * search params it shows another player's (back to the room it was opened from).
 */
export function UnlocksPage() {
  const { roomCode } = useParams();
  const [searchParams] = useSearchParams();
  const viewingUserId = searchParams.get('userId');
  const viewingDisplayName = searchParams.get('displayName');
  const isViewer = viewingUserId !== null;
  const settingsPath = roomCode === undefined ? '/settings' : `/settings/${roomCode}`;
  const viewerParentPath = roomCode === undefined ? '/' : roomPath(roomCode);
  return (
    <div className="unlocks-page" data-testid={TESTIDS.unlocksScreen}>
      <ScreenHeader
        title={isViewer ? `${viewingDisplayName ?? 'TA'}的收藏` : '解锁一览'}
        parentPath={isViewer ? viewerParentPath : settingsPath}
      />
      {isViewer ? <ViewerUnlocks userId={viewingUserId} /> : <SelfUnlocks />}
    </div>
  );
}
