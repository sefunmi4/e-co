import { render, screen, fireEvent } from '@testing-library/react';
import CommandPalette from '../CommandPalette';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';

describe('CommandPalette', () => {
  it('opens with keyboard shortcut', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByPlaceholderText('Type a command...')).toBeInTheDocument();
  });
});
