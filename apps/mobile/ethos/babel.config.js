module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // if you use path aliases:
      ['module-resolver', {
        root: ['./'],
        alias: {
          '@': './src',           // adjust to your structure
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
      }],

      // keep this last if you use Reanimated:
      // 'react-native-reanimated/plugin',
    ],
  };
};