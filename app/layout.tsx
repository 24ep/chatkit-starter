import Script from "next/script";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentKit demo",
  description: "Demo of ChatKit with hosted workflow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  'use strict';
  // Polyfill crypto.randomUUID immediately before any other scripts
  // This must run synchronously to ensure it's available before any other code executes
  function polyfillRandomUUID() {
    try {
      // Create the polyfill function once
      function createPolyfill(cryptoObj) {
        return function() {
          var bytes = new Uint8Array(16);
          cryptoObj.getRandomValues(bytes);
          bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
          bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
          var hex = Array.from(bytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
          return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
        };
      }
      
      // Helper to ensure crypto.randomUUID exists and works
      // Always applies polyfill to ensure it works in all contexts (HTTP, HTTPS, localhost)
      function ensureRandomUUID(context, contextName) {
        try {
          if (!context || typeof context !== 'object') return;
          
          // Get or create crypto object
          var cryptoObj = context.crypto || context.msCrypto;
          if (!cryptoObj || !cryptoObj.getRandomValues) return;
          
          // Always polyfill - replace any existing randomUUID with our working version
          // This ensures it works in non-secure contexts (HTTP) where native randomUUID throws
          var polyfillFn = createPolyfill(cryptoObj);
          
          // Always apply polyfill to ensure it works in all contexts
          try {
            // Use defineProperty to make it non-configurable and ensure it sticks
            Object.defineProperty(cryptoObj, 'randomUUID', {
              value: polyfillFn,
              writable: true,
              configurable: true,
              enumerable: false
            });
          } catch(e) {
            // Fallback to direct assignment if defineProperty fails
            try {
              cryptoObj.randomUUID = polyfillFn;
            } catch(e2) {
              // If that also fails, try wrapping it
              try {
                Object.defineProperty(cryptoObj, 'randomUUID', {
                  get: function() { return polyfillFn; },
                  configurable: true,
                  enumerable: false
                });
              } catch(e3) {
                // Last resort - just assign directly
                try {
                  cryptoObj.randomUUID = polyfillFn;
                } catch(e4) {
                  // Silently fail
                }
              }
            }
          }
        } catch(e) {
          // Silently fail for individual contexts
        }
      }
      
      // Apply to all possible global contexts
      var contexts = [];
      if (typeof window !== 'undefined') {
        contexts.push({ ctx: window, name: 'window' });
      }
      if (typeof globalThis !== 'undefined') {
        contexts.push({ ctx: globalThis, name: 'globalThis' });
      }
      if (typeof global !== 'undefined') {
        contexts.push({ ctx: global, name: 'global' });
      }
      if (typeof self !== 'undefined') {
        contexts.push({ ctx: self, name: 'self' });
      }
      
      // Apply polyfill to all contexts first
      contexts.forEach(function(item) {
        ensureRandomUUID(item.ctx, item.name);
      });
      
      // Also ensure the global crypto object directly (most important)
      // This handles the case where crypto is a standalone global
      if (typeof crypto !== 'undefined' && crypto) {
        if (crypto.getRandomValues) {
          ensureRandomUUID({ crypto: crypto }, 'global-crypto');
        }
        // Also try to polyfill the crypto object itself if it's directly accessible
        try {
          if (crypto.getRandomValues) {
            var polyfillFn = createPolyfill(crypto);
            // Always polyfill the global crypto object
            // This is critical for non-secure contexts where randomUUID exists but throws
            try {
              Object.defineProperty(crypto, 'randomUUID', {
                value: polyfillFn,
                writable: true,
                configurable: true,
                enumerable: false
              });
            } catch(e) {
              try {
                crypto.randomUUID = polyfillFn;
              } catch(e2) {
                // Silently fail
              }
            }
            // Also ensure window.crypto.randomUUID is polyfilled if window.crypto exists
            if (typeof window !== 'undefined' && window.crypto && window.crypto === crypto) {
              // Already handled by ensureRandomUUID above
            }
          }
        } catch(e) {
          // Silently fail
        }
      }
      
      
    } catch(e) {
      console.warn('Crypto polyfill failed:', e);
    }
  }
  
  // Run immediately and synchronously (most important - runs first)
  polyfillRandomUUID();
  
  // Also run immediately again to catch any edge cases
  polyfillRandomUUID();
  
  // Also run on DOMContentLoaded as a fallback
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', polyfillRandomUUID);
    } else {
      polyfillRandomUUID();
    }
  }
  
  // Run again after a short delay to catch any late-loading scripts
  if (typeof window !== 'undefined' && window.setTimeout) {
    setTimeout(polyfillRandomUUID, 0);
    setTimeout(polyfillRandomUUID, 10);
  }
})();
            `,
          }}
        />
        <Script
          src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
