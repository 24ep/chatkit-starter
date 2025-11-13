import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer, webpack }) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
    };
    
    // Inject polyfill at the start of client-side bundles only
    if (!isServer) {
      // Minimal polyfill that runs immediately - injected at the start of every bundle
      const cryptoPolyfillCode = `(function(){'use strict';try{if(typeof crypto!=='undefined'&&crypto&&crypto.getRandomValues){var p=function(){var b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;var h=Array.from(b).map(function(x){return x.toString(16).padStart(2,'0');}).join('');return[h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20,32)].join('-');};try{crypto.randomUUID=p;Object.defineProperty(crypto,'randomUUID',{value:p,writable:true,configurable:true,enumerable:false});}catch(e){crypto.randomUUID=p;}if(typeof window!=='undefined'&&window.crypto){try{window.crypto.randomUUID=p;}catch(e){}}}catch(e){}})();`;
      
      // Use BannerPlugin to prepend the polyfill to all chunks
      config.plugins.push(
        new webpack.BannerPlugin({
          banner: cryptoPolyfillCode,
          raw: true,
          entryOnly: false, // Apply to all chunks including the problematic one
        })
      );
    }
    
    return config;
  },
};

export default nextConfig;
