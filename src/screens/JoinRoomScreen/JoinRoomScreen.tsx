import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '../../components';
import { COLORS } from '../../constants';
import { SimplifiedRoomService } from '../../services/SimplifiedRoomService';
import { RootStackParamList } from '../../navigation/types';

type JoinRoomScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const JoinRoomScreen: React.FC = () => {
  const navigation = useNavigation<JoinRoomScreenNavigationProp>();
  const [roomNumber, setRoomNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (roomNumber.length !== 4) return;

    setLoading(true);
    setError(null);
    
    try {
      // Check if room exists using SimplifiedRoomService
      const roomService = SimplifiedRoomService.getInstance();
      const room = await roomService.getRoom(roomNumber);
      
      if (room) {
        // Room exists, navigate to RoomScreen (it will handle actual joining via useGameRoom)
        navigation.replace('Room', { roomNumber, isHost: false });
      } else {
        setError('房间不存在');
      }
    } catch {
      setError('加入房间失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>加入房间</Text>
        <Text style={styles.subtitle}>请输入4位数房间号</Text>

        <TextInput
          style={styles.input}
          value={roomNumber}
          onChangeText={setRoomNumber}
          placeholder="输入房间号"
          placeholderTextColor={COLORS.textSecondary}
          keyboardType="number-pad"
          maxLength={4}
          autoFocus
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          title="加入"
          onPress={handleJoin}
          disabled={roomNumber.length !== 4}
          loading={loading}
          size="large"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 24,
  },
  error: {
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 16,
  },
});

export default JoinRoomScreen;
