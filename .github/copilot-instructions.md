# Werewolf Game Judge - React Native

## Project Overview

A React Native/Expo app for moderating Werewolf (狼人杀) party games with:
- Supabase backend (authentication and real-time database)
- Audio announcements for night phases
- 20+ game roles support

## Architecture

This project uses a modular architecture:

- **models/**: Pure TypeScript interfaces (Player, Room, Template)
- **services/**: Singleton services for Supabase, Auth, Audio, Storage
- **hooks/**: Custom React hooks for state management
- **components/**: Reusable UI components
- **screens/**: Full-screen views
- **navigation/**: React Navigation configuration
- **constants/**: App constants and role definitions

## Development Guidelines

1. Keep components small and focused
2. Use TypeScript strictly
3. Services should be accessed via getInstance()
4. Use custom hooks for shared logic
5. Keep screens thin - delegate to hooks and services

## Running the Project

```bash
npm start       # Start Expo dev server
npm run ios     # Run on iOS simulator
npm run android # Run on Android emulator
npm run web     # Run in web browser
```
