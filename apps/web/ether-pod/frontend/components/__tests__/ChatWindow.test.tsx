import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import ChatWindow from '../ChatWindow';
import { useEthosStore } from '../../state/ethos';
import { PresenceState } from '../../../lib/proto/ethos_pb';

const now = Date.now();

describe('ChatWindow', () => {
  beforeEach(() => {
    useEthosStore.getState().disconnect();
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
      sendMessage: vi.fn(),
    });
  });

  afterEach(() => {
    useEthosStore.getState().disconnect();
  });

  it('shows seeded messages with roster metadata', () => {
    render(<ChatWindow conversationId="guild-1" index={0} />);
    expect(screen.getByText('Engineering Guild')).toBeInTheDocument();
    const thread = screen.getByTestId('chat-thread');
    expect(within(thread).getByText('Welcome to Ethos!')).toBeInTheDocument();
    expect(screen.getAllByText('Guild Mentor')[0]).toBeInTheDocument();
  });

  it('dispatches sendMessage when posting a new update', () => {
    render(<ChatWindow conversationId="guild-1" index={0} />);
    const input = screen.getByLabelText('Send a message');
    fireEvent.change(input, {
      target: { value: 'Testing 123' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Post' })[0]);
    expect(useEthosStore.getState().sendMessage).toHaveBeenCalledWith('guild-1', 'Testing 123');
  });
});
