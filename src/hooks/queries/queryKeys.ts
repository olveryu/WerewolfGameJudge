export const queryKeys = {
  userStats: () => ['userStats'] as const,
  userProfile: (userId: string) => ['userProfile', userId] as const,
  userUnlocks: (userId: string) => ['userUnlocks', userId] as const,
  gachaStatus: () => ['gachaStatus'] as const,
};
