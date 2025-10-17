import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { z } from 'zod';
import { useSession } from '@/hooks/useSession';
import type { AuthStackParamList } from '@/navigation/types';

export type RegisterScreenProps = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const accentColor = '#1f9a6d';
const textColor = '#f5f5f5';

const schema = z
  .object({
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(8, 'Password should be at least 8 characters long'),
    confirmPassword: z.string(),
    displayName: z.string().max(64, 'Display name should be shorter than 64 characters').optional(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const { signUp, loading } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleSubmit = async () => {
    const result = schema.safeParse({ email, password, confirmPassword, displayName: displayName || undefined });
    if (!result.success) {
      const issues = result.error.issues.map((issue) => issue.message).join('\n');
      Alert.alert('Check the form', issues);
      return;
    }

    try {
      await signUp(result.data.email, result.data.password, result.data.displayName);
    } catch (error) {
      Alert.alert('Unable to create account', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create your Ethos account</Text>
          <Text style={styles.subtitle}>Craft your rituals anywhere with a dedicated mobile experience.</Text>
        </View>
        <View style={styles.form}>
          <FormField label="Email">
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@example.com"
              placeholderTextColor="rgba(245,245,245,0.6)"
              style={styles.input}
            />
          </FormField>

          <FormField label="Display name (optional)">
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoCorrect
              textContentType="name"
              placeholder="How other guests will see you"
              placeholderTextColor="rgba(245,245,245,0.6)"
              style={styles.input}
            />
          </FormField>

          <FormField label="Password">
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              placeholder="Create a password"
              placeholderTextColor="rgba(245,245,245,0.6)"
              style={styles.input}
            />
          </FormField>

          <FormField label="Confirm password">
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              textContentType="newPassword"
              placeholder="Re-enter your password"
              placeholderTextColor="rgba(245,245,245,0.6)"
              style={styles.input}
            />
          </FormField>
        </View>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.submitButton, (pressed || loading) && styles.pressed]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#0c0c0c" /> : <Text style={styles.submitLabel}>Create account</Text>}
        </Pressable>
      </KeyboardAvoidingView>

      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.footerText}>Already have an account? Sign in</Text>
      </Pressable>
    </SafeAreaView>
  );
};

const FormField: React.FC<React.PropsWithChildren<{ label: string }>> = ({ label, children }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
    paddingHorizontal: 24,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    color: textColor,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(245,245,245,0.7)',
  },
  form: {
    gap: 20,
  },
  field: {
    gap: 8,
  },
  label: {
    color: textColor,
    fontWeight: '600',
  },
  input: {
    backgroundColor: 'rgba(245,245,245,0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: textColor,
  },
  submitButton: {
    marginTop: 36,
    backgroundColor: accentColor,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitLabel: {
    color: '#0c0c0c',
    fontWeight: '600',
    fontSize: 18,
  },
  footerButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  footerText: {
    color: accentColor,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
});

export default RegisterScreen;
