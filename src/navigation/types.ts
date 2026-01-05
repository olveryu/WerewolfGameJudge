import { GameTemplate } from '../models/Template';

export type RootStackParamList = {
  Home: undefined;
  Config: undefined;
  Room: {
    roomNumber: string;
    isHost: boolean;
    template?: GameTemplate;
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
