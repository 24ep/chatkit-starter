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
  function polyfillRandomUUID() {
    try {
      var cryptoObj = null;
      var contexts = [];
      
      // Collect all possible crypto contexts
      if (typeof window !== 'undefined') {
        contexts.push(window);
        if (window.crypto) cryptoObj = window.crypto;
        if (!cryptoObj && window.msCrypto) cryptoObj = window.msCrypto;
      }
      if (typeof globalThis !== 'undefined') {
        contexts.push(globalThis);
        if (!cryptoObj && globalThis.crypto) cryptoObj = globalThis.crypto;
      }
      if (typeof global !== 'undefined') {
        contexts.push(global);
        if (!cryptoObj && global.crypto) cryptoObj = global.crypto;
      }
      if (typeof self !== 'undefined') {
        contexts.push(self);
        if (!cryptoObj && self.crypto) cryptoObj = self.crypto;
      }
      
      // If no crypto found, try to create one
      if (!cryptoObj && typeof crypto !== 'undefined') {
        cryptoObj = crypto;
      }
      
      if (cryptoObj && cryptoObj.getRandomValues) {
        // Create the polyfill function
        var polyfillFn = function() {
          var bytes = new Uint8Array(16);
          cryptoObj.getRandomValues(bytes);
          bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
          bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
          var hex = Array.from(bytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
          return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
        };
        
        // Always replace randomUUID if it doesn't exist or doesn't work
        var needsPolyfill = true;
        if (cryptoObj.randomUUID) {
          try {
            var testUUID = cryptoObj.randomUUID();
            if (typeof testUUID === 'string' && testUUID.length > 0) {
              needsPolyfill = false;
            }
          } catch(e) {
            needsPolyfill = true;
          }
        }
        
        if (needsPolyfill) {
          // Replace in the crypto object
          cryptoObj.randomUUID = polyfillFn;
          
          // Also ensure all contexts have the crypto object with randomUUID
          contexts.forEach(function(ctx) {
            if (ctx && !ctx.crypto) {
              ctx.crypto = cryptoObj;
            } else if (ctx && ctx.crypto && !ctx.crypto.randomUUID) {
              ctx.crypto.randomUUID = polyfillFn;
            }
          });
        }
      }
    } catch(e) {
      console.warn('Crypto polyfill failed:', e);
    }
  }
  
  // Run immediately
  polyfillRandomUUID();
  
  // Also run on DOMContentLoaded as a fallback
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', polyfillRandomUUID);
    } else {
      polyfillRandomUUID();
    }
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
