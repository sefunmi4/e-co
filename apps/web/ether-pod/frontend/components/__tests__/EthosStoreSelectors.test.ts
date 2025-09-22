import { describe, beforeEach, afterEach, expect, it } from 'vitest';
import {
  selectActiveConversation,
  selectActiveMessages,
  selectRosterForConversation,
  useEthosStore,
} from '../../state/ethos';
import { PresenceState } from '../../../lib/proto/ethos_pb';

describe('Ethos store selectors', () => {
  const now = Date.now();

  beforeEach(() => {
    useEthosStore.getState().disconnect();
    useEthosStore.setState({
      status: 'ready',
      rooms: {
        alpha: {
          id: 'alpha',
          topic: 'Alpha Thread',
          participantIds: ['mentor'],
          lastUpdated: now,
        },
      },
      roster: {
        mentor: {
          userId: 'mentor',
          displayName: 'Guild Mentor',
          avatarUrl: '',
          presence: PresenceState.STATE_ONLINE,
          updatedAt: now,
        },
      },
      messageBuffers: {
        alpha: [
          {
            id: 'message-1',
            conversationId: 'alpha',
            senderId: 'mentor',
            body: 'Hello',
            timestamp: now,
          },
        ],
      },
      activeRoomId: 'alpha',
    });
  });

  afterEach(() => {
    useEthosStore.getState().disconnect();
  });

  it('selects the active conversation metadata', () => {
    const state = useEthosStore.getState();
    expect(selectActiveConversation(state)?.topic).toBe('Alpha Thread');
  });

  it('selects active messages for the conversation', () => {
    const state = useEthosStore.getState();
    expect(selectActiveMessages(state)).toHaveLength(1);
  });

  it('returns roster entries for a conversation', () => {
    const state = useEthosStore.getState();
    const roster = selectRosterForConversation(state, 'alpha');
    expect(roster[0]?.displayName).toBe('Guild Mentor');
  });
});
