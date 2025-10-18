import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Quest, QuestApi, GuildApi } from '../api/entities';
import QuestListItem from '../components/QuestListItem';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';

const DashboardScreen: React.FC<NativeStackScreenProps<RootStackParamList, 'Dashboard'>> = ({
  navigation,
}) => {
  const { user, session } = useAuth();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guildCount, setGuildCount] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [questData, guildData] = await Promise.all([
        QuestApi.filter({ visibility: 'public', is_archived: false }, '-created_date', 50),
        GuildApi.list({ limit: 50 }),
      ]);
      setQuests(questData);
      setGuildCount(Array.isArray(guildData) ? guildData.length : null);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
      setError(err instanceof Error ? err.message : 'Unable to reach the Ethos gateway.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      void fetchData();
    }, [fetchData])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchData();
  }, [fetchData]);

  const header = (
    <View style={styles.headerContainer}>
      <View>
        <Text style={styles.greeting}>Welcome back</Text>
        <Text style={styles.name}>{user?.display_name ?? user?.full_name ?? user?.email ?? 'Guild Operative'}</Text>
      </View>
      <TouchableOpacity style={styles.settingsButton} onPress={() => navigation.navigate('Settings')}>
        <Text style={styles.settingsButtonText}>Settings</Text>
      </TouchableOpacity>
    </View>
  );

  const summary = (
    <View style={styles.summaryRow}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Active quests</Text>
        <Text style={styles.summaryValue}>{quests.length}</Text>
      </View>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Guilds</Text>
        <Text style={styles.summaryValue}>{guildCount ?? '—'}</Text>
      </View>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Your parties</Text>
        <Text style={styles.summaryValue}>{session?.parties ?? '—'}</Text>
      </View>
    </View>
  );

  const listEmptyComponent = (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No quests yet</Text>
      <Text style={styles.emptyStateBody}>
        Connect your Ethos gateway or create a quest from the web experience to see it here.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={quests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <QuestListItem quest={item} onPress={(quest) => navigation.navigate('QuestDetail', { quest })} />
        )}
        contentContainerStyle={styles.contentContainer}
        ListHeaderComponent={
          <View>
            {header}
            {summary}
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={() => void fetchData()}>
                  <Text style={styles.errorRetry}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={!loading ? listEmptyComponent : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563eb" />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    padding: 20,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    color: '#64748b',
    fontSize: 14,
  },
  name: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  settingsButton: {
    borderColor: '#2563eb',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  settingsButtonText: {
    color: '#2563eb',
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryTitle: {
    color: '#64748b',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryValue: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    color: '#b91c1c',
    marginBottom: 8,
  },
  errorRetry: {
    color: '#dc2626',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyStateTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '700',
  },
  emptyStateBody: {
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
});

export default DashboardScreen;
