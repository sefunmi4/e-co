# Ethos Mobile (React Native)

A React Native implementation of the Ethos client experience designed for iOS and Android. The project is built with Expo and reuses the shared `@eco/js-sdk` package to talk to the Ethos gateway, enabling parity with the web application while providing native navigation and secure credential storage.

## Getting started

### Prerequisites

- Node.js 18+
- `npm` (comes with Node)
- Xcode (for iOS builds) or Android Studio (for Android builds)
- Expo CLI (`npm install --global expo`)

### Installation

```bash
npm install
```

This installs dependencies for the entire monorepo, including the mobile workspace.

### Running the mobile app

From the repository root:

```bash
npm run start -w @ethos/mobile
```

This launches the Expo development server. You can press `i` to run the iOS simulator or `a` for Android.

The app reads its backend configuration from Expo config extras. By default it targets `http://localhost:8080`. Override this by creating an `.env` file in `apps/mobile/ethos` and supplying:

```env
ETHOS_GATEWAY_URL=https://gateway.yourdomain.tld
ETHOS_APP_ID=com.yourcompany.ethos
ETHOS_APP_NAME="Ethos"
# Optionally point to remote icon/splash assets you manage.
ETHOS_APP_ICON=https://cdn.yourdomain.tld/ethos-app-icon.png
ETHOS_SPLASH_IMAGE=https://cdn.yourdomain.tld/ethos-splash.png
```

Expo automatically loads these variables when running the development server. The repository does not bundle binary image assets; provide your own icon/splash URLs via the environment variables above or keep the defaults to use Expo's development artwork.

### Building for the App Store

1. Configure your bundle identifier via `ETHOS_APP_ID`.
2. Ensure you have an [EAS project](https://docs.expo.dev/eas/). Set `EAS_PROJECT_ID` and `EXPO_UPDATES_URL` if you are using EAS Update.
3. Run the platform-specific build command:
   - `npm run ios -w @ethos/mobile` for local iOS simulator builds.
   - `expo prebuild` followed by `expo run:ios --device` / `expo run:android --device` for device builds.
   - For production binaries ready for the Apple App Store, use `eas build --platform ios` from within `apps/mobile/ethos`.

The project uses secure storage for credentials (via `expo-secure-store`) and persists Ethos sessions between launches. All authentication flows (login, registration, guest access) are implemented with the shared Auth client, and the signed-in home view mirrors the gateway session payload for debugging purposes.

## Testing

Run unit tests with:

```bash
npm test -w @ethos/mobile
```

## Directory structure

- `src/App.tsx` – App entrypoint wiring providers and navigation.
- `src/navigation/` – Authenticated and unauthenticated stack navigators.
- `src/providers/SessionProvider.tsx` – Session state management with secure persistence.
- `src/screens/` – Individual React Native screens for onboarding and the signed-in experience.
- Configure app artwork via the `ETHOS_APP_ICON` and `ETHOS_SPLASH_IMAGE` environment variables.
