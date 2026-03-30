/**
 * TemplatePicker - 模板选择 Modal（SectionList + Accordion 卡片）
 *
 * 底部滑出 Modal，按分类分组展示预设模板。每张卡片支持折叠/展开查看
 * 完整角色阵营分布。顶部搜索框支持按模板名和角色名实时过滤。
 * 渲染 UI 并通过回调上报 onSelect，不 import service，不包含业务逻辑判断。
 */
import { Ionicons } from '@expo/vector-icons';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { PRESET_TEMPLATES, type PresetTemplate } from '@werewolf/game-engine/models/Template';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { RoleCardSimple } from '@/components/RoleCardSimple';
import { typography, useColors } from '@/theme';

import {
  filterTemplates,
  groupTemplatesByCategory,
  type TemplateSectionData,
} from '../configHelpers';
import { BoardTemplateCard } from './BoardTemplateCard';
import type { ConfigScreenStyles } from './styles';
import { createTemplatePickerStyles } from './templatePicker.styles';

// ─────────────────────────────────────────────────────────────────────────────

interface TemplatePickerProps {
  visible: boolean;
  onClose: () => void;
  selectedValue: string;
  onSelect: (value: string) => void;
  /** ConfigScreenStyles kept for backward compat in parent call-site */
  styles: ConfigScreenStyles;
}

export const TemplatePicker = memo(function TemplatePicker({
  visible,
  onClose,
  selectedValue,
  onSelect,
}: TemplatePickerProps) {
  // ── Local state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNames, setExpandedNames] = useState<Set<string>>(new Set());
  const [previewRoleId, setPreviewRoleId] = useState<RoleId | null>(null);

  const handleRolePress = useCallback((roleId: string) => {
    setPreviewRoleId(roleId as RoleId);
  }, []);

  const handlePreviewClose = useCallback(() => {
    setPreviewRoleId(null);
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TemplatePickerInner
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        expandedNames={expandedNames}
        setExpandedNames={setExpandedNames}
        selectedValue={selectedValue}
        onSelect={onSelect}
        onClose={onClose}
        onRolePress={handleRolePress}
      />
      <RoleCardSimple
        visible={previewRoleId !== null}
        roleId={previewRoleId}
        onClose={handlePreviewClose}
        showRealIdentity
      />
    </Modal>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Inner component — needs useColors() inside Modal render tree
// ─────────────────────────────────────────────────────────────────────────────

interface TemplatePickerInnerProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  expandedNames: Set<string>;
  setExpandedNames: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  onRolePress: (roleId: string) => void;
}

const TemplatePickerInner = memo(function TemplatePickerInner({
  searchQuery,
  setSearchQuery,
  expandedNames,
  setExpandedNames,
  selectedValue,
  onSelect,
  onClose,
  onRolePress,
}: TemplatePickerInnerProps) {
  const colors = useColors();
  const styles = useMemo(() => createTemplatePickerStyles(colors), [colors]);

  // ── Data pipeline ──
  const filtered = useMemo(() => filterTemplates(PRESET_TEMPLATES, searchQuery), [searchQuery]);
  const sections = useMemo(() => groupTemplatesByCategory(filtered), [filtered]);

  // ── Handlers ──
  const handleToggleExpand = useCallback(
    (name: string) => {
      setExpandedNames((prev) => {
        const next = new Set(prev);
        if (next.has(name)) {
          next.delete(name);
        } else {
          next.add(name);
        }
        return next;
      });
    },
    [setExpandedNames],
  );

  const handleSelect = useCallback(
    (name: string) => {
      onSelect(name);
    },
    [onSelect],
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  // ── Renderers ──
  const renderSectionHeader = useCallback(
    ({ section }: { section: TemplateSectionData }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>
    ),
    [styles],
  );

  const renderItem = useCallback(
    ({ item }: { item: PresetTemplate }) => (
      <BoardTemplateCard
        template={item}
        isSelected={item.name === selectedValue}
        isExpanded={expandedNames.has(item.name)}
        onToggleExpand={handleToggleExpand}
        onSelect={handleSelect}
        onRolePress={onRolePress}
        styles={styles}
      />
    ),
    [selectedValue, expandedNames, handleToggleExpand, handleSelect, onRolePress, styles],
  );

  const keyExtractor = useCallback((item: PresetTemplate) => item.name, []);

  const ListEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>没有匹配的模板</Text>
        <Button variant="ghost" onPress={handleClearSearch}>
          清除搜索
        </Button>
      </View>
    ),
    [styles, handleClearSearch],
  );

  // ── Selected template label for confirmation bar ──
  const selectedLabel =
    selectedValue === '__custom__'
      ? '自定义'
      : (PRESET_TEMPLATES.find((p) => p.name === selectedValue)?.name ?? selectedValue);

  return (
    <View style={styles.pickerOverlay}>
      {/* Backdrop — sibling of content so TextInput taps don't bubble here */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.pickerContent}>
        {/* Handle + Header */}
        <View style={styles.pickerHandle} />
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>选择模板</Text>
          <Button variant="icon" onPress={onClose} accessibilityLabel="关闭">
            <Ionicons
              name="close"
              size={typography.title}
              color={styles.pickerCloseBtnText.color as string}
            />
          </Button>
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={16}
            color={colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索模板或角色…"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity style={styles.searchClearBtn} onPress={handleClearSearch}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* SectionList */}
        <SectionList<PresetTemplate, TemplateSectionData>
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          ListEmptyComponent={ListEmptyComponent}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            selectedValue ? styles.sectionListContentWithBar : styles.sectionListContent
          }
        />

        {/* Confirmation bar */}
        {selectedValue && selectedValue !== '__custom__' && (
          <View style={styles.confirmationBar}>
            <Text style={styles.confirmationText} numberOfLines={1}>
              已选: {selectedLabel}
            </Text>
            <Button variant="primary" size="sm" onPress={onClose}>
              确认
            </Button>
          </View>
        )}
      </View>
    </View>
  );
});

TemplatePickerInner.displayName = 'TemplatePickerInner';
