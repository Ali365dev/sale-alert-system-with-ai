module.exports = {
  // Bundle only the icon families the app imports. With use_frameworks
  // (dynamic), pod-shipped fonts stay inside RNVectorIcons.framework and
  // UIAppFonts cannot see them — these assets are copied into the app target.
  assets: [
    './assets/fonts/Ionicons.ttf',
    './assets/fonts/MaterialCommunityIcons.ttf',
    './assets/fonts/FontAwesome5_Solid.ttf',
  ],
};
