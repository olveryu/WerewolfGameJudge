import { GameTemplate } from '@/models/Template';
import type { RoleRevealAnimation } from '@/types/RoleRevealAnimation';

export type RootStackParamList = {
  Home: undefined;
  Config:
    | {
        // Optional: if provided, update existing room instead of creating new one
        existingRoomNumber?: string;
      }
    | undefined;
  Room: {
    roomNumber: string;
    isHost: boolean;
    template?: GameTemplate;
    roleRevealAnimation?: RoleRevealAnimation;
  };
  Settings: undefined;
};

// For type-safe navigation
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
