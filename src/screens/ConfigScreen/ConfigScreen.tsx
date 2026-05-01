/**
 * ConfigScreen - 游戏配置与房间创建（Render-only）
 *
 * 角色列表由 FACTION_GROUPS + ROLE_SPECS 数据驱动。
 * 所有状态/回调由 useConfigScreenState hook 提供。
 * 纯函数 helpers 在 configHelpers.ts。
 * 不使用硬编码样式值，不使用 console.*。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ROLE_SPECS, type RoleId } from '@werewolf/game-engine/models/roles';
import React, { useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { LoadingScreen } from '@/components/LoadingScreen';
import { RoleCardSimple } from '@/components/RoleCardSimple';
import { useGameFacade } from '@/contexts';
import { useServices } from '@/contexts/ServiceContext';
import { type RootStackParamList } from '@/navigation/types';
import { isAIChatReady } from '@/services/feature/AIChatService';
import { TESTIDS } from '@/testids';
import { colors, componentSizes, layout } from '@/theme';
import { askAIAboutRole } from '@/utils/aiChatBridge';

import {
  createConfigScreenStyles,
  FactionTabs,
  RoleChip,
  RoleStepper,
  Section,
} from './components';
import { expandSlotToChipEntries, FACTION_COLOR_MAP } from './configHelpers';
import { useConfigScreenState } from './useConfigScreenState';

// ============================================
// Main Component
// ============================================

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Config'>;
type ConfigRouteProp = RouteProp<RootStackParamList, 'Config'>;

export const ConfigScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createConfigScreenStyles(colors), []);

  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ConfigRouteProp>();
  const existingRoomCode = route.params?.existingRoomCode;
  const presetName = route.params?.presetName;
  const nominateMode = route.params?.nominateMode;

  const facade = useGameFacade();
  const { settingsService, authService } = useServices();

  const state = useConfigScreenState({
    existingRoomCode,
    presetName,
    nominateMode,
    navigation,
    facade,
    settingsService,
    authService,
  });

  const {
    isEditMode,
    isNominateMode,
    isDisabled,
    isLoading,
    isCreating,
    selection,
    totalCount,
    variantOverrides,
    handleGoBack,
    handleTemplatePillPress,
    handleCreateRoom,
    toggleRole,
    handleClearSelection,
    selectedTemplateLabel,
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
    <SafeAreaView
      style={styles.container}
      edges={['left', 'right']}
      testID={TESTIDS.configScreenRoot}
    >
      {/* Header row — ← | 预女猎白 12人 | ⋯ */}
      <View style={[styles.header, { paddingTop: insets.top + layout.headerPaddingV }]}>
        <Button variant="icon" onPress={handleGoBack} testID={TESTIDS.configBackButton}>
          <Ionicons name="chevron-back" size={componentSizes.icon.lg} color={colors.text} />
        </Button>
        <View style={styles.headerCenter}>
          <TouchableOpacity
            style={styles.templatePill}
            activeOpacity={0.7}
            onPress={handleTemplatePillPress}
            testID={TESTIDS.configTemplatePill}
          >
            <Text style={styles.templatePillText}>{selectedTemplateLabel}</Text>
            <Ionicons
              name="chevron-down"
              size={componentSizes.icon.xs}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
          <Text style={styles.playerCount}>{totalCount}人</Text>
        </View>
        <Button
          variant="icon"
          onPress={handleClearSelection}
          testID={TESTIDS.configOverflowReset}
          accessibilityLabel="重置配置"
        >
          <Ionicons name="trash-outline" size={componentSizes.icon.md} color={colors.text} />
        </Button>
      </View>

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
        <LoadingScreen message="加载中" fullScreen={false} />
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
      <View style={[styles.bottomCreateBar, insets.bottom > 0 && { paddingBottom: insets.bottom }]}>
        <Text style={styles.cardBFooterHint}>
          点击顶部板子名可重新选板{'\n'}点击增减角色 · 长按查看技能 · 粗边框可切换变体
        </Text>
        <Button
          variant="primary"
          onPress={() => {
            void handleCreateRoom();
          }}
          disabled={isDisabled}
          loading={isCreating}
        >
          {isNominateMode ? '提交建议' : isEditMode ? '保存配置' : '创建房间'}
        </Button>
      </View>

      {/* Role Info Card (long-press any chip → card with variant pills) */}
      <RoleCardSimple
        visible={roleInfoId !== null}
        roleId={roleInfoId as RoleId | null}
        onClose={handleCloseRoleInfo}
        showRealIdentity
        variantIds={roleInfoVariantIds}
        activeVariant={roleInfoActiveVariant}
        onVariantSelect={handleRoleInfoVariantSelect}
        onAskAI={isAIChatReady() ? (rid) => askAIAboutRole(rid, handleCloseRoleInfo) : undefined}
      />
    </SafeAreaView>
  );
};
