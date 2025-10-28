module.exports = function(api) {
  api.cache(true);
  
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // React Native reanimated (if used)
      'react-native-worklets/plugin',
    ],
  };
};