// @ts-check
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Bundled FoodSeed.fixture.sqlite for offline Search (M1-12 / M1-09).
if (!config.resolver.assetExts.includes('sqlite')) {
  config.resolver.assetExts.push('sqlite');
}
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

module.exports = config;
