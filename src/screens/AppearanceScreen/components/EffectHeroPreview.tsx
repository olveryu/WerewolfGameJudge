import Ionicons from '@expo/vector-icons/Ionicons';
import type { Rarity } from '@werewolf/game-engine/growth/rewardCatalog';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { getPetByEffectId } from '@/components/seatPets';
import { RARITY_VISUAL } from '@/config/rarityVisual';
import { colors } from '@/theme';

import type { AppearanceScreenStyles } from './styles';

interface EffectHeroPreviewProps {
  heroEffectId: string | null;
  heroEffectIcon: string;
  heroEffectLabel: string;
  heroEffectDesc: string;
  heroEffectRarity: Rarity | null;
  heroEffectUnlocked: boolean;
  heroEffectIsEquipped: boolean;
  saving: boolean;
  onPreviewEffect: () => void;
  onEquipEffect: () => void;
  styles: AppearanceScreenStyles;
}

export const EffectHeroPreview: React.FC<EffectHeroPreviewProps> = ({
  heroEffectId,
  heroEffectIcon,
  heroEffectLabel,
  heroEffectDesc,
  heroEffectRarity,
  heroEffectUnlocked,
  heroEffectIsEquipped,
  saving,
  onPreviewEffect,
  onEquipEffect,
  styles,
}) => {
  const petConfig = useMemo(() => getPetByEffectId(heroEffectId), [heroEffectId]);
  const PetComponent = petConfig?.Component;

  return (
    <View style={styles.heroPreview}>
      <View style={styles.heroPreviewLeft}>
        <View style={styles.effectHeroIcon}>
          {PetComponent ? (
            <PetComponent size={48} />
          ) : (
            <Ionicons
              name={heroEffectIcon as React.ComponentProps<typeof Ionicons>['name']}
              size={36}
              color={
                heroEffectRarity ? RARITY_VISUAL[heroEffectRarity].color : colors.textSecondary
              }
            />
          )}
        </View>
      </View>
      <View style={styles.heroPreviewRight}>
        <Text style={styles.effectHeroName}>{heroEffectLabel}</Text>
        <Text style={styles.effectHeroDesc} numberOfLines={2}>
          {heroEffectDesc}
        </Text>
        {petConfig && (
          <Text style={styles.effectHeroPetHint}>🐾 装备后座位出现{petConfig.name}</Text>
        )}
        {heroEffectRarity && (
          <Text style={[styles.effectHeroRarity, { color: RARITY_VISUAL[heroEffectRarity].color }]}>
            {'★'.repeat(
              heroEffectRarity === 'legendary'
                ? 4
                : heroEffectRarity === 'epic'
                  ? 3
                  : heroEffectRarity === 'rare'
                    ? 2
                    : 1,
            )}{' '}
            {RARITY_VISUAL[heroEffectRarity].label}
          </Text>
        )}
        <View style={styles.effectHeroActions}>
          <Button
            variant="secondary"
            size="sm"
            disabled={heroEffectId === 'none' || heroEffectId === 'random'}
            fireWhenDisabled
            onPress={onPreviewEffect}
          >
            预览动画
          </Button>
          <Button
            variant={heroEffectIsEquipped ? 'secondary' : 'primary'}
            size="sm"
            disabled={!heroEffectUnlocked || heroEffectIsEquipped}
            fireWhenDisabled
            loading={saving}
            onPress={onEquipEffect}
          >
            {!heroEffectUnlocked ? '未解锁' : heroEffectIsEquipped ? '已装备' : '装备'}
          </Button>
        </View>
      </View>
    </View>
  );
};
