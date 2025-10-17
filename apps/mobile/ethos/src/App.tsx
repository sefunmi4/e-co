import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NavigationRoot from '@/navigation';
import { SessionProvider, useSessionContext } from '@/providers/SessionProvider';

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RootView />
      </SessionProvider>
    </QueryClientProvider>
  );
};

const RootView: React.FC = () => {
  const { hydrated } = useSessionContext();

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator />
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  return (
    <>
      <NavigationRoot />
      <StatusBar style="light" />
    </>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0c0c0c',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default App;
