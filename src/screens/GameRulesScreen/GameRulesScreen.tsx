/**
 * GameRulesScreen — Game rule overrides (modes + role rules)
 *
 * Displays toggleable house rules grouped by category (game modes vs role-specific rules).
 * Receives current rules via navigation params, returns modified rules on goBack.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { GameRuleOverrides } from '@werewolf/game-engine/models/Template';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type RootStackParamList } from '@/navigation/types';
import { borderRadius, colors, componentSizes, spacing, typography, withAlpha } from '@/theme';
import { showConfirmAlert } from '@/utils/alertPresets';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'GameRules'>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'GameRules'>;

interface RuleItemConfig {
  key: keyof GameRuleOverrides;
  icon: string;
  iconColor: string;
  label: string;
  description: string;
  /** If true, show confirm dialog before enabling */
  confirmOnEnable?: {
    title: string;
    message: string;
    confirmText: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule definitions (data-driven)
// ─────────────────────────────────────────────────────────────────────────────

const MODE_RULES: RuleItemConfig[] = [
  {
    key: 'isPlagueMode',
    icon: 'skull-outline',
    iconColor: colors.warning,
    label: '黑死病模式',
    description: '所有狼人牌暗中替换为平民，玩家看到的板子仍显示有狼',
    confirmOnEnable: {
      title: '💀 黑死病模式',
      message:
        '• 发牌时，所有狼人牌将暗中替换为平民\n• 玩家看到的板子配置仍显示有狼\n• 发牌后请由房主担任真人法官主持后续流程\n• 建议提前线下安排好"演员"',
      confirmText: '确认开启',
    },
  },
];

const ROLE_RULES: RuleItemConfig[] = [
  {
    key: 'witchCanSelfHeal',
    icon: 'flask-outline',
    iconColor: colors.god,
    label: '女巫可自救',
    description: '允许女巫对自己使用解药（默认规则：女巫不能自救）',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const GameRulesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const initialRules = route.params?.rules;

  const [rules, setRules] = useState<GameRuleOverrides>(initialRules ?? {});

  const handleToggle = useCallback(
    (item: RuleItemConfig) => {
      const currentValue = rules[item.key] ?? false;

      if (!currentValue && item.confirmOnEnable) {
        // Enabling with confirmation
        showConfirmAlert(
          item.confirmOnEnable.title,
          item.confirmOnEnable.message,
          () => {
            setRules((prev) => ({ ...prev, [item.key]: true }));
          },
          { confirmText: item.confirmOnEnable.confirmText },
        );
      } else {
        // Direct toggle
        setRules((prev) => ({ ...prev, [item.key]: !currentValue }));
      }
    },
    [rules],
  );

  // Custom header back button: saves rules and navigates back to Config
  React.useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.navigate('Config', { updatedRules: rules })}>
          <Ionicons name="chevron-back" size={componentSizes.icon.lg} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, rules]);

  const renderRuleItem = useCallback(
    (item: RuleItemConfig) => {
      const isEnabled = rules[item.key] ?? false;
      const trackColor = item.key === 'isPlagueMode' ? colors.warning : colors.primary;

      return (
        <View key={item.key} style={styles.ruleCard}>
          <View style={styles.ruleHeader}>
            <Ionicons
              name={item.icon as 'skull-outline'}
              size={componentSizes.icon.md}
              color={item.iconColor}
            />
            <Text style={styles.ruleLabel}>{item.label}</Text>
            <Switch
              value={isEnabled}
              onValueChange={() => handleToggle(item)}
              trackColor={{ false: colors.border, true: withAlpha(trackColor, 0.4) }}
              thumbColor={isEnabled ? trackColor : colors.textSecondary}
            />
          </View>
          <Text style={styles.ruleDescription}>{item.description}</Text>
        </View>
      );
    },
    [rules, handleToggle],
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Game Modes section */}
        <Text style={styles.sectionHeader}>游戏模式</Text>
        {MODE_RULES.map(renderRuleItem)}

        {/* Role Rules section */}
        <Text style={styles.sectionHeader}>角色规则</Text>
        {ROLE_RULES.map(renderRuleItem)}
      </ScrollView>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.medium,
    paddingBottom: spacing.xlarge,
  },
  sectionHeader: {
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginTop: spacing.medium,
    marginBottom: spacing.small,
    marginLeft: spacing.tight,
  },
  ruleCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.small,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  ruleLabel: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  ruleDescription: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.tight,
    marginLeft: componentSizes.icon.md + spacing.small,
    lineHeight: typography.caption * 1.5,
  },
});
