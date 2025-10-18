import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

const QuestDetailScreen: React.FC<NativeStackScreenProps<RootStackParamList, 'QuestDetail'>> = ({
  route,
}) => {
  const { quest } = route.params;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{quest.title}</Text>
      <Text style={styles.meta}>Created {new Date(quest.created_date).toLocaleString()}</Text>
      {quest.status && <Text style={styles.meta}>Status: {quest.status}</Text>}
      {quest.quest_type && <Text style={styles.meta}>Type: {quest.quest_type}</Text>}
      {quest.priority && <Text style={styles.meta}>Priority: {quest.priority}</Text>}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.body}>{quest.description}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stats</Text>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Likes</Text>
          <Text style={styles.statValue}>{quest.like_count ?? 0}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Comments</Text>
          <Text style={styles.statValue}>{quest.comment_count ?? 0}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Average rating</Text>
          <Text style={styles.statValue}>{quest.average_rating?.toFixed(1) ?? '—'}</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 24,
    gap: 16,
  },
  title: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '700',
  },
  meta: {
    color: '#64748b',
    fontSize: 14,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    color: '#64748b',
  },
  statValue: {
    color: '#0f172a',
    fontWeight: '600',
  },
});

export default QuestDetailScreen;
