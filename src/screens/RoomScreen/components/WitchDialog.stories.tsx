/**
 * WitchDialog.stories.tsx - Stories for witch action dialogs
 * 
 * Shows the different witch interaction states:
 * - Save phase (someone was killed)
 * - Poison phase (choosing to poison)
 * - Already used potions
 */

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Witch Save Dialog
// ─────────────────────────────────────────────────────────────────────────────

interface WitchSaveDialogProps {
  killedSeat: number;
  hasSavePotion: boolean;
  isSelfKilled: boolean;
  onSave?: () => void;
  onSkip?: () => void;
}

const WitchSaveDialog: React.FC<WitchSaveDialogProps> = ({
  killedSeat,
  hasSavePotion,
  isSelfKilled,
  onSave,
  onSkip,
}) => {
  const canSave = hasSavePotion && !isSelfKilled;
  
  return (
    <View style={styles.dialog}>
      <Text style={styles.title}>🧪 女巫 - 解药</Text>
      <View style={styles.divider} />
      
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          今晚 <Text style={styles.highlight}>{killedSeat}号</Text> 玩家被杀
        </Text>
        {isSelfKilled && (
          <Text style={styles.warningText}>（就是你自己）</Text>
        )}
      </View>
      
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>解药状态：</Text>
        <Text style={[styles.statusValue, !hasSavePotion && styles.used]}>
          {hasSavePotion ? '✅ 可用' : '❌ 已用'}
        </Text>
      </View>
      
      <View style={styles.buttonRow}>
        {canSave && (
          <TouchableOpacity style={styles.saveButton} onPress={onSave}>
            <Text style={styles.buttonText}>救人</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.buttonText}>不救</Text>
        </TouchableOpacity>
      </View>
      
      {isSelfKilled && hasSavePotion && (
        <Text style={styles.noteText}>
          注：自救规则由房主设定，此处展示不可自救
        </Text>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Witch Poison Dialog
// ─────────────────────────────────────────────────────────────────────────────

interface WitchPoisonDialogProps {
  hasPoisonPotion: boolean;
  onSelectTarget?: () => void;
  onSkip?: () => void;
}

const WitchPoisonDialog: React.FC<WitchPoisonDialogProps> = ({
  hasPoisonPotion,
  onSelectTarget,
  onSkip,
}) => (
  <View style={styles.dialog}>
    <Text style={styles.title}>☠️ 女巫 - 毒药</Text>
    <View style={styles.divider} />
    
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>毒药状态：</Text>
      <Text style={[styles.statusValue, !hasPoisonPotion && styles.used]}>
        {hasPoisonPotion ? '✅ 可用' : '❌ 已用'}
      </Text>
    </View>
    
    <Text style={styles.promptText}>
      {hasPoisonPotion 
        ? '是否使用毒药？点击座位选择目标'
        : '毒药已使用'}
    </Text>
    
    <View style={styles.buttonRow}>
      <TouchableOpacity 
        style={[styles.skipButton, { flex: 1 }]} 
        onPress={onSkip}
      >
        <Text style={styles.buttonText}>不毒</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Witch Poison Confirm Dialog
// ─────────────────────────────────────────────────────────────────────────────

interface WitchPoisonConfirmProps {
  targetSeat: number;
  onConfirm?: () => void;
  onCancel?: () => void;
}

const WitchPoisonConfirm: React.FC<WitchPoisonConfirmProps> = ({
  targetSeat,
  onConfirm,
  onCancel,
}) => (
  <View style={styles.dialog}>
    <Text style={styles.title}>☠️ 确认毒杀</Text>
    <View style={styles.divider} />
    
    <Text style={styles.confirmText}>
      确定要毒死 <Text style={styles.highlight}>{targetSeat}号</Text> 玩家吗？
    </Text>
    
    <View style={styles.buttonRow}>
      <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.buttonText}>取消</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.poisonButton} onPress={onConfirm}>
        <Text style={styles.buttonText}>确认毒杀</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Witch Info Dialog (no potions / peaceful night)
// ─────────────────────────────────────────────────────────────────────────────

interface WitchInfoDialogProps {
  message: string;
  hasSavePotion: boolean;
  hasPoisonPotion: boolean;
  onDismiss?: () => void;
}

const WitchInfoDialog: React.FC<WitchInfoDialogProps> = ({
  message,
  hasSavePotion,
  hasPoisonPotion,
  onDismiss,
}) => (
  <View style={styles.dialog}>
    <Text style={styles.title}>🧪 女巫</Text>
    <View style={styles.divider} />
    
    <Text style={styles.infoText}>{message}</Text>
    
    <View style={styles.potionStatus}>
      <Text style={styles.statusLabel}>药水状态：</Text>
      <View style={styles.potionRow}>
        <Text style={[styles.potionBadge, hasSavePotion ? styles.available : styles.used]}>
          解药 {hasSavePotion ? '✅' : '❌'}
        </Text>
        <Text style={[styles.potionBadge, hasPoisonPotion ? styles.available : styles.used]}>
          毒药 {hasPoisonPotion ? '✅' : '❌'}
        </Text>
      </View>
    </View>
    
    <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
      <Text style={styles.buttonText}>知道了</Text>
    </TouchableOpacity>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  dialog: {
    width: 320,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 16,
  },
  infoBox: {
    backgroundColor: '#374151',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    marginBottom: 16,
  },
  infoText: {
    color: '#D1D5DB',
    fontSize: 14,
    textAlign: 'center',
  },
  highlight: {
    color: '#F59E0B',
    fontWeight: 'bold',
  },
  warningText: {
    color: '#EF4444',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  statusValue: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: 'bold',
  },
  used: {
    color: '#EF4444',
  },
  promptText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  confirmText: {
    color: '#D1D5DB',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  skipButton: {
    flex: 1,
    backgroundColor: '#6B7280',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#6B7280',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  poisonButton: {
    flex: 1,
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dismissButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noteText: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 12,
    textAlign: 'center',
  },
  potionStatus: {
    width: '100%',
    marginBottom: 16,
  },
  potionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  potionBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    fontSize: 12,
    overflow: 'hidden',
  },
  available: {
    backgroundColor: '#166534',
    color: '#fff',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Meta & Stories
// ─────────────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'RoomScreen/WitchDialog',
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
};

export default meta;

// Save Phase Stories
export const SavePhaseCanSave: StoryObj<typeof WitchSaveDialog> = {
  name: '💊 Save - 可以救人',
  render: () => (
    <WitchSaveDialog 
      killedSeat={3} 
      hasSavePotion={true} 
      isSelfKilled={false}
      onSave={() => alert('救人')}
      onSkip={() => alert('不救')}
    />
  ),
};

export const SavePhaseSelfKilled: StoryObj<typeof WitchSaveDialog> = {
  name: '💊 Save - 自刀（不可自救）',
  render: () => (
    <WitchSaveDialog 
      killedSeat={5} 
      hasSavePotion={true} 
      isSelfKilled={true}
      onSkip={() => alert('不救')}
    />
  ),
};

export const SavePhaseNoPotion: StoryObj<typeof WitchSaveDialog> = {
  name: '💊 Save - 解药已用',
  render: () => (
    <WitchSaveDialog 
      killedSeat={7} 
      hasSavePotion={false} 
      isSelfKilled={false}
      onSkip={() => alert('不救')}
    />
  ),
};

// Poison Phase Stories
export const PoisonPhaseCanPoison: StoryObj<typeof WitchPoisonDialog> = {
  name: '☠️ Poison - 可以用毒',
  render: () => (
    <WitchPoisonDialog 
      hasPoisonPotion={true}
      onSelectTarget={() => alert('选择目标')}
      onSkip={() => alert('不毒')}
    />
  ),
};

export const PoisonPhaseNoPotion: StoryObj<typeof WitchPoisonDialog> = {
  name: '☠️ Poison - 毒药已用',
  render: () => (
    <WitchPoisonDialog 
      hasPoisonPotion={false}
      onSkip={() => alert('不毒')}
    />
  ),
};

// Poison Confirm
export const PoisonConfirm: StoryObj<typeof WitchPoisonConfirm> = {
  name: '☠️ Poison Confirm - 确认毒杀',
  render: () => (
    <WitchPoisonConfirm 
      targetSeat={4}
      onConfirm={() => alert('确认')}
      onCancel={() => alert('取消')}
    />
  ),
};

// Info Dialog Stories
export const InfoPeacefulNight: StoryObj<typeof WitchInfoDialog> = {
  name: 'ℹ️ Info - 平安夜',
  render: () => (
    <WitchInfoDialog 
      message="今晚是平安夜，没有人被杀"
      hasSavePotion={true}
      hasPoisonPotion={true}
      onDismiss={() => alert('知道了')}
    />
  ),
};

export const InfoNoPotions: StoryObj<typeof WitchInfoDialog> = {
  name: 'ℹ️ Info - 两药皆空',
  render: () => (
    <WitchInfoDialog 
      message="你已经没有药水了"
      hasSavePotion={false}
      hasPoisonPotion={false}
      onDismiss={() => alert('知道了')}
    />
  ),
};
