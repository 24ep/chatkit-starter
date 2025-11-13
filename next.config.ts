import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
    };
    
    // Inject polyfill at the start of client-side bundles only
    if (!isServer) {
      // Create a custom plugin to inject polyfill at the very beginning
      const originalEntry = config.entry;
      config.entry = async () => {
        const entries = await originalEntry();
        const polyfillPath = require.resolve('./lib/crypto-polyfill-inject.js');
        
        // Prepend polyfill to all entry points
        if (typeof entries === 'object' && entries !== null) {
          for (const key in entries) {
            if (Array.isArray(entries[key])) {
              entries[key].unshift(polyfillPath);
            } else if (typeof entries[key] === 'string') {
              entries[key] = [polyfillPath, entries[key]];
            }
          }
        }
        
        return entries;
      };
    }
    
    return config;
  },
};

export default nextConfig;
