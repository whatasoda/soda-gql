// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const { withSodaGql } = require("@soda-gql/metro-plugin");
const path = require("path");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Test: Set a custom transformer BEFORE withSodaGql
// This simulates the case where another plugin (e.g., react-native-svg-transformer)
// has already set a custom babelTransformerPath
config.transformer = {
  ...config.transformer,
  babelTransformerPath: path.resolve(__dirname, "test-transformer.js"),
};

module.exports = withSodaGql(config);
