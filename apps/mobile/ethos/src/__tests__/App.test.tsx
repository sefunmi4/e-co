import React from 'react';
import renderer from 'react-test-renderer';
import App from '../App';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

describe('App', () => {
  it('renders the loading view while hydration runs', () => {
    const tree = renderer.create(<App />).toJSON();
    expect(tree).toBeTruthy();
  });
});
