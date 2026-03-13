/**
 * ConfigScreen - 游戏配置与房间创建（Render-only）
 *
 * 角色列表由 FACTION_GROUPS + ROLE_SPECS 数据驱动。
 * 所有状态/回调由 useConfigScreenState hook 提供。
 * 纯函数 helpers 在 configHelpers.ts。
 * 不使用硬编码样式值，不使用 console.*。
 */
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ROLE_SPECS, type RoleId } from '@werewolf/game-engine/models/roles';
import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/LoadingScreen';
import { RoleCardSimple } from '@/components/RoleCardSimple';
import { SettingsSheet } from '@/components/SettingsSheet';
import { useGameFacade } from '@/contexts';
import { useServices } from '@/contexts/ServiceContext';
import { RootStackParamList } from '@/navigation/types';
import { TESTIDS } from '@/testids';
import { fixed, useColors } from '@/theme';

import {
  createConfigScreenStyles,
  FactionTabs,
  RoleChip,
  RoleStepper,
  Section,
  TemplatePicker,
} from './components';
import { expandSlotToChipEntries, FACTION_COLOR_MAP } from './configHelpers';
import { useConfigScreenState } from './useConfigScreenState';

// ============================================
// Main Component
// ============================================

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Config'>;
type ConfigRouteProp = RouteProp<RootStackParamList, 'Config'>;

export const ConfigScreen: React.FC = () => {
  const colors = useColors();
  const styles = useMemo(() => createConfigScreenStyles(colors), [colors]);

  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ConfigRouteProp>();
  const existingRoomNumber = route.params?.existingRoomNumber;
  const initialRoles = route.params?.initialRoles;

  const facade = useGameFacade();
  const { settingsService, authService, roomService } = useServices();

  const state = useConfigScreenState({
    existingRoomNumber,
    initialRoles,
    navigation,
    facade,
    settingsService,
    authService,
    roomService,
    colors,
  });

  const {
    isEditMode,
    isDisabled,
    isLoading,
    isCreating,
    selection,
    totalCount,
    variantOverrides,
    overflowVisible,
    setOverflowVisible,
    handleGoBack,
    handleCreateRoom,
    toggleRole,
    handleClearSelection,
    selectedTemplateLabel,
    templateDropdownVisible,
    handleOpenTemplateDropdown,
    handleCloseTemplateDropdown,
    handleSelectTemplate,
    selectedTemplate,
    roleRevealAnimation,
    bgmEnabled,
    settingsSheetVisible,
    handleOpenSettings,
    handleCloseSettings,
    handleAnimationChange,
    handleBgmChange,
    roleInfoId,
    roleInfoVariantIds,
    roleInfoActiveVariant,
    handleChipInfoPress,
    handleCloseRoleInfo,
    handleRoleInfoVariantSelect,
    tabItems,
    activeTab,
    activeGroup,
    handleTabPress,
    getBulkCount,
    handleBulkCountChange,
    getFactionAccentColor,
  } = state;

  return (
    <SafeAreaView style={styles.container} testID={TESTIDS.configScreenRoot}>
      {/* Header row — ← | 预女猎白▾ 12人 | ⋯ */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleGoBack}
          testID={TESTIDS.configBackButton}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.templatePill}
            onPress={handleOpenTemplateDropdown}
            activeOpacity={fixed.activeOpacity}
          >
            <Text style={styles.templatePillText}>{selectedTemplateLabel}</Text>
            <Text style={styles.templatePillArrow}>▾</Text>
          </TouchableOpacity>
          <Text style={styles.playerCount}>{totalCount}人</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setOverflowVisible((v) => !v)}
          activeOpacity={fixed.activeOpacity}
          testID={TESTIDS.configMoreButton}
          accessibilityLabel="更多选项"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Overflow popup menu */}
      {overflowVisible && (
        <>
          <TouchableOpacity
            style={styles.overflowMenuOverlay}
            activeOpacity={1}
            onPress={() => setOverflowVisible(false)}
          />
          <View style={styles.overflowMenu}>
            <TouchableOpacity
              style={styles.overflowMenuItem}
              onPress={() => {
                setOverflowVisible(false);
                handleClearSelection();
              }}
              testID={TESTIDS.configOverflowReset}
              accessibilityLabel="重置配置"
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color={colors.text}
                style={styles.overflowMenuItemIcon}
              />
              <Text style={styles.overflowMenuItemText}>重置配置</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.overflowMenuItem}
              onPress={() => {
                setOverflowVisible(false);
                handleOpenSettings();
              }}
              testID={TESTIDS.configOverflowSettings}
              accessibilityLabel="设置"
            >
              <Ionicons
                name="settings-outline"
                size={18}
                color={colors.text}
                style={styles.overflowMenuItemIcon}
              />
              <Text style={styles.overflowMenuItemText}>设置</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Card A — faction tabs */}
      <View style={styles.cardA}>
        {/* Faction Tab Bar */}
        <FactionTabs
          tabs={tabItems}
          activeKey={activeTab}
          onTabPress={handleTabPress}
          styles={styles}
        />
      </View>

      {isLoading ? (
        <LoadingScreen message="加载中…" fullScreen={false} />
      ) : (
        <>
          {/* Active tab content */}
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Card B — stepper + role sections */}
            <View style={styles.cardB}>
              {activeGroup.sections.map((section, index) => {
                const sectionFaction = section.faction ?? activeGroup.faction;
                const sectionAccentColor = getFactionAccentColor(sectionFaction);

                // Bulk slot → RoleStepper
                const bulkSlot = section.roles.find((s) => s.isBulk);
                if (bulkSlot) {
                  const maxCount = bulkSlot.count ?? 1;
                  const currentCount = getBulkCount(bulkSlot.roleId, maxCount);
                  const spec = ROLE_SPECS[bulkSlot.roleId as keyof typeof ROLE_SPECS];
                  return (
                    <React.Fragment key={section.title}>
                      <RoleStepper
                        roleId={bulkSlot.roleId}
                        label={spec?.displayName ?? bulkSlot.roleId}
                        count={currentCount}
                        maxCount={maxCount}
                        onCountChange={handleBulkCountChange}
                        styles={styles}
                        accentColor={sectionAccentColor}
                      />
                      {index < activeGroup.sections.length - 1 && (
                        <View style={styles.cardBDivider} />
                      )}
                    </React.Fragment>
                  );
                }

                // Skill slots → Section + RoleChips
                const sectionFactionColorKey = FACTION_COLOR_MAP[sectionFaction] ?? 'villager';
                return (
                  <React.Fragment key={section.title}>
                    {index > 0 && <View style={styles.cardBDivider} />}
                    <Section title={section.title} styles={styles}>
                      {section.roles
                        .flatMap((slot) => expandSlotToChipEntries(slot, variantOverrides))
                        .map((entry) => (
                          <RoleChip
                            key={entry.key}
                            id={entry.key}
                            label={entry.label}
                            selected={!!selection[entry.key]}
                            onToggle={toggleRole}
                            styles={styles}
                            factionColor={sectionFactionColorKey}
                            accentColor={sectionAccentColor}
                            hasVariants={entry.hasVariants}
                            onInfoPress={handleChipInfoPress}
                          />
                        ))}
                    </Section>
                  </React.Fragment>
                );
              })}
            </View>
          </ScrollView>
        </>
      )}

      {/* Bottom Create Button */}
      <View style={styles.bottomCreateBar}>
        <Text style={styles.cardBFooterHint}>长按角色查看技能说明{'\n'}粗边框角色可切换子角色</Text>
        <TouchableOpacity
          style={[styles.bottomCreateBtn, isDisabled && styles.bottomCreateBtnDisabled]}
          onPress={handleCreateRoom}
          activeOpacity={isDisabled ? 1 : fixed.activeOpacity}
          accessibilityState={{ disabled: isDisabled }}
        >
          {isCreating ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Text style={styles.bottomCreateBtnText}>{isEditMode ? '保存配置' : '创建房间'}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Settings Sheet (Animation + BGM) */}
      <SettingsSheet
        visible={settingsSheetVisible}
        onClose={handleCloseSettings}
        roleRevealAnimation={roleRevealAnimation}
        bgmValue={bgmEnabled ? 'on' : 'off'}
        onAnimationChange={handleAnimationChange}
        onBgmChange={handleBgmChange}
        animationTestIDPrefix={TESTIDS.configAnimation}
        bgmTestIDPrefix={TESTIDS.configBgm}
        overlayTestID={TESTIDS.configSettingsOverlay}
      />

      {/* Template Dropdown Modal */}
      <TemplatePicker
        visible={templateDropdownVisible}
        onClose={handleCloseTemplateDropdown}
        selectedValue={selectedTemplate}
        onSelect={handleSelectTemplate}
        styles={styles}
      />

      {/* Role Info Card (long-press any chip → card with variant pills) */}
      <RoleCardSimple
        visible={roleInfoId !== null}
        roleId={roleInfoId as RoleId | null}
        onClose={handleCloseRoleInfo}
        showRealIdentity
        variantIds={roleInfoVariantIds}
        activeVariant={roleInfoActiveVariant}
        onVariantSelect={handleRoleInfoVariantSelect}
      />
    </SafeAreaView>
  );
};
