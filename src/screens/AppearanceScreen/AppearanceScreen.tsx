/**
 * AppearanceScreen - 头像与头像框选择（全屏 Screen）
 *
 * 两个 Tab：「头像」（自定义 + 内置 4 列网格）和「头像框」（3×2 大尺寸试穿网格）。
 * 顶部 Hero 预览区实时合成头像 + 框效果，两个 Tab 共享。
 * 支持选中 + 确认保存 + 长按预览。
 * Orchestrator 层：调用 useAppearanceState → 编排所有 Presentational 组件。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { getItemRarity } from '@werewolf/game-engine/growth/rewardCatalog';
import { Image as ExpoImage } from 'expo-image';
import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  Image,
  type ImageSourcePropType,
  type ListRenderItemInfo,
  Pressable,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { RoleRevealAnimator } from '@/components/RoleRevealEffects';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, componentSizes } from '@/theme';
import { AVATAR_KEYS, getAvatarImageByIndex, getAvatarThumbByIndex } from '@/utils/avatar';

import { createAppearanceScreenStyles } from './components';
import { AppearanceFooter } from './components/AppearanceFooter';
import { AvatarCell } from './components/AvatarCell';
import { EffectCell } from './components/EffectCell';
import { EffectHeroPreview } from './components/EffectHeroPreview';
import { FlairCell } from './components/FlairCell';
import { FrameCell } from './components/FrameCell';
import { HeroPreview } from './components/HeroPreview';
import { NameStyleCell } from './components/NameStyleCell';
import { PickerTabBar } from './components/PickerTabBar';
import { RarityFilterBar } from './components/RarityFilterBar';
import { useAppearanceState } from './hooks/useAppearanceState';
import type {
  AvatarCellItem,
  EffectGridItem,
  FlairGridItem,
  FrameGridItem,
  NameStyleGridItem,
} from './types';
import { FRAME_NUM_COLUMNS, NUM_COLUMNS, PREVIEW_ALL_ROLES, PREVIEW_ROLE } from './types';

export const AppearanceScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createAppearanceScreenStyles(colors), []);
  const state = useAppearanceState();

  // ── Key extractors ──

  const keyExtractor = useCallback((item: AvatarCellItem) => item.key, []);
  const frameKeyExtractor = useCallback((item: FrameGridItem) => item.id, []);
  const flairKeyExtractor = useCallback((item: FlairGridItem) => item.id, []);
  const nameStyleKeyExtractor = useCallback((item: NameStyleGridItem) => item.id, []);
  const effectKeyExtractor = useCallback((item: EffectGridItem) => item.id, []);

  // ── Render callbacks ──

  const renderFrameItem = useCallback(
    ({ item }: ListRenderItemInfo<FrameGridItem>) => (
      <FrameCell
        item={item}
        selectedFrame={state.selectedFrame}
        previewAvatarUrl={state.previewAvatarUrl}
        userId={state.user?.id ?? 'anonymous'}
        onPress={state.handlePressFrame}
        styles={styles}
      />
    ),
    [state.selectedFrame, state.previewAvatarUrl, state.user?.id, state.handlePressFrame, styles],
  );

  const renderFlairItem = useCallback(
    ({ item }: ListRenderItemInfo<FlairGridItem>) => (
      <FlairCell
        item={item}
        selectedFlair={state.selectedFlair}
        previewAvatarUrl={state.previewAvatarUrl}
        userId={state.user?.id ?? 'anonymous'}
        onPress={state.handlePressFlair}
        styles={styles}
      />
    ),
    [state.selectedFlair, state.previewAvatarUrl, state.user?.id, state.handlePressFlair, styles],
  );

  const renderNameStyleItem = useCallback(
    ({ item }: ListRenderItemInfo<NameStyleGridItem>) => (
      <NameStyleCell
        item={item}
        selectedNameStyle={state.selectedNameStyle}
        onPress={state.handlePressNameStyle}
        styles={styles}
      />
    ),
    [state.selectedNameStyle, state.handlePressNameStyle, styles],
  );

  const renderEffectItem = useCallback(
    ({ item }: ListRenderItemInfo<EffectGridItem>) => (
      <EffectCell
        item={item}
        selectedEffect={state.selectedEffect}
        onPress={state.handlePressEffect}
        styles={styles}
      />
    ),
    [state.selectedEffect, state.handlePressEffect, styles],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<AvatarCellItem>) => {
      if (item.type === 'placeholder') {
        return <View style={styles.pickerItem} />;
      }

      if (item.type === 'default') {
        return (
          <TouchableOpacity
            style={[styles.pickerItem, state.selected === 'default' && styles.pickerItemSelected]}
            onPress={state.handlePressDefault}
            activeOpacity={0.7}
          >
            <View style={styles.pickerItemWolfPawContainer}>
              <Image
                source={state.wolfPawIcon.image}
                style={styles.pickerItemWolfPawIcon}
                tintColor={state.wolfPawIcon.color}
                resizeMode="contain"
              />
            </View>
            {state.isDefaultActive && state.selected !== 'default' && (
              <View style={styles.pickerCheckBadge}>
                <Ionicons
                  name="checkmark"
                  size={componentSizes.icon.xs}
                  color={colors.textInverse}
                />
              </View>
            )}
          </TouchableOpacity>
        );
      }

      if (item.type === 'custom') {
        return (
          <TouchableOpacity
            style={[styles.pickerItem, state.selected === 'custom' && styles.pickerItemSelected]}
            onPress={state.handlePressCustom}
            activeOpacity={0.7}
          >
            <ExpoImage
              source={{ uri: state.user!.customAvatarUrl! }}
              style={styles.pickerItemImage}
              contentFit="cover"
              cachePolicy="disk"
            />
            {state.isCustomActive && state.selected !== 'custom' && (
              <View style={styles.pickerCheckBadge}>
                <Ionicons
                  name="checkmark"
                  size={componentSizes.icon.xs}
                  color={colors.textInverse}
                />
              </View>
            )}
          </TouchableOpacity>
        );
      }

      // type === 'builtin'
      const isCurrentlyUsed = item.index === state.currentBuiltinIndex;
      const isSelected = item.index === state.selected;
      const imageSource = getAvatarThumbByIndex(item.index);
      const roleId = AVATAR_KEYS[item.index];
      const locked = !!roleId && !state.unlockedAvatars.has(roleId);

      return (
        <AvatarCell
          index={item.index}
          imageSource={imageSource}
          isSelected={isSelected}
          isCurrentlyUsed={isCurrentlyUsed}
          locked={locked}
          rarity={getItemRarity(roleId)}
          onPress={state.handlePressBuiltin}
          onLongPress={state.handleLongPress}
          styles={styles}
        />
      );
    },
    [
      state.currentBuiltinIndex,
      state.selected,
      state.unlockedAvatars,
      state.isDefaultActive,
      state.isCustomActive,
      state.wolfPawIcon,
      state.user,
      state.handlePressDefault,
      state.handlePressCustom,
      state.handlePressBuiltin,
      state.handleLongPress,
      styles,
    ],
  );

  // ── Render ──

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScreenHeader title="选择形象" onBack={state.handleGoBack} topInset={insets.top} />

      {state.activeTab !== 'effect' ? (
        <HeroPreview
          userId={state.user?.id ?? 'anonymous'}
          displayName={state.user?.displayName ?? '玩家'}
          previewAvatarUrl={state.previewAvatarUrl}
          effectiveFrame={state.effectiveFrame}
          frameLabel={state.frameLabel}
          effectiveFlair={state.effectiveFlair}
          effectiveNameStyle={state.effectiveNameStyle}
          readOnly={state.readOnly}
          hasCustomAvatar={!!state.user?.customAvatarUrl}
          onUpload={() => {
            void state.handleUpload();
          }}
          styles={styles}
        />
      ) : (
        <EffectHeroPreview
          heroEffectId={state.heroEffectId}
          heroEffectIcon={state.heroEffectOption?.icon ?? 'help-outline'}
          heroEffectLabel={state.heroEffectOption?.label ?? '无'}
          heroEffectDesc={state.heroEffectOption?.shortDesc ?? '跳过动画，直接显示身份'}
          heroEffectRarity={state.heroEffectRarity}
          heroEffectUnlocked={state.heroEffectUnlocked}
          heroEffectIsEquipped={state.heroEffectIsEquipped}
          saving={state.saving}
          onPreviewEffect={state.handlePreviewEffect}
          onEquipEffect={() => {
            void state.handleEquipEffect();
          }}
          styles={styles}
        />
      )}

      <PickerTabBar
        activeTab={state.activeTab}
        onTabChange={state.handleTabChange}
        styles={styles}
      />

      <RarityFilterBar
        rarityFilter={state.rarityFilter}
        onFilterChange={state.setRarityFilter}
        styles={styles}
      />

      <View style={styles.content}>
        {state.activeTab === 'avatar' ? (
          <FlatList
            key="avatar"
            data={state.filteredAvatarData}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={NUM_COLUMNS}
            contentContainerStyle={styles.pickerGrid}
            showsVerticalScrollIndicator={false}
            initialNumToRender={20}
            maxToRenderPerBatch={16}
            windowSize={5}
          />
        ) : state.activeTab === 'frame' ? (
          <FlatList
            key="frame"
            data={state.filteredFrameData}
            renderItem={renderFrameItem}
            keyExtractor={frameKeyExtractor}
            numColumns={FRAME_NUM_COLUMNS}
            columnWrapperStyle={styles.frameColumnWrapper}
            contentContainerStyle={styles.frameGridContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={9}
            maxToRenderPerBatch={6}
            windowSize={5}
          />
        ) : state.activeTab === 'flair' ? (
          <FlatList
            key="flair"
            data={state.filteredFlairData}
            renderItem={renderFlairItem}
            keyExtractor={flairKeyExtractor}
            numColumns={FRAME_NUM_COLUMNS}
            columnWrapperStyle={styles.frameColumnWrapper}
            contentContainerStyle={styles.frameGridContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={9}
            maxToRenderPerBatch={6}
            windowSize={5}
          />
        ) : state.activeTab === 'nameStyle' ? (
          <FlatList
            key="nameStyle"
            data={state.filteredNameStyleData}
            renderItem={renderNameStyleItem}
            keyExtractor={nameStyleKeyExtractor}
            numColumns={FRAME_NUM_COLUMNS}
            columnWrapperStyle={styles.frameColumnWrapper}
            contentContainerStyle={styles.frameGridContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={9}
            maxToRenderPerBatch={6}
            windowSize={5}
          />
        ) : state.activeTab === 'effect' ? (
          <FlatList
            key="effect"
            data={state.filteredEffectData}
            renderItem={renderEffectItem}
            keyExtractor={effectKeyExtractor}
            numColumns={FRAME_NUM_COLUMNS}
            columnWrapperStyle={styles.frameColumnWrapper}
            contentContainerStyle={styles.frameGridContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={9}
            maxToRenderPerBatch={6}
            windowSize={5}
          />
        ) : null}
      </View>

      <View style={[styles.pickerFooter, insets.bottom > 0 && { paddingBottom: insets.bottom }]}>
        <AppearanceFooter
          readOnly={state.readOnly}
          hasSelection={state.hasSelection}
          saving={state.saving}
          hasUser={!!state.user}
          onConfirm={() => {
            void state.handleConfirm();
          }}
          onUpgrade={state.handleUpgrade}
          styles={styles}
        />
      </View>

      {state.previewIndex !== null && (
        <Pressable style={styles.pickerPreviewOverlay} onPress={state.handleClosePreview}>
          <Image
            source={getAvatarImageByIndex(state.previewIndex) as ImageSourcePropType}
            style={styles.pickerPreviewImage}
            resizeMode="cover"
          />
        </Pressable>
      )}

      {state.previewEffectType && (
        <RoleRevealAnimator
          visible
          effectType={state.previewEffectType}
          role={PREVIEW_ROLE}
          allRoles={PREVIEW_ALL_ROLES}
          onComplete={() => state.setPreviewEffectType(null)}
          enableHaptics={false}
        />
      )}
    </SafeAreaView>
  );
};
