// App-wide constants
export const APP_NAME = 'Werewolf Judge';

// Game constants
export const MIN_PLAYERS = 6;
export const MAX_PLAYERS = 18;

// Night phase timing (in milliseconds)
export const NIGHT_PHASE_DELAY = 2000;
export const ROLE_ACTION_DELAY = 3000;

// Colors
export const COLORS = {
  primary: '#FF6B00',
  secondary: '#4A90D9',
  background: '#1A1A2E',
  surface: '#16213E',
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  wolf: '#8B0000',
  god: '#FFD700',
  villager: '#228B22',
  special: '#9932CC', // For special roles
  danger: '#DC3545',
  success: '#28A745',
  warning: '#FFC107',
};

// Storage keys
export const STORAGE_KEYS = {
  USER_PREFERENCES: 'user_preferences',
  GAME_HISTORY: 'game_history',
  AUDIO_ENABLED: 'audio_enabled',
  VIBRATION_ENABLED: 'vibration_enabled',
};

// Database collections (Supabase tables)
export const COLLECTIONS = {
  ROOMS: 'rooms',
  USERS: 'users',
  GAMES: 'games',
};
