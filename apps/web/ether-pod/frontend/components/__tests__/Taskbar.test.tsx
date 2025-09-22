import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import Taskbar from '../Taskbar';
import { useEthosStore } from '../../state/ethos';

beforeEach(() => {
  useEthosStore.getState().disconnect();
  useEthosStore.setState({
    status: 'ready',
    rooms: {
      'guild-1': {
        id: 'guild-1',
        topic: 'Engineering Guild',
        participantIds: [],
        lastUpdated: Date.now(),
      },
    },
    openRooms: ['guild-1'],
    activeRoomId: 'guild-1',
    setActiveRoom: vi.fn(),
  });
});

afterEach(() => {
  useEthosStore.getState().disconnect();
});

it('renders launcher button and active conversations', () => {
  render(<Taskbar />);
  expect(screen.getAllByRole('button', { name: 'Guilds' })[0]).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Engineering Guild' })[0]).toBeInTheDocument();
});

it('invokes setActiveRoom when a conversation is selected', () => {
  render(<Taskbar />);
  const { setActiveRoom } = useEthosStore.getState();
  fireEvent.click(screen.getAllByRole('button', { name: 'Engineering Guild' })[0]);
  expect(setActiveRoom).toHaveBeenCalledWith('guild-1');
});
