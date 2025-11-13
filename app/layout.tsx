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
      function ensureRandomUUID(context, contextName) {
        try {
          if (!context || typeof context !== 'object') return;
          
          // Get or create crypto object
          var cryptoObj = context.crypto || context.msCrypto;
          if (!cryptoObj || !cryptoObj.getRandomValues) return;
          
          // Always polyfill - be aggressive to ensure compatibility
          // Even if randomUUID exists, we'll replace it with our working version
          var polyfillFn = createPolyfill(cryptoObj);
          
          // Check if existing randomUUID exists and is a function
          var shouldReplace = true;
          if (cryptoObj.randomUUID) {
            // Check if it's actually a function
            if (typeof cryptoObj.randomUUID !== 'function') {
              // It exists but is not a function - definitely replace
              shouldReplace = true;
            } else {
              // It's a function, test if it works
              try {
                var testUUID = cryptoObj.randomUUID();
                if (typeof testUUID === 'string' && testUUID.length === 36 && testUUID.indexOf('-') === 8) {
                  // It works, but we'll still replace it to ensure consistency
                  shouldReplace = true;
                } else {
                  // Doesn't return valid UUID - replace
                  shouldReplace = true;
                }
              } catch(e) {
                // Definitely replace if it throws
                shouldReplace = true;
              }
            }
          }
          
          // Always apply polyfill to ensure it works
          if (shouldReplace) {
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
                  cryptoObj.randomUUID = polyfillFn;
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
      
      // Also check the bare 'crypto' identifier
      if (typeof crypto !== 'undefined' && crypto) {
        ensureRandomUUID({ crypto: crypto }, 'crypto');
      }
      
      // Apply polyfill to all contexts
      contexts.forEach(function(item) {
        ensureRandomUUID(item.ctx, item.name);
      });
      
      // Also ensure the global crypto object (if it exists as a standalone)
      if (typeof crypto !== 'undefined' && crypto && crypto.getRandomValues) {
        ensureRandomUUID({ crypto: crypto }, 'global-crypto');
      }
      
    } catch(e) {
      console.warn('Crypto polyfill failed:', e);
    }
  }
  
  // Run immediately and synchronously
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
