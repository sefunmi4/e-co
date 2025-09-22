import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import Desktop from '../Desktop';
import { useEthosStore } from '../../state/ethos';
import { PresenceState } from '../../../lib/proto/ethos_pb';

beforeEach(() => {
  useEthosStore.getState().disconnect();
  const now = Date.now();
  useEthosStore.setState({
    status: 'ready',
    rooms: {
      'guild-1': {
        id: 'guild-1',
        topic: 'Engineering Guild',
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
      'guild-1': [
        {
          id: 'seed',
          conversationId: 'guild-1',
          senderId: 'mentor',
          body: 'Welcome to Ethos!',
          timestamp: now,
        },
      ],
    },
    openRooms: ['guild-1'],
    activeRoomId: 'guild-1',
    bootstrap: vi.fn(),
  });
});

afterEach(() => {
  useEthosStore.getState().disconnect();
});

test('renders chat window with seeded conversation', () => {
  render(<Desktop />);
  expect(screen.getByTestId('chat-window-guild-1')).toBeInTheDocument();
  expect(screen.getByText('Welcome to Ethos!')).toBeInTheDocument();
});
