import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Quest } from '../api/entities';

interface Props {
  quest: Quest;
  onPress?: (quest: Quest) => void;
}

const QuestListItem: React.FC<Props> = ({ quest, onPress }) => {
  return (
    <TouchableOpacity style={styles.container} onPress={() => onPress?.(quest)}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{quest.title}</Text>
        {quest.priority && <Text style={styles.pill}>{quest.priority}</Text>}
      </View>
      <Text style={styles.description} numberOfLines={3}>
        {quest.description}
      </Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{new Date(quest.created_date).toLocaleDateString()}</Text>
        {quest.status && <Text style={styles.metaText}>{quest.status}</Text>}
        {typeof quest.like_count === 'number' && (
          <Text style={styles.metaText}>❤️ {quest.like_count}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  pill: {
    color: '#38bdf8',
    borderColor: '#38bdf8',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    color: '#cbd5f5',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  metaText: {
    color: '#94a3b8',
    fontSize: 12,
  },
});

export default QuestListItem;
