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
import { useRoom } from '../../hooks';
import { RootStackParamList } from '../../navigation/types';

type JoinRoomScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const JoinRoomScreen: React.FC = () => {
  const navigation = useNavigation<JoinRoomScreenNavigationProp>();
  const { joinRoom, loading, error } = useRoom();
  const [roomNumber, setRoomNumber] = useState('');

  const handleJoin = async () => {
    if (roomNumber.length !== 4) return;

    const room = await joinRoom(roomNumber);
    if (room) {
      navigation.replace('Room', { roomNumber: room.roomNumber, isHost: false });
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
