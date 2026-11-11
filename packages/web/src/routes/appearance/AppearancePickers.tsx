/** The appearance page's picker grids: one cell component, a thumbnail per category. */
import { getItemRarity, type Rarity } from '@game-judge/game-engine/product/rewards';
import { type ReactNode, type RefObject, useRef } from 'react';

import { Avatar } from '@/components/avatar/Avatar';
import { makeBuiltinAvatarUrl } from '@/components/avatar/avatarSources';
import { IonIcon } from '@/components/icons/IonIcon';
import { NameStyleText } from '@/components/nameStyles/NameStyleText';
import { getRarityCellStyle, getRaritySelectedStyle } from '@/config/rarityVisual';
import { RarityCellBg } from '@/features/product/components/RarityCellBg';
import { ResidentAvatarTile } from '@/features/product/components/ResidentPreview';
import type { ClientProductUi } from '@/features/product/model/ClientProductUi';
import { resolveResidentDecorations } from '@/scene/residentDecorations';
import IconCameraOutline from '~icons/ion/camera-outline';
import IconCheckmark from '~icons/ion/checkmark';
import IconCloseCircleOutline from '~icons/ion/close-circle-outline';
import IconLockClosed from '~icons/ion/lock-closed';

import type { CosmeticGridItem, EffectGridItem } from './types';
import type { AppearanceState } from './useAppearanceState';

/** Locked items are dimmed, as in the previous client. */
const LOCKED_OPACITY = 0.4;
const LONG_PRESS_MS = 500;

/** Long press (touch or mouse) and the context menu open the item's preview. */
function useLongPress(onLongPress: (() => void) | undefined) {
  const timerRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  const cancel = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };
  if (onLongPress === undefined) return { handlers: {}, consumeClick: () => false };
  return {
    handlers: {
      onPointerDown: () => {
        firedRef.current = false;
        cancel();
        timerRef.current = window.setTimeout(() => {
          firedRef.current = true;
          onLongPress();
        }, LONG_PRESS_MS);
      },
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onContextMenu: (event: { preventDefault: () => void }) => {
        event.preventDefault();
        cancel();
        if (!firedRef.current) onLongPress();
        firedRef.current = true;
      },
    },
    /** True once after a long press, so its trailing click does not also select. */
    consumeClick: () => {
      const fired = firedRef.current;
      firedRef.current = false;
      return fired;
    },
  };
}

interface PickerCellProps {
  /** The accessible name; locked items do not reveal theirs. */
  readonly label: string;
  /** The caption under the thumbnail, or none (avatars). */
  readonly caption?: string;
  readonly unlocked: boolean;
  readonly rarity: Rarity | null;
  readonly isSelected: boolean;
  /** The equipped item while nothing is selected. */
  readonly showActive: boolean;
  /** A check badge on the equipped item. */
  readonly showCheck?: boolean;
  /** Leaves room around the thumbnail for artwork drawn past its edge (avatar frames). */
  readonly inset?: boolean;
  readonly onPress: () => void;
  readonly onLongPress?: () => void;
  readonly children: ReactNode;
}

function PickerCell({
  label,
  caption,
  unlocked,
  rarity,
  isSelected,
  showActive,
  showCheck = false,
  inset = false,
  onPress,
  onLongPress,
  children,
}: PickerCellProps) {
  const longPress = useLongPress(onLongPress);
  const style =
    rarity === null
      ? undefined
      : { ...getRarityCellStyle(rarity), ...(isSelected ? getRaritySelectedStyle(rarity) : {}) };
  return (
    <button
      type="button"
      className="appearance-cell"
      aria-label={label}
      aria-pressed={isSelected}
      data-active={showActive}
      style={style}
      {...longPress.handlers}
      onClick={() => {
        if (!longPress.consumeClick()) onPress();
      }}
    >
      <RarityCellBg rarity={rarity} />
      <span className="appearance-cell-thumb" data-inset={inset}>
        {children}
      </span>
      {caption !== undefined && (
        <span className="appearance-cell-caption" data-locked={!unlocked}>
          {unlocked ? caption : '???'}
        </span>
      )}
      {!unlocked && (
        <span className="appearance-cell-lock">
          <IconLockClosed aria-hidden />
        </span>
      )}
      {showCheck && (
        <span className="appearance-cell-check">
          <IconCheckmark aria-hidden />
        </span>
      )}
    </button>
  );
}

function NoneThumb() {
  return (
    <span className="appearance-cell-icon">
      <IconCloseCircleOutline aria-hidden />
    </span>
  );
}

function itemLabel(item: CosmeticGridItem<string>): string {
  return item.unlocked ? item.name : '未解锁';
}

interface PickerPanelProps {
  readonly state: AppearanceState;
  readonly productUi: ClientProductUi;
  readonly userId: string;
  readonly sceneHostRef: RefObject<HTMLDivElement | null>;
  readonly scrollRootRef: RefObject<HTMLElement | null>;
  /** Opens the file picker for a custom avatar. */
  readonly onUpload: () => void;
}

/** The first avatar cell of an editable account: upload (or replace) the custom avatar. */
function UploadCell({
  hasCustomAvatar,
  onUpload,
}: {
  readonly hasCustomAvatar: boolean;
  readonly onUpload: () => void;
}) {
  return (
    <button
      type="button"
      className="appearance-cell"
      aria-label={hasCustomAvatar ? '更换自定义头像' : '上传自定义头像'}
      onClick={onUpload}
    >
      <span className="appearance-cell-thumb">
        <span className="appearance-cell-upload">
          <IconCameraOutline aria-hidden />
          <span>{hasCustomAvatar ? '更换' : '上传'}</span>
        </span>
      </span>
    </button>
  );
}

function AvatarCells({ state, productUi, userId }: PickerPanelProps) {
  return state.avatarGrid.map((item) => {
    if (item.type === 'default') {
      return (
        <PickerCell
          key={item.key}
          label="默认头像"
          unlocked
          rarity={null}
          isSelected={state.selected === 'default'}
          showActive={false}
          showCheck={state.isDefaultActive && state.selected !== 'default'}
          onPress={() => state.handleSelectAvatar('default')}
        >
          <Avatar userId={userId} avatarUrl={null} size="fill" />
        </PickerCell>
      );
    }
    if (item.type === 'custom') {
      return (
        <PickerCell
          key={item.key}
          label="自定义头像"
          unlocked
          rarity={null}
          isSelected={state.selected === 'custom'}
          showActive={false}
          showCheck={state.isCustomActive && state.selected !== 'custom'}
          onPress={() => state.handleSelectAvatar('custom')}
        >
          <Avatar userId={userId} avatarUrl={state.customAvatarUrl} size="fill" />
        </PickerCell>
      );
    }
    const { avatarId } = item;
    const unlocked = state.unlockedAvatars.has(avatarId);
    const isSelected = state.selected === avatarId;
    return (
      <PickerCell
        key={item.key}
        label={unlocked ? productUi.getAvatarDisplayName(avatarId) : '未解锁头像'}
        unlocked={unlocked}
        rarity={getItemRarity(avatarId)}
        isSelected={isSelected}
        showActive={false}
        showCheck={avatarId === state.currentAvatarId && !isSelected && unlocked}
        onPress={() => state.handleSelectAvatar(avatarId)}
        onLongPress={() => state.setPreviewAvatarId(avatarId)}
      >
        <span style={unlocked ? undefined : { opacity: LOCKED_OPACITY }}>
          <Avatar userId={userId} avatarUrl={makeBuiltinAvatarUrl(avatarId)} size="fill" />
        </span>
      </PickerCell>
    );
  });
}

type ResidentCategory = 'frame' | 'flair' | 'seatAnimation';

function residentsOf(category: ResidentCategory, id: string) {
  if (category === 'frame') return resolveResidentDecorations({ avatarFrame: id });
  if (category === 'flair') return resolveResidentDecorations({ seatFlair: id });
  return resolveResidentDecorations({ seatAnimation: id });
}

/** Frame, flair and seat-entrance grids: the user's preview avatar wearing each item. */
function ResidentGrid({
  category,
  items,
  selection,
  onSelect,
  previewAvatarUrl,
  userId,
  sceneHostRef,
  scrollRootRef,
}: {
  readonly category: ResidentCategory;
  readonly items: readonly CosmeticGridItem<string>[];
  readonly selection: string | null;
  readonly onSelect: (id: string) => void;
  readonly previewAvatarUrl: string | null;
} & Pick<PickerPanelProps, 'userId' | 'sceneHostRef' | 'scrollRootRef'>) {
  return items.map((item) => (
    <PickerCell
      key={item.id}
      label={itemLabel(item)}
      caption={item.name}
      unlocked={item.unlocked}
      rarity={item.rarity}
      isSelected={selection === item.id}
      showActive={item.isActive && selection === null}
      showCheck={item.isActive && selection !== item.id}
      inset
      onPress={() => onSelect(item.id)}
    >
      {item.id === 'none' ? (
        <NoneThumb />
      ) : (
        <ResidentAvatarTile
          userId={userId}
          avatarUrl={previewAvatarUrl}
          residents={residentsOf(category, item.id)}
          sceneHostRef={sceneHostRef}
          scrollRootRef={scrollRootRef}
          opacity={item.unlocked ? 1 : LOCKED_OPACITY}
        />
      )}
    </PickerCell>
  ));
}

function NameStyleGrid({ state }: Pick<PickerPanelProps, 'state'>) {
  return state.nameStyleGrid.map((item) => (
    <PickerCell
      key={item.id}
      label={itemLabel(item)}
      caption={item.name}
      unlocked={item.unlocked}
      rarity={item.rarity}
      isSelected={state.selectedNameStyle === item.id}
      showActive={item.isActive && state.selectedNameStyle === null}
      showCheck={item.isActive && state.selectedNameStyle !== item.id}
      onPress={() => state.handleSelectNameStyle(item.id)}
    >
      {item.id === 'none' ? (
        <NoneThumb />
      ) : (
        <span
          className="appearance-cell-name-style"
          style={item.unlocked ? undefined : { opacity: LOCKED_OPACITY }}
        >
          <NameStyleText styleId={item.id}>{item.name}</NameStyleText>
        </span>
      )}
    </PickerCell>
  ));
}

function EffectGrid({ state }: Pick<PickerPanelProps, 'state'>) {
  return state.effectGrid.map((item: EffectGridItem) => (
    <PickerCell
      key={item.id}
      label={itemLabel(item)}
      caption={item.name}
      unlocked={item.unlocked}
      rarity={item.rarity}
      isSelected={state.selectedEffect === item.id}
      showActive={item.isActive && state.selectedEffect === null}
      showCheck={item.isActive && state.selectedEffect !== item.id}
      onPress={() => state.handleSelectEffect(item.id)}
    >
      <span className="appearance-cell-icon" data-locked={!item.unlocked}>
        <IonIcon name={item.icon} />
      </span>
    </PickerCell>
  ));
}

/** The active category's grid. */
export function AppearancePickerGrid(props: PickerPanelProps) {
  const { state } = props;
  const residentProps = {
    previewAvatarUrl: state.previewAvatarUrl,
    userId: props.userId,
    sceneHostRef: props.sceneHostRef,
    scrollRootRef: props.scrollRootRef,
  };
  switch (state.activeTab) {
    case 'avatar':
      return (
        <div className="appearance-grid" data-kind="avatar">
          {!state.readOnly && state.rarityFilter === 'all' && (
            <UploadCell
              hasCustomAvatar={state.customAvatarUrl !== null}
              onUpload={props.onUpload}
            />
          )}
          <AvatarCells {...props} />
        </div>
      );
    case 'frame':
      return (
        <div className="appearance-grid">
          <ResidentGrid
            category="frame"
            items={state.frameGrid}
            selection={state.selectedFrame}
            onSelect={state.handleSelectFrame}
            {...residentProps}
          />
        </div>
      );
    case 'flair':
      return (
        <div className="appearance-grid">
          <ResidentGrid
            category="flair"
            items={state.flairGrid}
            selection={state.selectedFlair}
            onSelect={state.handleSelectFlair}
            {...residentProps}
          />
        </div>
      );
    case 'nameStyle':
      return (
        <div className="appearance-grid">
          <NameStyleGrid state={state} />
        </div>
      );
    case 'effect':
      return (
        <div className="appearance-grid">
          <EffectGrid state={state} />
        </div>
      );
    case 'seatAnimation':
      return (
        <div className="appearance-grid">
          <ResidentGrid
            category="seatAnimation"
            items={state.seatAnimationGrid}
            selection={state.selectedSeatAnimation}
            onSelect={state.handleSelectSeatAnimation}
            {...residentProps}
          />
        </div>
      );
  }
}
