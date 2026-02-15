/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@werewolf/game-engine/(.*)$': '<rootDir>/src/$1',
    '^@werewolf/game-engine$': '<rootDir>/src/index.ts',
  },
};
