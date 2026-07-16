// Metro config for Expo in a pnpm monorepo (+ NativeWind v4).
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so changes in packages/* trigger HMR.
config.watchFolders = [workspaceRoot];
// Resolve modules from the app first, then the hoisted workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const nativeWindConfig = withNativeWind(config, { input: './global.css' });

// Force a SINGLE copy of react. pnpm (with auto-install-peers) nests a second
// react under a transitive dep (react-i18next), and two react instances in one
// bundle throw "Invalid hook call" / "useContext of null". Redirect every
// `react` / `react/*` import to the one hoisted at the workspace root. Applied
// AFTER withNativeWind so it wraps (not gets wrapped by) NativeWind's resolver.
const upstreamResolveRequest = nativeWindConfig.resolver.resolveRequest;
nativeWindConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    try {
      return {
        type: 'sourceFile',
        filePath: require.resolve(moduleName, { paths: [workspaceRoot] }),
      };
    } catch {
      // Uncommon react subpath not in exports — fall through to default resolution.
    }
  }
  return upstreamResolveRequest
    ? upstreamResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = nativeWindConfig;
