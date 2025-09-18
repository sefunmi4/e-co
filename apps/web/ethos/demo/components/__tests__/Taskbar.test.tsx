import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { it, expect } from 'vitest';
import Taskbar from '../Taskbar';

it('shows start button and open folders', () => {
  render(<Taskbar openFolders={['Projects']} />);
  expect(screen.getByText('Start')).toBeInTheDocument();
  expect(screen.getByText('Projects')).toBeInTheDocument();
});
