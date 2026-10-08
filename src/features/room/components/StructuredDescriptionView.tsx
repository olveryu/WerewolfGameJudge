/**
 * StructuredDescriptionView - 游戏无关的结构化描述渲染组件。
 *
 * 从狼人杀 RoleDescriptionView 逐行移植，仅替换数据源：
 * - RoleDescription → readonly DescriptionField[]
 * - FIELD_ORDER/FIELD_LABELS/FIELD_ICON_NAMES → 调用方在 DescriptionField 中提供
 * - 字段语义色（restriction=warning, winCondition=success）→ DescriptionField.tone
 *
 * 两种布局模式：Mode A（单字段居中）/ Mode B（多字段，图标+标签+左 accent bar）。
 * 中文分号自动拆 bullet。无业务逻辑。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type ThemeColors, typography, withAlpha } from '@/theme';

import type { DescriptionField } from '../model/RevealRoleData';

// ─── Constants ───────────────────────────────────────────────

/** Icon size for field labels (matches captionSmall) */
const FIELD_ICON_SIZE = 10;

/** Left accent bar width (fixed, not scaled — too thin to benefit from scaling) */
const ACCENT_BAR_WIDTH = 2;

/** Accent bar opacity applied to the faction color */
const ACCENT_BAR_OPACITY = 0.3;

/** Fade mask height at bottom of scrollable content */
const FADE_MASK_HEIGHT = 12;

/** Fallback icon when field.icon is not provided */
const FALLBACK_ICON_NAME: React.ComponentProps<typeof Ionicons>['name'] =
  'information-circle-outline';

// ─── Types ───────────────────────────────────────────────────

interface StructuredDescriptionViewProps {
  /** Structured description fields (from adapter) */
  readonly fields: readonly DescriptionField[] | undefined;
  /** Flat text fallback when fields is empty/undefined */
  readonly descriptionFallback: string;
  /** Faction color for accent bar */
  readonly factionColor: string;
  /** Enable internal scrolling (default true). Set false when embedded in an outer ScrollView. */
  readonly scrollEnabled?: boolean;
  /** Mode A 章节标题，缺省 '技能介绍'。 */
  readonly modeATitle?: string;
}

// ─── Helpers ─────────────────────────────────────────────────

/** Split Chinese-semicolon separated text into bullet items */
function splitBullets(text: string): readonly string[] {
  const parts = text.split('；').filter((s) => s.length > 0);
  return parts;
}

/** Resolve accent bar color per field tone */
function getFieldAccentColor(
  tone: DescriptionField['tone'],
  factionColor: string,
  colors: ThemeColors,
): string {
  switch (tone) {
    case 'warning':
      return withAlpha(colors.warning, ACCENT_BAR_OPACITY);
    case 'success':
      return withAlpha(colors.success, ACCENT_BAR_OPACITY);
    default:
      return withAlpha(factionColor, ACCENT_BAR_OPACITY);
  }
}

/** Resolve label text color per field tone */
function getFieldLabelColor(tone: DescriptionField['tone'], colors: ThemeColors): string {
  switch (tone) {
    case 'warning':
      return colors.warning;
    case 'success':
      return colors.success;
    default:
      return colors.textSecondary;
  }
}

// ─── Sub-components ──────────────────────────────────────────

/** Mode A: single-field centered layout */
const ModeA: React.FC<{
  text: string;
  title: string;
  testID?: string;
  colors: ThemeColors;
}> = ({ text, title, testID, colors }) => {
  const styles = useMemo(() => createStyles(colors, ''), [colors]);
  return (
    <>
      <Text style={styles.modeATitle}>{title}</Text>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContentCenter}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.modeAText} testID={testID}>
          {text}
        </Text>
      </ScrollView>
    </>
  );
};

/** A single section in Mode B (icon + label + accent bar + body text with optional bullets) */
const DescriptionSection: React.FC<{
  readonly field: DescriptionField;
  readonly accentColor: string;
  readonly labelColor: string;
  readonly colors: ThemeColors;
  readonly isLast: boolean;
}> = ({ field, accentColor, labelColor, colors, isLast }) => {
  const styles = useMemo(() => createStyles(colors, accentColor), [colors, accentColor]);
  const bullets = splitBullets(field.content);
  const useBullets = bullets.length > 1;
  const iconName = field.icon ?? FALLBACK_ICON_NAME;

  return (
    <View style={[styles.sectionRow, !isLast && styles.sectionGap]} testID={field.testID}>
      <View style={styles.accentBar} />
      <View style={styles.sectionContent}>
        <View style={styles.labelRow}>
          <Ionicons name={iconName} size={FIELD_ICON_SIZE} color={labelColor} />
          <Text style={[styles.sectionLabel, { color: labelColor }]}>{field.label}</Text>
        </View>
        {useBullets ? (
          bullets.map((item, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.sectionText}>{item}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.sectionText}>{field.content}</Text>
        )}
      </View>
    </View>
  );
};

// ─── Main Component ──────────────────────────────────────────

export const StructuredDescriptionView: React.FC<StructuredDescriptionViewProps> = ({
  fields,
  descriptionFallback,
  factionColor,
  scrollEnabled = true,
  modeATitle = '技能介绍',
}) => {
  const validFields = useMemo(() => {
    if (!fields) return null;
    const entries = fields.filter((f) => f.content.length > 0);
    return entries.length > 0 ? entries : null;
  }, [fields]);

  const isModeA = !validFields || validFields.length <= 1;

  if (isModeA) {
    // Single field → use that field's text, or fallback
    const firstField = validFields?.[0];
    const text = firstField?.content ?? descriptionFallback;
    return <ModeA text={text} title={modeATitle} testID={firstField?.testID} colors={colors} />;
  }

  // Mode B: structured sections with scroll + fade mask
  const sectionElements = validFields.map((field, i) => (
    <DescriptionSection
      key={`${field.label}-${i}`}
      field={field}
      accentColor={getFieldAccentColor(field.tone, factionColor, colors)}
      labelColor={getFieldLabelColor(field.tone, colors)}
      colors={colors}
      isLast={i === validFields.length - 1}
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
      <LinearGradient colors={['transparent', colors.surface]} style={fadeMask} />
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
  pointerEvents: 'none' as const,
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
