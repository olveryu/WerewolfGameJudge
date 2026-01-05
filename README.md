# Werewolf Game Judge

A React Native / Expo app for moderating Werewolf (Mafia) party games.

## Features

- 🎮 **Game Management**: Create and manage game rooms
- 🔊 **Audio Announcements**: Automated voice prompts for night phases
- 👤 **Role Assignment**: Support for 20+ different roles
- 🔐 **Authentication**: Apple Sign In, Google Sign In, or anonymous play
- ☁️ **Cloud Sync**: Firebase Firestore for real-time game state
- 📱 **Cross-Platform**: iOS, Android, and Web support

## Project Structure

```
src/
├── components/      # Reusable UI components
│   ├── Button/
│   ├── AlertModal.tsx
│   └── Avatar.tsx
├── constants/       # App constants and role definitions
├── hooks/           # Custom React hooks
│   ├── useAuth.ts
│   └── useRoom.ts
├── models/          # TypeScript interfaces
│   ├── Player.ts
│   ├── Room.ts
│   └── Template.ts
├── navigation/      # React Navigation setup
├── screens/         # Screen components
│   ├── HomeScreen/
│   ├── ConfigScreen/
│   ├── RoomScreen/
│   ├── JoinRoomScreen/
│   └── SettingsScreen/
└── services/        # Business logic services
    ├── AudioService.ts
    ├── AuthService.ts
    ├── AvatarUploadService.ts
    ├── RoomService.ts
    └── SeatService.ts
```

## Getting Started

### Prerequisites

- Node.js >= 20.19.4
- npm or yarn
- Expo CLI
- iOS Simulator / Android Emulator / Physical device

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Supabase (optional - app works in demo mode without this):
   - Create a Supabase project at https://supabase.com
   - Run the schema from `supabase/schema.sql` in the SQL Editor
   - Enable Anonymous Authentication
   - Create `.env` file with your credentials:
     ```env
     EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
     EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     ```
   - See `docs/SUPABASE_SETUP.md` for detailed instructions

4. Add audio assets:
   - Place audio files in `assets/audio/` and `assets/audio_end/`
   - Place role images in `assets/images/`

### Running the App

```bash
# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on Web
npm run web
```

## Game Roles

### Wolf Team 🐺
- Wolf (狼人)
- Wolf King (狼王)
- Wolf Queen (狼后)
- Wolf Brother (狼兄)
- Robot Wolf (机械狼)
- Hidden Wolf (隐狼)
- Wolf Seeder (种狼)

### God Team ⚡
- Seer (预言家)
- Witch (女巫)
- Hunter (猎人)
- Guard (守卫)
- Knight (骑士)
- Idiot (白痴)
- Cupid (丘比特)
- Magician (魔术师)
- And more...

### Villager Team 👥
- Villager (村民)
- Bride (新娘)

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Navigation**: React Navigation
- **State Management**: React Hooks
- **Backend**: Supabase (Auth, Database, Storage)
- **Audio**: expo-audio

## License

MIT
