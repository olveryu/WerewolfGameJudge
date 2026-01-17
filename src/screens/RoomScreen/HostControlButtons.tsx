/**
 * HostControlButtons - Host-only control buttons for RoomScreen
 * 
 * This component only handles button rendering based on visibility flags.
 * All business logic, dialogs, and service calls remain in RoomScreen.
 */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { styles } from './RoomScreen.styles';

export interface HostControlButtonsProps {
  // Visibility flags
  isHost: boolean;
  showSettings: boolean;
  showPrepareToFlip: boolean;
  showStartGame: boolean;
  showLastNightInfo: boolean;
  showRestart: boolean;
  /** When true, restart button shows as yellow (warning) for emergency restart during ongoing game */
  isEmergencyRestart?: boolean;
  
  // Button press handlers (parent provides dialog/logic)
  onSettingsPress: () => void;
  onPrepareToFlipPress: () => void;
  onStartGamePress: () => void;
  onLastNightInfoPress: () => void;
  onRestartPress: () => void;
}

export const HostControlButtons: React.FC<HostControlButtonsProps> = ({
  isHost,
  showSettings,
  showPrepareToFlip,
  showStartGame,
  showLastNightInfo,
  showRestart,
  isEmergencyRestart = false,
  onSettingsPress,
  onPrepareToFlipPress,
  onStartGamePress,
  onLastNightInfoPress,
  onRestartPress,
}) => {
  if (!isHost) return null;
  
  return (
    <>
      {/* Host: Settings */}
      {showSettings && (
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: '#3B82F6' }]} 
          onPress={onSettingsPress}
        >
          <Text style={styles.buttonText}>⚙️ 设置</Text>
        </TouchableOpacity>
      )}

      {/* Host: Prepare to Flip */}
      {showPrepareToFlip && (
        <TouchableOpacity style={styles.actionButton} onPress={onPrepareToFlipPress}>
          <Text style={styles.buttonText}>准备看牌</Text>
        </TouchableOpacity>
      )}
      
      {/* Host: Start Game */}
      {showStartGame && (
        <TouchableOpacity style={styles.actionButton} onPress={onStartGamePress}>
          <Text style={styles.buttonText}>开始游戏</Text>
        </TouchableOpacity>
      )}
      
      {/* Host: View Last Night Info */}
      {showLastNightInfo && (
        <TouchableOpacity style={styles.actionButton} onPress={onLastNightInfoPress}>
          <Text style={styles.buttonText}>查看昨晚信息</Text>
        </TouchableOpacity>
      )}
      
      {/* Host: Restart Game */}
      {showRestart && (
        <TouchableOpacity 
          style={[
            styles.actionButton, 
            isEmergencyRestart && { backgroundColor: '#F59E0B' }  // Yellow for emergency restart
          ]} 
          onPress={onRestartPress}
        >
          <Text style={styles.buttonText}>重新开始</Text>
        </TouchableOpacity>
      )}
    </>
  );
};

export default HostControlButtons;
