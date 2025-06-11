import { render, screen, fireEvent } from '@testing-library/react';
import ModelDashboard from '../ModelDashboard';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';

describe('ModelDashboard', () => {
  it('adds a model', () => {
    render(<ModelDashboard />);
    fireEvent.change(screen.getByPlaceholderText('Model name'), { target: { value: 'my-model' } });
    fireEvent.click(screen.getByText('Add'));
    expect(screen.getByText('my-model')).toBeInTheDocument();
  });
});
