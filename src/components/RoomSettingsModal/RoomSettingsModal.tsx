import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { RoleName } from '../../constants/roles';
import { GameTemplate, PRESET_TEMPLATES, createCustomTemplate } from '../../models/Template';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';

interface Props {
  visible: boolean;
  currentTemplate: GameTemplate;
  onClose: () => void;
  onSave: (template: GameTemplate) => void;
}

// ============================================
// Sub-components
// ============================================

interface RoleChipProps {
  id: string;
  label: string;
  selected: boolean;
  onToggle: (id: string) => void;
}

const RoleChip: React.FC<RoleChipProps> = ({ id, label, selected, onToggle }) => (
  <TouchableOpacity
    style={[styles.chip, selected && styles.chipSelected]}
    onPress={() => onToggle(id)}
    activeOpacity={0.7}
  >
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
  </TouchableOpacity>
);

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.chipContainer}>{children}</View>
  </View>
);

// ============================================
// Helper functions
// ============================================

const getInitialSelection = (): Record<string, boolean> => ({
  wolf: false, wolf1: false, wolf2: false, wolf3: false, wolf4: false,
  wolfQueen: false, wolfKing: false, darkWolfKing: false, gargoyle: false, nightmare: false,
  bloodMoon: false, wolfRobot: false, spiritKnight: false,
  villager: false, villager1: false, villager2: false, villager3: false, villager4: false,
  seer: false, witch: false, hunter: false, guard: false, idiot: false,
  graveyardKeeper: false, slacker: false, knight: false,
  celebrity: false, magician: false,
  tree: false, witcher: false, psychic: false,
});

const selectionToRoles = (selection: Record<string, boolean>): RoleName[] => {
  const roles: RoleName[] = [];
  Object.entries(selection).forEach(([key, selected]) => {
    if (selected) {
      const roleName = key.replace(/\d+$/, '') as RoleName;
      roles.push(roleName);
    }
  });
  return roles;
};

const rolesToSelection = (roles: RoleName[]): Record<string, boolean> => {
  const selection = getInitialSelection();
  const roleCounts: Record<string, number> = {};
  
  roles.forEach((role) => {
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  });
  
  Object.entries(roleCounts).forEach(([role, count]) => {
    for (let i = 0; i < count; i++) {
      const key = i === 0 ? role : `${role}${i}`;
      if (key in selection) selection[key] = true;
    }
  });
  
  return selection;
};

const applyPreset = (presetRoles: RoleName[]): Record<string, boolean> => {
  return rolesToSelection(presetRoles);
};

// ============================================
// Main Component
// ============================================

export const RoomSettingsModal: React.FC<Props> = ({
  visible,
  currentTemplate,
  onClose,
  onSave,
}) => {
  const [selection, setSelection] = useState(() => 
    rolesToSelection(currentTemplate.roles)
  );

  // Reset selection when modal opens with new template
  useEffect(() => {
    if (visible) {
      setSelection(rolesToSelection(currentTemplate.roles));
    }
  }, [visible, currentTemplate]);

  const selectedCount = useMemo(() => 
    Object.values(selection).filter(Boolean).length,
    [selection]
  );

  const toggleRole = useCallback((key: string) => {
    setSelection((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handlePresetSelect = useCallback((presetName: string) => {
    const preset = PRESET_TEMPLATES.find((p) => p.name === presetName);
    if (preset) setSelection(applyPreset(preset.roles));
  }, []);

  const handleSave = useCallback(() => {
    const roles = selectionToRoles(selection);
    if (roles.length === 0) {
      return;
    }
    const template = createCustomTemplate(roles);
    onSave(template);
  }, [selection, onSave]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerBtn} onPress={onClose}>
              <Text style={styles.headerBtnText}>取消</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.title}>房间设置</Text>
              <Text style={styles.subtitle}>{selectedCount} 名玩家</Text>
            </View>
            <TouchableOpacity 
              style={[styles.headerBtn, styles.saveBtn, selectedCount === 0 && styles.disabledBtn]} 
              onPress={handleSave}
              disabled={selectedCount === 0}
            >
              <Text style={styles.saveBtnText}>保存</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Presets */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>快速模板</Text>
              <View style={styles.presetContainer}>
                {PRESET_TEMPLATES.map((preset) => (
                  <TouchableOpacity
                    key={preset.name}
                    style={styles.presetBtn}
                    onPress={() => handlePresetSelect(preset.name)}
                  >
                    <Text style={styles.presetText}>{preset.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Roles */}
            <View style={styles.card}>
              <Section title="🐺 狼人">
                <RoleChip id="wolf" label="普狼" selected={selection.wolf} onToggle={toggleRole} />
                <RoleChip id="wolf1" label="普狼" selected={selection.wolf1} onToggle={toggleRole} />
                <RoleChip id="wolf2" label="普狼" selected={selection.wolf2} onToggle={toggleRole} />
                <RoleChip id="wolf3" label="普狼" selected={selection.wolf3} onToggle={toggleRole} />
                <RoleChip id="wolf4" label="普狼" selected={selection.wolf4} onToggle={toggleRole} />
              </Section>

              <Section title="🎭 技能狼">
                <RoleChip id="wolfQueen" label="狼美人" selected={selection.wolfQueen} onToggle={toggleRole} />
                <RoleChip id="wolfKing" label="白狼王" selected={selection.wolfKing} onToggle={toggleRole} />
                <RoleChip id="darkWolfKing" label="黑狼王" selected={selection.darkWolfKing} onToggle={toggleRole} />
                <RoleChip id="gargoyle" label="石像鬼" selected={selection.gargoyle} onToggle={toggleRole} />
                <RoleChip id="nightmare" label="梦魇" selected={selection.nightmare} onToggle={toggleRole} />
                <RoleChip id="bloodMoon" label="血月使徒" selected={selection.bloodMoon} onToggle={toggleRole} />
                <RoleChip id="wolfRobot" label="机械狼" selected={selection.wolfRobot} onToggle={toggleRole} />
                <RoleChip id="spiritKnight" label="恶灵骑士" selected={selection.spiritKnight} onToggle={toggleRole} />
              </Section>

              <Section title="👤 村民">
                <RoleChip id="villager" label="村民" selected={selection.villager} onToggle={toggleRole} />
                <RoleChip id="villager1" label="村民" selected={selection.villager1} onToggle={toggleRole} />
                <RoleChip id="villager2" label="村民" selected={selection.villager2} onToggle={toggleRole} />
                <RoleChip id="villager3" label="村民" selected={selection.villager3} onToggle={toggleRole} />
                <RoleChip id="villager4" label="村民" selected={selection.villager4} onToggle={toggleRole} />
              </Section>

              <Section title="✨ 神职">
                <RoleChip id="seer" label="预言家" selected={selection.seer} onToggle={toggleRole} />
                <RoleChip id="witch" label="女巫" selected={selection.witch} onToggle={toggleRole} />
                <RoleChip id="hunter" label="猎人" selected={selection.hunter} onToggle={toggleRole} />
                <RoleChip id="guard" label="守卫" selected={selection.guard} onToggle={toggleRole} />
                <RoleChip id="idiot" label="白痴" selected={selection.idiot} onToggle={toggleRole} />
                <RoleChip id="graveyardKeeper" label="守墓人" selected={selection.graveyardKeeper} onToggle={toggleRole} />
                <RoleChip id="knight" label="骑士" selected={selection.knight} onToggle={toggleRole} />
                <RoleChip id="celebrity" label="摄梦人" selected={selection.celebrity} onToggle={toggleRole} />
                <RoleChip id="magician" label="魔术师" selected={selection.magician} onToggle={toggleRole} />
                <RoleChip id="witcher" label="猎魔人" selected={selection.witcher} onToggle={toggleRole} />
                <RoleChip id="psychic" label="通灵师" selected={selection.psychic} onToggle={toggleRole} />
              </Section>

              <Section title="🎲 特殊">
                <RoleChip id="slacker" label="混子" selected={selection.slacker} onToggle={toggleRole} />
              </Section>
            </View>

            <View style={{ height: spacing.xxl }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: {
    padding: spacing.sm,
  },
  headerBtnText: {
    color: colors.textSecondary,
    fontSize: typography.base,
  },
  headerCenter: {
    alignItems: 'center',
  },
  title: {
    fontSize: typography.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: typography.base,
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  card: {
    backgroundColor: colors.surface,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  cardTitle: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  presetContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  presetBtn: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetText: {
    fontSize: typography.sm,
    color: colors.text,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: typography.sm,
    color: colors.text,
  },
  chipTextSelected: {
    color: '#fff',
  },
});

export default RoomSettingsModal;
