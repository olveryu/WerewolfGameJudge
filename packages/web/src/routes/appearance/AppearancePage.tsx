import './AppearancePage.css';

import { getItemRarity } from '@game-judge/game-engine/product/rewards';
import { type ChangeEvent, Suspense, use, useRef } from 'react';
import { useParams } from 'react-router';

import { Avatar } from '@/components/avatar/Avatar';
import { makeBuiltinAvatarUrl } from '@/components/avatar/avatarSources';
import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';
import { ScreenHeader, useScreenBack } from '@/components/ScreenHeader';
import { Spinner } from '@/components/Spinner';
import { rarityStarLabel } from '@/config/rarityVisual';
import { useAuthContext, type User } from '@/contexts/AuthContext';
import { useUpdateProfile, useUploadAvatar } from '@/features/account/accountMutations';
import { useUserStatsQuery } from '@/features/account/queries/useUserStatsQuery';
import {
  CosmeticTabBar,
  cosmeticTabId,
  RarityFilterBar,
} from '@/features/product/components/CosmeticTabs';
import { ResidentSceneLayer } from '@/features/product/components/ResidentPreview';
import { loadClientProductUi } from '@/features/product/loadClientProductUi';
import type { ClientProductUi } from '@/features/product/model/ClientProductUi';
import { useActiveRoomAccount } from '@/games/clientModules';
import { TESTIDS } from '@/testids';

import { AppearanceFooter, EffectHeroPreview, HeroPreview } from './AppearanceHero';
import { AppearancePickerGrid } from './AppearancePickers';
import { useAppearanceSave } from './useAppearanceSave';
import { type AppearanceState, useAppearanceState } from './useAppearanceState';

const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp';
const TAB_ID_PREFIX = 'appearance';
const PANEL_ID = 'appearance-picker-panel';
/** The previous client's preview overlay size. */
const AVATAR_PREVIEW_SIZE = 200;
/** Signed-out viewers still see the wolf-paw default, keyed like the previous client. */
const GUEST_USER_ID = 'anonymous';

function useParentPath(): string {
  const { roomCode } = useParams();
  return roomCode === undefined ? '/settings' : `/settings/${roomCode}`;
}

/** Long-press preview of a built-in avatar at full size. */
function AvatarPreviewDialog({
  state,
  productUi,
  userId,
}: {
  readonly state: AppearanceState;
  readonly productUi: ClientProductUi;
  readonly userId: string;
}) {
  const avatarId = state.previewAvatarId;
  return (
    <CenterDialog
      open={avatarId !== null}
      onClose={() => state.setPreviewAvatarId(null)}
      title={avatarId === null ? '' : productUi.getAvatarDisplayName(avatarId)}
      subtitle={avatarId === null ? undefined : rarityStarLabel(getItemRarity(avatarId))}
    >
      {avatarId !== null && (
        <div className="appearance-avatar-preview">
          <Avatar
            userId={userId}
            avatarUrl={makeBuiltinAvatarUrl(avatarId)}
            size={AVATAR_PREVIEW_SIZE}
          />
        </div>
      )}
    </CenterDialog>
  );
}

interface AppearanceEditorProps {
  readonly user: User | null;
  readonly unlockedIds: readonly string[];
  readonly isRefreshError: boolean;
  readonly retry: () => void;
}

function AppearanceEditor({ user, unlockedIds, isRefreshError, retry }: AppearanceEditorProps) {
  const productUi = use(loadClientProductUi());
  const { refreshUser } = useAuthContext();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const activeRoom = useActiveRoomAccount();
  const parentPath = useParentPath();
  const goBack = useScreenBack(parentPath);
  const state = useAppearanceState({ user, unlockedIds, productUi });
  const save = useAppearanceSave({
    ...state,
    heroEffectOptionLabel: state.heroEffectPresentation.label,
    updateProfile: (patch) => updateProfile.mutateAsync(patch),
    uploadAvatar: (file) => uploadAvatar.mutateAsync(file),
    refreshUser,
    activeRoom,
    goBack,
  });
  const sceneHostRef = useRef<HTMLDivElement>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userId = user?.id ?? GUEST_USER_ID;
  const RevealEffectPreview = state.heroEffectPresentation.Preview;

  const pickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Reset so picking the same file again still fires `change`.
    input.value = '';
    if (file !== undefined) void save.handleUpload(file);
  };

  return (
    <div className="appearance-body">
      <ResidentSceneLayer hostRef={sceneHostRef} />
      <div ref={scrollRootRef} className="appearance-scroll">
        {isRefreshError && <Button onClick={retry}>藏品刷新失败，重试</Button>}
        {state.hasSelection && (
          <p className="appearance-status" aria-live="polite">
            有未保存的更改
          </p>
        )}
        {state.activeTab === 'effect' ? (
          <EffectHeroPreview
            state={state}
            userId={userId}
            sceneHostRef={sceneHostRef}
            saving={save.saving}
            onEquip={() => void save.handleEquipEffect()}
            onEquipUnavailable={save.handleEquipEffectUnavailable}
          />
        ) : (
          <HeroPreview
            state={state}
            userId={userId}
            displayName={user?.displayName ?? '玩家'}
            hasCustomAvatar={state.customAvatarUrl !== null}
            sceneHostRef={sceneHostRef}
            onUpload={() => fileInputRef.current?.click()}
          />
        )}
        <CosmeticTabBar
          activeTab={state.activeTab}
          onChange={state.handleChangeTab}
          idPrefix={TAB_ID_PREFIX}
          panelId={PANEL_ID}
        />
        <RarityFilterBar value={state.rarityFilter} onChange={state.setRarityFilter} />
        <div
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={cosmeticTabId(TAB_ID_PREFIX, state.activeTab)}
          className="appearance-panel"
        >
          <AppearancePickerGrid
            state={state}
            productUi={productUi}
            userId={userId}
            sceneHostRef={sceneHostRef}
            scrollRootRef={scrollRootRef}
          />
        </div>
      </div>
      <footer className="appearance-footer">
        <AppearanceFooter
          readOnly={state.readOnly}
          hasSelection={state.hasSelection}
          saving={save.saving}
          hasUser={user !== null}
          onConfirm={() => void save.handleConfirm()}
          onConfirmUnavailable={save.handleConfirmUnavailable}
          onUpgrade={goBack}
        />
      </footer>
      {!state.readOnly && (
        <input
          ref={fileInputRef}
          type="file"
          accept={AVATAR_ACCEPT}
          hidden
          data-testid={TESTIDS.appearanceAvatarInput}
          onChange={pickFile}
        />
      )}
      <AvatarPreviewDialog state={state} productUi={productUi} userId={userId} />
      {state.previewEffectId !== null && (
        <RevealEffectPreview
          effectId={state.previewEffectId}
          onComplete={state.closeEffectPreview}
        />
      )}
    </div>
  );
}

/** Loads the unlocked collection before the editor; guests and anonymous players skip it. */
function AppearanceSession() {
  const { user } = useAuthContext();
  const stats = useUserStatsQuery();
  const readOnly = user === null || user.isAnonymous;
  if (!readOnly && stats.data === undefined) {
    return stats.isError ? (
      <div className="appearance-query-status">
        <p role="alert">藏品加载失败</p>
        <Button loading={stats.isFetching} onClick={() => void stats.refetch()}>
          重试
        </Button>
      </div>
    ) : (
      <div className="appearance-query-status">
        <Spinner label="正在加载藏品" />
      </div>
    );
  }
  return (
    <Suspense
      fallback={
        <div className="appearance-query-status">
          <Spinner label="正在加载藏品" />
        </div>
      }
    >
      <AppearanceEditor
        user={user}
        unlockedIds={stats.data?.unlockedItems ?? []}
        isRefreshError={stats.isError}
        retry={() => void stats.refetch()}
      />
    </Suspense>
  );
}

/**
 * Appearance: pick an avatar (or upload a custom one), frame, seat flair, name style, reveal
 * effect and seat entrance, previewed with the room's own scene code. Opened from a room
 * (`/appearance/:roomCode`), it returns to that room's settings and applies saves to the room.
 */
export function AppearancePage() {
  const { user } = useAuthContext();
  return (
    <div className="appearance-page" data-testid={TESTIDS.appearanceScreen}>
      <ScreenHeader title="选择形象" parentPath={useParentPath()} />
      {/* A new account (or a bind) starts a fresh draft. */}
      <AppearanceSession key={`${user?.id ?? GUEST_USER_ID}:${user?.isAnonymous ?? true}`} />
    </div>
  );
}
