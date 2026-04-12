/**
 * RoleDescriptionView - 角色技能描述结构化渲染组件
 *
 * 根据 RoleDescription 结构化数据渲染卡片技能描述区域。
 * 双模式布局：Mode A（单字段居中）/ Mode B（多字段带标签+左色条）。
 * 中文分号自动拆分为 bullet list。不含业务逻辑。
 */
import type { RoleDescription } from '@werewolf/game-engine/models/roles/spec/roleSpec.types';
import { LinearGradient } from 'expo-linear-gradient';
import { Ban, Crosshair, Shield, Star, Trophy, Zap } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type ThemeColors, typography, withAlpha } from '@/theme';

// ─── Constants ───────────────────────────────────────────────

/** Ordered field keys matching the designed display sequence */
const FIELD_ORDER: readonly (keyof RoleDescription)[] = [
  'skill',
  'passive',
  'trigger',
  'restriction',
  'special',
  'winCondition',
] as const;

/** Chinese labels for each field */
const FIELD_LABELS: Record<keyof RoleDescription, string> = {
  skill: '主动技能',
  passive: '被动特性',
  trigger: '触发效果',
  restriction: '限制条件',
  special: '特殊规则',
  winCondition: '胜利条件',
};

/** Lucide icon components for quick visual scanning in Mode B */
const FIELD_ICONS: Record<
  keyof RoleDescription,
  React.ComponentType<{ size: number; color: string }>
> = {
  skill: Zap,
  passive: Shield,
  trigger: Crosshair,
  restriction: Ban,
  special: Star,
  winCondition: Trophy,
};

/** Icon size for field labels (matches captionSmall) */
const FIELD_ICON_SIZE = 10;

/** Left accent bar width (fixed, not scaled — too thin to benefit from scaling) */
const ACCENT_BAR_WIDTH = 2;

/** Accent bar opacity applied to the faction color */
const ACCENT_BAR_OPACITY = 0.3;

/** Fade mask height at bottom of scrollable content */
const FADE_MASK_HEIGHT = 12;

// ─── Types ───────────────────────────────────────────────────

interface RoleDescriptionViewProps {
  /** Structured description data */
  structuredDescription: RoleDescription | undefined;
  /** Flat text fallback (from RoleSpec.description) */
  descriptionFallback: string;
  /** Faction color for accent bar */
  factionColor: string;
  /** Enable internal scrolling (default true). Set false when embedded in an outer ScrollView. */
  scrollEnabled?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────

/** Split Chinese-semicolon separated text into bullet items */
function splitBullets(text: string): readonly string[] {
  const parts = text.split('；').filter((s) => s.length > 0);
  return parts;
}

/** Count non-undefined fields */
function countFields(desc: RoleDescription): number {
  return FIELD_ORDER.filter((key) => desc[key] != null).length;
}

/** Resolve accent bar color per field type */
function getFieldAccentColor(
  fieldKey: keyof RoleDescription,
  factionColor: string,
  colors: ThemeColors,
): string {
  switch (fieldKey) {
    case 'restriction':
      return withAlpha(colors.warning, ACCENT_BAR_OPACITY);
    case 'winCondition':
      return withAlpha(colors.success, ACCENT_BAR_OPACITY);
    default:
      return withAlpha(factionColor, ACCENT_BAR_OPACITY);
  }
}

/** Resolve label text color per field type */
function getFieldLabelColor(fieldKey: keyof RoleDescription, colors: ThemeColors): string {
  switch (fieldKey) {
    case 'restriction':
      return colors.warning;
    case 'winCondition':
      return colors.success;
    default:
      return colors.textSecondary;
  }
}

// ─── Sub-components ──────────────────────────────────────────

/** Mode A: single-field centered layout */
const ModeA: React.FC<{ text: string; colors: ThemeColors }> = ({ text, colors }) => {
  const styles = useMemo(() => createStyles(colors, ''), [colors]);
  return (
    <>
      <Text style={styles.modeATitle}>技能介绍</Text>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContentCenter}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.modeAText}>{text}</Text>
      </ScrollView>
    </>
  );
};

/** A single section in Mode B (icon + label + accent bar + body text with optional bullets) */
const DescriptionSection: React.FC<{
  fieldKey: keyof RoleDescription;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  text: string;
  accentColor: string;
  labelColor: string;
  colors: ThemeColors;
  isLast: boolean;
}> = ({ label, icon, text, accentColor, labelColor, isLast }) => {
  const styles = useMemo(() => createStyles(colors, accentColor), [accentColor]);
  const bullets = splitBullets(text);
  const useBullets = bullets.length > 1;
  const Icon = icon;

  return (
    <View style={[styles.sectionRow, !isLast && styles.sectionGap]}>
      <View style={styles.accentBar} />
      <View style={styles.sectionContent}>
        <View style={styles.labelRow}>
          <Icon size={FIELD_ICON_SIZE} color={labelColor} />
          <Text style={[styles.sectionLabel, { color: labelColor }]}>{label}</Text>
        </View>
        {useBullets ? (
          bullets.map((item, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.sectionText}>{item}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.sectionText}>{text}</Text>
        )}
      </View>
    </View>
  );
};

// ─── Main Component ──────────────────────────────────────────

export const RoleDescriptionView: React.FC<RoleDescriptionViewProps> = ({
  structuredDescription,
  descriptionFallback,
  factionColor,
  scrollEnabled = true,
}) => {
  // Determine rendering mode
  const fields = useMemo(() => {
    if (!structuredDescription) return null;
    const entries: { key: keyof RoleDescription; label: string; text: string }[] = [];
    for (const key of FIELD_ORDER) {
      const text = structuredDescription[key];
      if (text != null) {
        entries.push({ key, label: FIELD_LABELS[key], text });
      }
    }
    return entries.length > 0 ? entries : null;
  }, [structuredDescription]);

  const fieldCount = structuredDescription ? countFields(structuredDescription) : 0;
  const isModeA = !fields || fieldCount <= 1;

  if (isModeA) {
    // Single field → use that field's text, or fallback
    const text = fields?.[0]?.text ?? descriptionFallback;
    return <ModeA text={text} colors={colors} />;
  }

  // Mode B: structured sections with scroll + fade mask
  const sectionElements = fields.map((entry, i) => (
    <DescriptionSection
      key={entry.key}
      fieldKey={entry.key}
      label={entry.label}
      icon={FIELD_ICONS[entry.key]}
      text={entry.text}
      accentColor={getFieldAccentColor(entry.key, factionColor, colors)}
      labelColor={getFieldLabelColor(entry.key, colors)}
      colors={colors}
      isLast={i === fields.length - 1}
    />
  ));

  if (!scrollEnabled) {
    // Flat layout — let parent handle scrolling
    return <View style={modeBScrollContent}>{sectionElements}</View>;
  }

  return (
    <View style={modeBContainer}>
      <ScrollView
        style={modeBScroll}
        contentContainerStyle={modeBScrollContent}
        showsVerticalScrollIndicator
      >
        {sectionElements}
      </ScrollView>
      {/* Bottom fade mask to hint scrollable content */}
      <LinearGradient
        colors={['transparent', colors.surface]}
        style={fadeMask}
        pointerEvents="none"
      />
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────

/** Static styles that don't depend on theme */
const modeBContainer: View['props']['style'] = {
  flex: 1,
  width: '100%',
};

const modeBScroll: ScrollView['props']['style'] = {
  flex: 1,
};

const modeBScrollContent: View['props']['style'] = {
  paddingTop: spacing.tight,
  paddingBottom: FADE_MASK_HEIGHT + spacing.tight,
};

const fadeMask: View['props']['style'] = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: FADE_MASK_HEIGHT,
};

/** Theme-dependent styles factory */
function createStyles(colors: ThemeColors, accentColor: string) {
  return StyleSheet.create({
    // Mode A
    modeATitle: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
      marginBottom: spacing.tight,
      textAlign: 'center',
    },
    scrollView: {
      flex: 1,
      width: '100%',
    },
    scrollContentCenter: {
      alignItems: 'center',
    },
    modeAText: {
      fontSize: typography.body,
      lineHeight: typography.body * 1.5,
      color: colors.text,
      textAlign: 'center',
      paddingHorizontal: spacing.small,
    },

    // Mode B sections
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    sectionGap: {
      marginBottom: spacing.small,
    },
    accentBar: {
      width: ACCENT_BAR_WIDTH,
      backgroundColor: accentColor,
      borderRadius: 1,
      marginRight: spacing.tight + spacing.micro,
    },
    sectionContent: {
      flex: 1,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.micro,
    },
    sectionLabel: {
      fontSize: typography.captionSmall,
      lineHeight: typography.captionSmall * 1.4,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
      marginLeft: spacing.micro,
    },
    sectionText: {
      fontSize: typography.secondary,
      lineHeight: typography.secondary * 1.43,
      color: colors.text,
      flex: 1,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    bulletDot: {
      fontSize: typography.secondary,
      lineHeight: typography.secondary * 1.43,
      color: colors.textMuted,
      marginRight: spacing.tight,
    },
  });
}
