import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import LauncherMenu from '../LauncherMenu';
import { useEthosStore } from '../../state/ethos';

beforeEach(() => {
  useEthosStore.getState().disconnect();
  useEthosStore.setState({
    status: 'ready',
    rooms: {
      alpha: {
        id: 'alpha',
        topic: 'Alpha Thread',
        participantIds: ['one'],
        lastUpdated: Date.now(),
      },
      beta: {
        id: 'beta',
        topic: 'Beta Thread',
        participantIds: ['two'],
        lastUpdated: Date.now(),
      },
    },
    openConversation: vi.fn(),
  });
});

afterEach(() => {
  useEthosStore.getState().disconnect();
});

it('lists conversations and launches selection', async () => {
  render(<LauncherMenu />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Guilds' })[0]);
  expect(screen.getAllByText('Alpha Thread')[0]).toBeInTheDocument();
  expect(screen.getAllByText('Beta Thread')[0]).toBeInTheDocument();
  fireEvent.click(screen.getAllByText('Alpha Thread')[0]);
  expect(useEthosStore.getState().openConversation).toHaveBeenCalledWith('alpha');
});

it('filters conversations by search input', () => {
  render(<LauncherMenu />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Guilds' })[0]);
  const search = screen.getByPlaceholderText('Search by topic or member');
  fireEvent.change(search, { target: { value: 'beta' } });
  expect(screen.queryByText('Alpha Thread')).not.toBeInTheDocument();
  expect(screen.getByText('Beta Thread')).toBeInTheDocument();
});
