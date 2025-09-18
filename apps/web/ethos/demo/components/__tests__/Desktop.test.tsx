import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { test, expect } from 'vitest';
import Desktop from '../Desktop';

test('renders default desktop icons', () => {
  render(<Desktop />);
  expect(screen.getByText('Notes.txt')).toBeInTheDocument();
  expect(screen.getByText('Projects')).toBeInTheDocument();
});
