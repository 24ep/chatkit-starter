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
  try {
    var cryptoObj = null;
    if (typeof window !== 'undefined') {
      cryptoObj = window.crypto || window.msCrypto;
    }
    if (!cryptoObj && typeof globalThis !== 'undefined') {
      cryptoObj = globalThis.crypto;
    }
    if (!cryptoObj && typeof crypto !== 'undefined') {
      cryptoObj = crypto;
    }
    if (cryptoObj && cryptoObj.getRandomValues) {
      if (!cryptoObj.randomUUID) {
        cryptoObj.randomUUID = function() {
          var bytes = new Uint8Array(16);
          cryptoObj.getRandomValues(bytes);
          bytes[6] = (bytes[6] & 0x0f) | 0x40;
          bytes[8] = (bytes[8] & 0x3f) | 0x80;
          var hex = Array.from(bytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
          return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
        };
      }
      if (typeof window !== 'undefined' && !window.crypto) {
        window.crypto = cryptoObj;
      }
      if (typeof globalThis !== 'undefined' && !globalThis.crypto) {
        globalThis.crypto = cryptoObj;
      }
    }
  } catch(e) {
    console.warn('Crypto polyfill failed:', e);
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
