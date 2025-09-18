import { render, screen } from '@testing-library/react';
import LauncherMenu from '../LauncherMenu';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';

describe('LauncherMenu', () => {
  it('renders start button', () => {
    render(<LauncherMenu />);
    expect(screen.getByText('Start')).toBeInTheDocument();
  });
});
