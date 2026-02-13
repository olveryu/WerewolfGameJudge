module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-reanimated|react-native-gesture-handler)',
  ],
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  coverageThreshold: {
    global: {
      statements: 60,
      branches: 50,
      functions: 55,
      lines: 60,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native-worklets$': '<rootDir>/__mocks__/react-native-worklets.ts',
    '^expo-audio$': '<rootDir>/__mocks__/expo-audio.ts',
    '^expo-haptics$': '<rootDir>/__mocks__/expo-haptics.ts',
    '^expo-image$': '<rootDir>/__mocks__/expo-image.tsx',
    '^expo-splash-screen$': '<rootDir>/__mocks__/expo-splash-screen.ts',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/__mocks__/@react-native-async-storage/async-storage.ts',
    '^@expo/vector-icons$': '<rootDir>/__mocks__/@expo/vector-icons.tsx',
    '^@sentry/react-native$': '<rootDir>/__mocks__/@sentry/react-native.ts',
  },
};
