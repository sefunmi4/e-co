import Constants from 'expo-constants';

export function getGatewayUrl(): string {
  const fromManifest =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.gatewayUrl ??
    (Constants.manifest2?.extra?.expoClient as Record<string, unknown> | undefined)?.gatewayUrl;

  if (typeof fromManifest === 'string' && fromManifest.length > 0) {
    return fromManifest;
  }

  return 'http://localhost:8080';
}
