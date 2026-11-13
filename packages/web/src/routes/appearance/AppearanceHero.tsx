/** The appearance page's hero previews and footer action. */
import type { RefObject } from 'react';

import { Button } from '@/components/Button';
import { IonIcon } from '@/components/icons/IonIcon';
import { NameStyleText } from '@/components/nameStyles/NameStyleText';
import { RARITY_VISUAL, rarityStarLabel } from '@/config/rarityVisual';
import { ResidentAvatarTile } from '@/features/product/components/ResidentPreview';
import { resolveResidentDecorations } from '@/scene/residentDecorations';

import type { AppearanceState } from './useAppearanceState';

interface HeroPreviewProps {
  readonly state: AppearanceState;
  readonly userId: string;
  readonly displayName: string;
  readonly sceneHostRef: RefObject<HTMLDivElement | null>;
  readonly scrollRootRef: RefObject<HTMLElement | null>;
}

/** The draft look: avatar with frame and flair beside the styled name and the frame's name. */
export function HeroPreview({
  state,
  userId,
  displayName,
  sceneHostRef,
  scrollRootRef,
}: HeroPreviewProps) {
  const residents = resolveResidentDecorations({
    avatarFrame: state.effectiveFrame ?? undefined,
    seatFlair: state.effectiveFlair ?? undefined,
  });
  return (
    <section className="appearance-hero" aria-label="形象预览">
      <div className="appearance-hero-avatar">
        <ResidentAvatarTile
          userId={userId}
          avatarUrl={state.previewAvatarUrl}
          residents={residents}
          sceneHostRef={sceneHostRef}
          scrollRootRef={scrollRootRef}
        />
      </div>
      <div className="appearance-hero-text">
        <NameStyleText styleId={state.effectiveNameStyle} className="appearance-hero-name">
          {displayName}
        </NameStyleText>
        <p className="appearance-hero-meta">当前框：{state.frameLabel}</p>
        {state.readOnly && <p className="appearance-hero-muted">注册或绑定邮箱后可上传</p>}
      </div>
    </section>
  );
}

interface EffectHeroPreviewProps {
  readonly state: AppearanceState;
  readonly userId: string;
  readonly sceneHostRef: RefObject<HTMLDivElement | null>;
  readonly scrollRootRef: RefObject<HTMLElement | null>;
  readonly saving: boolean;
  readonly onEquip: () => void;
  readonly onEquipUnavailable: () => void;
}

/** The highlighted reveal effect: its pet or icon, description, rarity, preview and equip. */
export function EffectHeroPreview({
  state,
  userId,
  sceneHostRef,
  scrollRootRef,
  saving,
  onEquip,
  onEquipUnavailable,
}: EffectHeroPreviewProps) {
  const { heroEffectId, heroEffectPresentation: presentation, heroEffectRarity } = state;
  const canPreview = heroEffectId !== 'none' && heroEffectId !== 'random';
  const canEquip = state.heroEffectUnlocked && !state.heroEffectIsEquipped;
  const rarityColor = heroEffectRarity === null ? undefined : RARITY_VISUAL[heroEffectRarity].color;
  let equipLabel = '装备';
  if (!state.heroEffectUnlocked) equipLabel = '未解锁';
  else if (state.heroEffectIsEquipped) equipLabel = '已装备';
  return (
    <section className="appearance-hero" aria-label="特效预览">
      <div className="appearance-hero-avatar">
        {presentation.petName === null ? (
          <span className="appearance-hero-effect-icon" style={{ color: rarityColor }}>
            <IonIcon name={presentation.icon} />
          </span>
        ) : (
          <ResidentAvatarTile
            userId={userId}
            avatarUrl={state.previewAvatarUrl}
            residents={resolveResidentDecorations({ seatPetId: heroEffectId })}
            sceneHostRef={sceneHostRef}
            scrollRootRef={scrollRootRef}
          />
        )}
      </div>
      <div className="appearance-hero-text">
        <p className="appearance-hero-heading">
          <span className="appearance-hero-title">{presentation.label}</span>
          {heroEffectRarity !== null && (
            <span className="appearance-hero-rarity" style={{ color: rarityColor }}>
              {rarityStarLabel(heroEffectRarity)}
            </span>
          )}
        </p>
        <p className="appearance-hero-description">{presentation.shortDescription}</p>
        {presentation.petName !== null && (
          <p className="appearance-hero-muted">🐾 装备后座位出现{presentation.petName}</p>
        )}
        <div className="appearance-hero-actions">
          <Button
            variant="secondary"
            aria-disabled={!canPreview}
            onClick={canPreview ? state.handlePreviewEffect : state.handlePreviewEffectUnavailable}
          >
            预览动画
          </Button>
          <Button
            variant={state.heroEffectIsEquipped ? 'secondary' : 'primary'}
            loading={saving}
            aria-disabled={!canEquip}
            onClick={canEquip ? onEquip : onEquipUnavailable}
          >
            {equipLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}

interface AppearanceFooterProps {
  readonly readOnly: boolean;
  readonly hasSelection: boolean;
  readonly saving: boolean;
  readonly hasUser: boolean;
  readonly onConfirm: () => void;
  readonly onConfirmUnavailable: () => void;
  readonly onUpgrade: () => void;
}

/** Confirm the draft, or (guests and anonymous players) the bind/register pitch. */
export function AppearanceFooter({
  readOnly,
  hasSelection,
  saving,
  hasUser,
  onConfirm,
  onConfirmUnavailable,
  onUpgrade,
}: AppearanceFooterProps) {
  if (readOnly) {
    return (
      <div className="appearance-upgrade">
        <p className="appearance-upgrade-title">
          {hasUser ? '绑定邮箱' : '注册账号'}，打造专属形象
        </p>
        <ul className="appearance-upgrade-benefits">
          <li>· 收集并使用头像</li>
          <li>· 上传自定义头像</li>
          <li>· 收集并装备头像框</li>
          <li>· 设置昵称</li>
        </ul>
        <Button onClick={onUpgrade}>{hasUser ? '立即绑定' : '立即注册'}</Button>
      </div>
    );
  }
  return (
    <Button
      size="lg"
      className="appearance-confirm"
      loading={saving}
      aria-disabled={!hasSelection}
      onClick={hasSelection ? onConfirm : onConfirmUnavailable}
    >
      {hasSelection ? '确认使用' : '未做更改'}
    </Button>
  );
}
