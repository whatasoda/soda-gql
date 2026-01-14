/**
 * Test transformer to verify upstream transformer chaining.
 * This transformer logs when it's called and delegates to the default Expo transformer.
 */

const upstreamTransformer = require("@expo/metro-config/babel-transformer");

let transformCount = 0;

module.exports.transform = async function transform(params) {
  transformCount++;
  const { filename } = params;

  // Log to verify this transformer is being called
  if (filename.includes("graphql") || filename.includes("App")) {
    console.log(`[test-transformer] #${transformCount} Transforming: ${filename.split("/").slice(-2).join("/")}`);
  }

  // Delegate to upstream transformer
  return upstreamTransformer.transform(params);
};

module.exports.getCacheKey = function getCacheKey() {
  return "test-transformer-v1";
};
