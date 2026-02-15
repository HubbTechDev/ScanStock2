const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// ✅ Ignore backend folder completely (and any nested node_modules)
config.watchFolders = [projectRoot];
config.resolver.blockList = [
  /.*\/backend\/.*/,
  /.*\\backend\\.*/
];

module.exports = config;
