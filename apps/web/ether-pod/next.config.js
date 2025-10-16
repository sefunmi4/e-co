const path = require('node:path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
    serverActions: true,
    externalDir: true,
  },
  webpack: (config) => {
    config.experiments = config.experiments || {};
    config.experiments.topLevelAwait = true;
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@frontend': path.resolve(__dirname, 'frontend'),
      '@backend': path.resolve(__dirname, 'backend'),
    };
    return config;
  },
};

module.exports = nextConfig;
