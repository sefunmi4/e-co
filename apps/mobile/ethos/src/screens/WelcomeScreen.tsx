import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSession } from '@/hooks/useSession';
import type { AuthStackParamList } from '@/navigation/types';

export type WelcomeScreenProps = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const accentColor = '#1f9a6d';
const textColor = '#f5f5f5';

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const { signInAsGuest, loading } = useSession();
  const [displayName, setDisplayName] = useState('');

  const handleGuest = async () => {
    try {
      await signInAsGuest(displayName);
    } catch (error) {
      Alert.alert('Guest sign-in failed', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to Ethos</Text>
        <Text style={styles.subtitle}>Connect your rituals and experiences on mobile.</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.primaryLabel}>Continue with Email</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.secondaryLabel}>Create an account</Text>
        </Pressable>
      </View>

      <View style={styles.guestContainer}>
        <Text style={styles.guestLabel}>Or continue as a guest</Text>
        <TextInput
          style={styles.input}
          placeholder="Display name (optional)"
          placeholderTextColor="rgba(245,245,245,0.6)"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <Pressable
          accessibilityRole="button"
          onPress={handleGuest}
          disabled={loading}
          style={({ pressed }) => [styles.guestButton, (pressed || loading) && styles.pressed]}
        >
          {loading ? <ActivityIndicator color={accentColor} /> : <Text style={styles.guestButtonLabel}>Continue as guest</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: textColor,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(245,245,245,0.7)',
    lineHeight: 22,
  },
  actions: {
    gap: 16,
  },
  primaryButton: {
    backgroundColor: accentColor,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryLabel: {
    color: '#0c0c0c',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    borderColor: 'rgba(245,245,245,0.3)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryLabel: {
    color: textColor,
    fontSize: 18,
    fontWeight: '500',
  },
  guestContainer: {
    marginBottom: 32,
    gap: 12,
  },
  guestLabel: {
    color: 'rgba(245,245,245,0.7)',
    fontSize: 14,
  },
  input: {
    backgroundColor: 'rgba(245,245,245,0.08)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: textColor,
  },
  guestButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,245,245,0.15)',
    backgroundColor: 'rgba(10,10,10,0.8)',
  },
  guestButtonLabel: {
    color: accentColor,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});

export default WelcomeScreen;
