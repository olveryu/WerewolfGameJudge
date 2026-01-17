import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';

interface PromptModalProps {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  visible,
  title,
  message,
  placeholder = '',
  secureTextEntry = false,
  onCancel,
  onConfirm,
}) => {
  const [value, setValue] = useState('');

  // Reset value when modal opens
  useEffect(() => {
    if (visible) {
      setValue('');
    }
  }, [visible]);

  const handleConfirm = () => {
    onConfirm(value);
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.alertBox}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor="#888"
            secureTextEntry={secureTextEntry}
            autoFocus={true}
            onSubmitEditing={handleConfirm}
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
              <Text style={[styles.buttonText, styles.cancelButtonText]}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleConfirm}>
              <Text style={styles.buttonText}>确认</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBox: {
    backgroundColor: '#2a2a2a',
    borderRadius: 14,
    padding: 20,
    minWidth: 300,
    maxWidth: Dimensions.get('window').width * 0.85,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    color: '#fff',
    fontSize: 16,
    padding: 12,
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#ccc',
  },
});

export default PromptModal;
