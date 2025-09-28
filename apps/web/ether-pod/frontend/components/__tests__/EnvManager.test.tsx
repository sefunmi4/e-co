import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import EnvManager from '../EnvManager';

const mockWorlds = [
  {
    id: 'aurora',
    name: 'Aurora Workspace',
    summary: 'Aurora v0.1.0 with 2 portals',
    entry_scene: 'aurora.js',
    portals: ['eco://worlds/lobby', 'https://example.com/portal.wasm'],
  },
];

describe('EnvManager', () => {
  const fetchMock = vi.fn();
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('/api/worlds/search')) {
        return Promise.resolve(
          new Response(JSON.stringify({ results: mockWorlds }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      if (url === 'https://example.com/portal.wasm') {
        fetchMock();
        return Promise.resolve(new Response('ok', { status: 200 }));
      }
      return Promise.resolve(new Response('not found', { status: 404 }));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('renders search results and loads portals when a world is selected', async () => {
    const onWorldChange = vi.fn();
    render(<EnvManager onWorldChange={onWorldChange} />);

    await waitFor(() => {
      expect(screen.getByText('Aurora Workspace')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Aurora Workspace'));

    await waitFor(() => {
      expect(onWorldChange).toHaveBeenCalled();
      expect(screen.getByText('https://example.com/portal.wasm')).toBeInTheDocument();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });
});
