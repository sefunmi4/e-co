import { render, screen } from '@testing-library/react';
import EnvManager from '../EnvManager';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import '@testing-library/jest-dom/vitest';


// mock fetch
beforeAll(() => {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    json: async () => [],
  } as any);
});

describe('EnvManager', () => {
  it('renders header', async () => {
    render(<EnvManager />);
    expect(screen.getByText('Environments')).toBeInTheDocument();
  });
});
