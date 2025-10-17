# Ethos Mobile

A React Native implementation of the Ethos questing experience that runs on Android and iOS using Expo.

## Getting started

1. Install dependencies from the repository root:

   ```bash
   npm install
   ```

2. Set the Ethos gateway base URL so the mobile app can talk to your backend. Create `apps/mobile/ethos/.env` (or export the variable in your shell) with:

   ```bash
   EXPO_PUBLIC_GATEWAY_URL=http://localhost:4455
   ```

   Update the value if your gateway lives elsewhere.

3. Launch the Expo development server:

   ```bash
   npm run start -w apps/mobile/ethos
   ```

4. Open the project on a device or emulator using the Expo Go client (`npm run android -w apps/mobile/ethos` or `npm run ios -w apps/mobile/ethos`).

## Features

- Email/password and guest authentication flows shared with the web app.
- Dashboard with live quests fetched from the Ethos gateway.
- Quest detail screen that surfaces visibility, status, and engagement metrics.
- Settings screen with account metadata and sign-out controls.
- Deep linking scaffolded for future native integrations (`ethos://`).

## Project structure

```
apps/mobile/ethos
├── App.tsx                  # App entry point, wraps navigation with providers
├── src/
│   ├── api/                 # REST helpers compatible with the Ethos gateway
│   ├── components/          # Reusable mobile UI pieces
│   ├── context/             # Global authentication state
│   ├── navigation/          # React Navigation configuration
│   └── screens/             # Dashboard, login, quest detail, and settings screens
└── metro.config.js          # Metro configuration for the monorepo workspace
```

## Linting and type checking

```bash
npm run lint -w apps/mobile/ethos
npm run typecheck -w apps/mobile/ethos
```

The commands run ESLint and TypeScript to verify the mobile experience without producing native binaries.
