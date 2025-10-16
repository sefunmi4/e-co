const plugins = {};

try {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies -- optional in CI environments
  plugins.tailwindcss = require('tailwindcss');
} catch (error) {
  console.warn('[postcss] tailwindcss unavailable, skipping');
}

try {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies -- optional in CI environments
  plugins.autoprefixer = require('autoprefixer');
} catch (error) {
  console.warn('[postcss] autoprefixer unavailable, skipping');
}

module.exports = { plugins };
