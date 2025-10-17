import 'dotenv/config';
import type { ExpoConfig } from '@expo/config';

const APP_IDENTIFIER = process.env.ETHOS_APP_ID ?? 'com.ethos.mobile';
const APP_NAME = process.env.ETHOS_APP_NAME ?? 'Ethos Mobile';
const GATEWAY_URL = process.env.ETHOS_GATEWAY_URL ?? 'http://localhost:8080';
const ICON_PATH = process.env.ETHOS_APP_ICON;
const SPLASH_IMAGE_PATH = process.env.ETHOS_SPLASH_IMAGE;

export default (): ExpoConfig => ({
  name: APP_NAME,
  slug: 'ethos-mobile',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ...(ICON_PATH
    ? {
        icon: ICON_PATH
      }
    : {}),
  splash: {
    ...(SPLASH_IMAGE_PATH
      ? {
          image: SPLASH_IMAGE_PATH,
          resizeMode: 'contain'
        }
      : {}),
    backgroundColor: '#0c0c0c'
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: APP_IDENTIFIER
  },
  android: {
    ...(ICON_PATH
      ? {
          adaptiveIcon: {
            foregroundImage: ICON_PATH,
            backgroundColor: '#0c0c0c'
          }
        }
      : {}),
    package: APP_IDENTIFIER
  },
  extra: {
    gatewayUrl: GATEWAY_URL,
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? ''
    }
  },
  updates: {
    url: process.env.EXPO_UPDATES_URL,
    enabled: true
  },
  runtimeVersion: {
    policy: 'appVersion'
  },
  scheme: process.env.ETHOS_APP_SCHEME ?? 'ethosmobile'
});
