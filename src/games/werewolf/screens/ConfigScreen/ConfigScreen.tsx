/**
 * ConfigScreen - Game configuration and room creation (Render-only)
 *
 * Role list is data-driven from FACTION_GROUPS + ROLE_SPECS.
 * All state/callbacks come from the useConfigScreenState hook.
 * Pure-function helpers live in configHelpers.ts.
 * No hardcoded style values; no console.*.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { ROLE_SPECS } from '@game-judge/game-engine/games/werewolf/public';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { GameScreen, GameScreenFooter, gameScreenStyles } from '@/components/GameScreen';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useServices } from '@/contexts/ServiceContext';
import { RoleCardSimple } from '@/games/werewolf/components/RoleCardSimple';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import type { WerewolfConfigStackParamList } from '@/games/werewolf/navigation/types';
import { askAIAboutRole } from '@/games/werewolf/services/aiChatBridge';
import { isAIChatReady } from '@/games/werewolf/services/AIChatService';
import { TESTIDS } from '@/testids';
import { colors, componentSizes } from '@/theme';

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

type NavigationProp = NativeStackNavigationProp<WerewolfConfigStackParamList, 'Config'>;
type ConfigRouteProp = RouteProp<WerewolfConfigStackParamList, 'Config'>;

interface ConfigScreenProps {
  readonly session: WerewolfRoomSession;
  readonly onExitFlow: () => void;
  readonly onReturnToRoom: (roomCode: string) => void;
}

/** Role configuration screen; the Rules step that follows owns create/save. */
export const ConfigScreen: React.FC<ConfigScreenProps> = ({
  session,
  onExitFlow,
  onReturnToRoom,
}) => {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createConfigScreenStyles(colors), []);

  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ConfigRouteProp>();
  const existingRoomCode = route.params?.existingRoomCode;
  const presetName = route.params?.presetName;
  const nominateMode = route.params?.nominateMode;
  const updatedRules = route.params?.updatedRules;

  const { settingsService } = useServices();

  const state = useConfigScreenState({
    existingRoomCode,
    presetName,
    nominateMode,
    updatedRules,
    navigation,
    session,
    settingsService,
    onExitFlow,
    onReturnToRoom,
  });

  const {
    isNominateMode,
    isDisabled,
    isLoading,
    isSubmitting,
    selection,
    totalCount,
    variantOverrides,
    handleGoBack,
    handleTemplatePillPress,
    handleContinue,
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
    <GameScreen
      testID={TESTIDS.configScreenRoot}
      header={
        <ScreenHeader
          topInset={insets.top}
          onBack={handleGoBack}
          backTestID={TESTIDS.configBackButton}
          title={
            <View style={styles.headerCenter}>
              <TouchableOpacity
                style={styles.templatePill}
                activeOpacity={0.7}
                onPress={handleTemplatePillPress}
                testID={TESTIDS.configTemplatePill}
                accessibilityRole="button"
                accessibilityLabel={`选择板子：${selectedTemplateLabel}`}
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
          }
          headerRight={
            <Button
              variant="icon"
              onPress={handleClearSelection}
              testID={TESTIDS.configOverflowReset}
              accessibilityLabel="重置配置"
            >
              <Ionicons name="trash-outline" size={componentSizes.icon.md} color={colors.text} />
            </Button>
          }
        />
      }
    >
      <View style={gameScreenStyles.catalog}>
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
                {activeGroup!.sections.map((section, index) => {
                  const sectionFaction = section.faction ?? activeGroup!.faction;
                  const sectionAccentColor = getFactionAccentColor(sectionFaction);

                  // Bulk slot -> RoleStepper
                  const bulkSlot = section.roles.find((s) => s.isBulk);
                  if (bulkSlot) {
                    const maxCount = bulkSlot.count ?? 1;
                    const currentCount = getBulkCount(bulkSlot.roleId, maxCount);
                    const spec = ROLE_SPECS[bulkSlot.roleId];
                    return (
                      <React.Fragment key={section.title}>
                        <RoleStepper
                          roleId={bulkSlot.roleId}
                          label={spec.displayName}
                          count={currentCount}
                          maxCount={maxCount}
                          onCountChange={handleBulkCountChange}
                          styles={styles}
                          accentColor={sectionAccentColor}
                        />
                        {index < activeGroup!.sections.length - 1 && (
                          <View style={styles.cardBDivider} />
                        )}
                      </React.Fragment>
                    );
                  }

                  // Skill slots -> Section + RoleChips
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
      </View>
      <GameScreenFooter>
        <Text style={styles.cardBFooterHint}>已选 {totalCount} 人</Text>
        <Button
          variant="primary"
          size="lg"
          onPress={() => {
            void handleContinue();
          }}
          disabled={isDisabled}
          loading={isSubmitting}
          testID={TESTIDS.configNextButton}
        >
          {isNominateMode ? '提交建议' : '下一步：规则'}
        </Button>
      </GameScreenFooter>

      {/* Role Info Card (long-press any chip → card with variant pills) */}
      <RoleCardSimple
        visible={roleInfoId !== null}
        roleId={roleInfoId}
        onClose={handleCloseRoleInfo}
        showRealIdentity
        variantIds={roleInfoVariantIds}
        activeVariant={roleInfoActiveVariant}
        onVariantSelect={handleRoleInfoVariantSelect}
        onAskAI={isAIChatReady() ? (rid) => askAIAboutRole(rid, handleCloseRoleInfo) : undefined}
      />
    </GameScreen>
  );
};
