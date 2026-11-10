/**
 * The 当前装备 section of a player profile: the six equipped cosmetic slots with name, type and
 * rarity, as the previous client's profile card showed them.
 */
import './ProfileEquipmentShowcase.css';

import { getItemRarity, type Rarity } from '@game-judge/game-engine/product/rewards';
import { type ReactNode, use } from 'react';

import { Avatar } from '@/components/avatar/Avatar';
import { parseBuiltinAvatarId } from '@/components/avatar/avatarSources';
import { IonIcon, type IoniconName } from '@/components/icons/IonIcon';
import { NameStyleText } from '@/components/nameStyles/NameStyleText';
import { RARITY_VISUAL } from '@/config/rarityVisual';
import type { UserPublicProfile } from '@/features/account/services/accountApi';
import { loadClientProductUi } from '@/features/product/loadClientProductUi';
import type { ClientProductUi } from '@/features/product/model/ClientProductUi';
import {
  cosmeticName,
  FLAIR_NAMES,
  FRAME_NAMES,
  NAME_STYLE_NAMES,
  SEAT_ANIMATION_NAMES,
} from '@/features/product/model/cosmeticNames';
import { TESTIDS } from '@/testids';
import { withAlpha } from '@/theme/colorUtils';

const SLOT_PREVIEW_SIZE = 28;

interface EquipmentSlotInfo {
  readonly typeLabel: string;
  /** Null when the slot has nothing equipped. */
  readonly name: string | null;
  readonly rarity: Rarity | null;
  readonly preview: ReactNode;
}

function emptySlot(typeLabel: string): EquipmentSlotInfo {
  return { typeLabel, name: null, rarity: null, preview: null };
}

function catalogSlot(
  typeLabel: string,
  names: Readonly<Record<string, string>>,
  itemId: string | undefined,
  icon: IoniconName,
): EquipmentSlotInfo {
  if (itemId === undefined) return emptySlot(typeLabel);
  return {
    typeLabel,
    name: cosmeticName(names, itemId),
    rarity: getItemRarity(itemId),
    preview: <IonIcon name={icon} />,
  };
}

function avatarSlot(
  avatarUrl: string | undefined,
  avatarSeed: string,
  productUi: ClientProductUi,
): EquipmentSlotInfo {
  if (avatarUrl === undefined) return emptySlot('头像');
  const preview = <Avatar userId={avatarSeed} avatarUrl={avatarUrl} size={SLOT_PREVIEW_SIZE} />;
  const builtinAvatarId = parseBuiltinAvatarId(avatarUrl);
  if (builtinAvatarId === null) return { typeLabel: '头像', name: '自定义', rarity: null, preview };
  return {
    typeLabel: '头像',
    name: productUi.getAvatarDisplayName(builtinAvatarId),
    rarity: getItemRarity(builtinAvatarId),
    preview,
  };
}

function nameStyleSlot(nameStyleId: string | undefined): EquipmentSlotInfo {
  if (nameStyleId === undefined) return emptySlot('名字样式');
  return {
    typeLabel: '名字样式',
    name: cosmeticName(NAME_STYLE_NAMES, nameStyleId),
    rarity: getItemRarity(nameStyleId),
    preview: <NameStyleText styleId={nameStyleId}>Aa</NameStyleText>,
  };
}

function revealEffectSlot(
  revealEffectId: UserPublicProfile['revealEffect'],
  productUi: ClientProductUi,
): EquipmentSlotInfo {
  if (revealEffectId === undefined) return emptySlot('揭晓特效');
  const presentation = productUi.getRevealEffectPresentation(revealEffectId);
  return {
    typeLabel: '揭晓特效',
    name: presentation.label,
    rarity: revealEffectId === 'random' ? null : getItemRarity(revealEffectId),
    preview: <IonIcon name={presentation.icon} />,
  };
}

function EquipmentSlot({ slot }: { readonly slot: EquipmentSlotInfo }) {
  const visual = slot.rarity === null ? null : RARITY_VISUAL[slot.rarity];
  return (
    <li
      className="profile-equip-slot"
      data-rarity={slot.rarity ?? undefined}
      style={
        visual === null
          ? undefined
          : { '--rarity-color': visual.color, '--rarity-glow': withAlpha(visual.color, 0.2) }
      }
    >
      <span className="profile-equip-preview" data-empty={slot.name === null} aria-hidden>
        {slot.preview}
      </span>
      <span className="profile-equip-name" data-empty={slot.name === null}>
        {slot.name ?? '未装备'}
      </span>
      <span className="profile-equip-type">{slot.typeLabel}</span>
      {visual !== null && <span className="profile-equip-rarity">{visual.label}</span>}
    </li>
  );
}

/** Suspends until the product UI resolver loads; render it inside a Suspense boundary. */
export function ProfileEquipmentShowcase({
  profile,
  avatarSeed,
}: {
  readonly profile: UserPublicProfile;
  /** Seeds the fallback avatar the same way as the card's main avatar. */
  readonly avatarSeed: string;
}) {
  const productUi = use(loadClientProductUi());
  const slots = [
    avatarSlot(profile.avatarUrl, avatarSeed, productUi),
    catalogSlot('头像框', FRAME_NAMES, profile.avatarFrame, 'person-circle-outline'),
    nameStyleSlot(profile.nameStyle),
    catalogSlot('座位特效', FLAIR_NAMES, profile.seatFlair, 'sparkles-outline'),
    revealEffectSlot(profile.revealEffect, productUi),
    catalogSlot('入座动画', SEAT_ANIMATION_NAMES, profile.seatAnimation, 'film-outline'),
  ];
  return (
    <section className="profile-equip" data-testid={TESTIDS.playerProfileEquipment}>
      <h3 className="profile-section-title">当前装备</h3>
      <ul className="profile-equip-grid">
        {slots.map((slot) => (
          <EquipmentSlot key={slot.typeLabel} slot={slot} />
        ))}
      </ul>
    </section>
  );
}
