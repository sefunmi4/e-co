import React from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Session } from '@eco/js-sdk/auth';
import { useSession } from '@/hooks/useSession';
import { getGatewayUrl } from '@/utils/config';

const accentColor = '#1f9a6d';
const textColor = '#f5f5f5';

const HomeScreen: React.FC = () => {
  const { session, signOut } = useSession();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Error signing out', error instanceof Error ? error.message : String(error));
    }
  };

  const details = toRenderableSession(session);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>You are signed in</Text>
        <Text style={styles.subheading}>Gateway base URL: {getGatewayUrl()}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Session details</Text>
          {details.map((item) => (
            <View key={item.label} style={styles.row}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.value}>{item.value}</Text>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={handleSignOut}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
        >
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

type RenderableItem = { label: string; value: string };

function toRenderableSession(session: Session | null): RenderableItem[] {
  if (!session) {
    return [];
  }

  const data: RenderableItem[] = [
    { label: 'User ID', value: session.user.id },
    { label: 'Email', value: session.user.email },
    { label: 'Display name', value: session.user.displayName ?? '—' },
    { label: 'Guest?', value: session.user.isGuest ? 'Yes' : 'No' },
    { label: 'Access token', value: truncate(session.accessToken) },
  ];

  if (session.refreshExpiresAt) {
    data.push({ label: 'Refresh expires', value: session.refreshExpiresAt.toISOString() });
  }

  if (session.refreshToken) {
    data.push({ label: 'Refresh token', value: truncate(session.refreshToken) });
  }

  if (session.matrixAccessToken) {
    data.push({ label: 'Matrix token', value: truncate(session.matrixAccessToken) });
  }

  if (session.matrixHomeserver) {
    data.push({ label: 'Matrix homeserver', value: session.matrixHomeserver });
  }

  return data;
}

function truncate(value: string, length = 24): string {
  if (value.length <= length) {
    return value;
  }
  return `${value.slice(0, length)}…`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 20,
  },
  heading: {
    color: textColor,
    fontSize: 28,
    fontWeight: '700',
  },
  subheading: {
    color: 'rgba(245,245,245,0.7)',
  },
  card: {
    backgroundColor: 'rgba(245,245,245,0.05)',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  cardTitle: {
    color: textColor,
    fontSize: 18,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: {
    color: 'rgba(245,245,245,0.6)',
    fontSize: 14,
    flex: 0.4,
  },
  value: {
    color: textColor,
    fontSize: 14,
    flex: 0.6,
    textAlign: 'right',
  },
  signOutButton: {
    backgroundColor: 'rgba(31,154,109,0.12)',
    borderColor: accentColor,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutLabel: {
    color: accentColor,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
});

export default HomeScreen;
